"use client";

import { completeExercise, submitFeedback } from "@/server/actions/patient";
import type { RatingKey } from "@/lib/labels";

/**
 * A tiny offline-tolerant outbox for the session flow.
 *
 * Completion is idempotent on the server, so the rule is simple: record it
 * locally first, show it as done, and keep retrying until the server agrees.
 * Feedback waits for the completion id it belongs to. Everything is persisted
 * in localStorage per session, so a reload, a closed tab or a dead signal
 * never loses a completed exercise or a pain report.
 */

export type CompleteOp = {
  kind: "complete";
  id: string;
  programExerciseId: string;
  setsCompleted?: number;
  attempts: number;
};

export type FeedbackOp = {
  kind: "feedback";
  id: string;
  programExerciseId: string;
  rating: RatingKey;
  painLocation: string | null;
  note: string | null;
  attempts: number;
};

export type QueueOp = CompleteOp | FeedbackOp;

type Stored = { ops: QueueOp[]; completionIds: Record<string, string> };

export type QueueSnapshot = {
  pending: number;
  /** True when the last attempt failed because we couldn't reach the server. */
  offline: boolean;
  syncing: boolean;
  completionIds: Record<string, string>;
  /** programExerciseIds with a completion waiting to sync. */
  queuedCompletions: string[];
};

const PREFIX = "form:session-queue:";
const MAX_ATTEMPTS = 5;

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function read(key: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed || !Array.isArray(parsed.ops)) return null;
    return { ops: parsed.ops, completionIds: parsed.completionIds ?? {} };
  } catch {
    return null;
  }
}

export class SessionQueue {
  private ops: QueueOp[] = [];
  private completionIds: Record<string, string> = {};
  private listeners = new Set<() => void>();
  private flushing = false;
  private inFlight: QueueOp | null = null;
  private again = false;
  private offline = false;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private retryDelay = 4000;
  private snapshot: QueueSnapshot;
  private readonly key: string;

  constructor(
    readonly sessionId: string,
    initialCompletionIds: Record<string, string> = {},
    private readonly onDrop?: (message: string) => void,
  ) {
    this.key = PREFIX + sessionId;
    this.completionIds = { ...initialCompletionIds };
    this.snapshot = this.buildSnapshot();
    this.serverSnapshot = this.snapshot;
  }

  private hydrated = false;
  private readonly serverSnapshot: QueueSnapshot;

  /**
   * Loads anything left on this device from an earlier visit. Called after
   * mount (never during render) so server and client render the same thing.
   * Server-confirmed completions win over local ones.
   */
  hydrate() {
    if (this.hydrated || typeof window === "undefined") return this.snapshot;
    this.hydrated = true;
    const stored = read(this.key);
    if (stored) {
      const known = new Set(this.ops.map((o) => o.id));
      this.ops = [
        ...stored.ops
          .filter((o) => !known.has(o.id))
          .filter((o) => !(o.kind === "complete" && this.completionIds[o.programExerciseId]))
          .map((o) => ({ ...o, attempts: 0 })),
        ...this.ops,
      ];
      this.completionIds = { ...stored.completionIds, ...this.completionIds };
      this.persist();
    }
    this.emit();
    return this.snapshot;
  }

  getServerSnapshot = () => this.serverSnapshot;

  /* ---------- subscription (useSyncExternalStore) ---------- */

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  private buildSnapshot(): QueueSnapshot {
    return {
      pending: this.ops.length,
      offline: this.offline,
      syncing: this.flushing,
      completionIds: { ...this.completionIds },
      queuedCompletions: this.ops.filter((o): o is CompleteOp => o.kind === "complete").map((o) => o.programExerciseId),
    };
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    for (const listener of this.listeners) listener();
  }

  private persist() {
    try {
      if (this.ops.length === 0) window.localStorage.removeItem(this.key);
      else window.localStorage.setItem(this.key, JSON.stringify({ ops: this.ops, completionIds: this.completionIds }));
    } catch {
      // Storage full or disabled: the in-memory queue still retries while the page is open.
    }
  }

  private change() {
    this.persist();
    this.emit();
  }

  /* ---------- enqueue ---------- */

  complete(programExerciseId: string, setsCompleted?: number) {
    if (this.completionIds[programExerciseId]) {
      // Already recorded on the server; nothing to send.
      return;
    }
    if (!this.ops.some((o) => o.kind === "complete" && o.programExerciseId === programExerciseId)) {
      this.ops.push({ kind: "complete", id: makeId(), programExerciseId, setsCompleted, attempts: 0 });
      this.change();
    }
    void this.flush();
  }

  feedback(programExerciseId: string, input: { rating: RatingKey; painLocation?: string | null; note?: string | null }) {
    const op: FeedbackOp = {
      kind: "feedback",
      id: makeId(),
      programExerciseId,
      rating: input.rating,
      painLocation: input.painLocation ?? null,
      note: input.note?.trim() ? input.note.trim() : null,
      attempts: 0,
    };
    // Replace an unsent answer for the same exercise; the latest one wins (the server also replaces).
    const existing = this.ops.findIndex((o) => o.kind === "feedback" && o.programExerciseId === programExerciseId);
    if (existing >= 0 && this.ops[existing] !== this.inFlight) this.ops.splice(existing, 1, op);
    else this.ops.push(op);
    this.change();
    void this.flush();
  }

  hasPending() {
    return this.ops.length > 0;
  }

  /* ---------- sync ---------- */

  private current: Promise<boolean> | null = null;

  /** Sends everything that can be sent. Resolves true when nothing is left. Concurrent calls share one run. */
  flush(): Promise<boolean> {
    if (this.current) {
      this.again = true;
      return this.current;
    }
    this.current = this.drain().finally(() => {
      this.current = null;
    });
    return this.current;
  }

  private async drain(): Promise<boolean> {
    if (this.ops.length === 0) return true;
    this.flushing = true;
    this.emit();
    let reachedServer = true;
    let progressed = false;
    try {
      // Process in order, skipping feedback that is still waiting for its completion.
      let i = 0;
      while (i < this.ops.length) {
        const op = this.ops[i];
        if (op.kind === "feedback" && !this.completionIds[op.programExerciseId]) {
          const waiting = this.ops.some((o) => o.kind === "complete" && o.programExerciseId === op.programExerciseId);
          if (!waiting) {
            // No completion will ever arrive for this; it can't be attached. Drop quietly.
            this.ops.splice(i, 1);
            this.persist();
            continue;
          }
          i++;
          continue;
        }
        this.inFlight = op;
        const result = await this.send(op);
        this.inFlight = null;
        if (result === "network") {
          reachedServer = false;
          break;
        }
        if (result === "ok") {
          this.remove(op);
          this.persist();
          progressed = true;
          continue;
        }
        // The server answered with an error. Retry a few times, then let it go and say so.
        op.attempts += 1;
        if (op.attempts >= MAX_ATTEMPTS) {
          this.remove(op);
          this.onDrop?.(result.error);
        } else {
          i++;
        }
        this.persist();
      }
    } finally {
      this.inFlight = null;
      this.flushing = false;
      this.offline = !reachedServer;
      this.emit();
    }
    // A completion that just synced may have unblocked feedback queued before it in this pass.
    if (
      reachedServer &&
      progressed &&
      this.ops.some((o) => o.kind === "feedback" && this.completionIds[o.programExerciseId] && o.attempts === 0)
    ) {
      this.again = true;
    }
    if (this.again) {
      this.again = false;
      if (reachedServer) return this.drain();
    }
    if (this.ops.length > 0) this.scheduleRetry();
    else this.retryDelay = 4000;
    return this.ops.length === 0;
  }

  private remove(op: QueueOp) {
    const index = this.ops.indexOf(op);
    if (index >= 0) this.ops.splice(index, 1);
  }

  private scheduleRetry() {
    if (this.retryTimer) return;
    this.retryTimer = setTimeout(() => {
      this.retryTimer = null;
      void this.flush();
    }, this.retryDelay);
    this.retryDelay = Math.min(this.retryDelay * 2, 60_000);
  }

  private async send(op: QueueOp): Promise<"ok" | "network" | { error: string }> {
    try {
      if (op.kind === "complete") {
        const res = await completeExercise({
          sessionId: this.sessionId,
          programExerciseId: op.programExerciseId,
          setsCompleted: op.setsCompleted,
        });
        if (!res.ok) return { error: res.error };
        this.completionIds[op.programExerciseId] = res.data.completionId;
        return "ok";
      }
      const res = await submitFeedback({
        completionId: this.completionIds[op.programExerciseId],
        rating: op.rating,
        painLocation: op.painLocation,
        note: op.note,
      });
      if (!res.ok) return { error: res.error };
      return "ok";
    } catch {
      // fetch failed: offline, timeout, or the server is unreachable.
      return "network";
    }
  }

  dispose() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
  }
}

/** Session ids with unsynced work left on this device (e.g. the tab was closed offline). */
export function storedQueueSessionIds(): string[] {
  const ids: string[] = [];
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) ids.push(key.slice(PREFIX.length));
    }
  } catch {
    return [];
  }
  return ids;
}

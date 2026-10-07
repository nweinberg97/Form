"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CloudOff, Ellipsis, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { finishSession, trackExerciseViewed } from "@/server/actions/patient";
import type { RatingKey } from "@/lib/labels";
import { Button, IconButton } from "@/components/ui/button";
import { StepProgress } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { PhysioNote } from "@/components/patient/exercise-details";
import { SessionQueue } from "./queue";
import { ExerciseStep } from "./exercise-step";
import { FeedbackStep, MoreSheet } from "./feedback-step";
import { SessionComplete } from "./session-complete";
import { DrawnCheck } from "./check-mark";
import type { FlowItem } from "./types";

type Phase =
  | { kind: "exercise"; index: number }
  | { kind: "feedback"; index: number }
  | { kind: "after-pain"; index: number }
  | { kind: "complete" };

export function SessionFlow({
  sessionId,
  items,
  clinicianFirstName,
  multiplePrograms,
  estimatedMinutes,
  serverDurationSec,
}: {
  sessionId: string;
  items: FlowItem[];
  clinicianFirstName: string | null;
  multiplePrograms: boolean;
  estimatedMinutes: number;
  serverDurationSec: number | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const total = items.length;

  /* ---------- the outbox ---------- */
  const queueRef = useRef<SessionQueue | null>(null);
  if (!queueRef.current) {
    const initial: Record<string, string> = {};
    for (const item of items) if (item.completionId) initial[item.programExerciseId] = item.completionId;
    queueRef.current = new SessionQueue(sessionId, initial, (message) => toast(message, "error"));
  }
  const queue = queueRef.current;
  const snapshot = useSyncExternalStore(queue.subscribe, queue.getSnapshot, queue.getServerSnapshot);

  useEffect(() => {
    queue.hydrate();
    void queue.flush();
    const retry = () => void queue.flush();
    const onVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", onVisible);
      queue.dispose();
    };
  }, [queue]);

  /* ---------- done state: server truth ∪ local truth ---------- */
  const [localDone, setLocalDone] = useState<Set<string>>(() => new Set());
  const isDone = useCallback(
    (item: FlowItem) =>
      item.done ||
      localDone.has(item.programExerciseId) ||
      Boolean(snapshot.completionIds[item.programExerciseId]) ||
      snapshot.queuedCompletions.includes(item.programExerciseId),
    [localDone, snapshot],
  );
  const doneCount = items.filter(isDone).length;

  /* ---------- where we are ---------- */
  // Captured once: props refresh as completions sync, but "was this a resume?" is about how we arrived.
  const [resumed] = useState(() => items.some((i) => i.done));
  const [phase, setPhase] = useState<Phase>(() => {
    const first = items.findIndex((i) => !i.done);
    return first === -1 ? { kind: "complete" } : { kind: "exercise", index: first };
  });
  const [direction, setDirection] = useState<"forward" | "none">("none");
  const [sheet, setSheet] = useState<null | "pain" | "note">(null);
  const [setsByItem, setSetsByItem] = useState<Record<string, number>>({});
  const [finishOpen, setFinishOpen] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const startedAt = useRef<number>(Date.now());
  const viewed = useRef(new Set<string>());
  const index = phase.kind === "complete" ? -1 : phase.index;
  const item = index >= 0 ? items[index] : null;

  // Analytics: first view of each exercise.
  useEffect(() => {
    if (phase.kind !== "exercise" || !item) return;
    if (viewed.current.has(item.exercise.id)) return;
    viewed.current.add(item.exercise.id);
    void trackExerciseViewed({ exerciseId: item.exercise.id }).catch(() => undefined);
  }, [phase.kind, item]);

  // Move focus and scroll to the new step so keyboard and screen-reader users land on it.
  const phaseKey = phase.kind === "complete" ? "complete" : `${phase.kind}-${phase.index}`;
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    window.scrollTo({ top: 0 });
    const target = document.querySelector<HTMLElement>("[data-step-heading]") ?? document.getElementById("exercise-name");
    target?.focus({ preventScroll: true });
  }, [phaseKey]);

  const nextIndex = (from: number, justDone: string) => {
    const pending = (i: number) => items[i].programExerciseId !== justDone && !isDone(items[i]);
    for (let i = from + 1; i < total; i++) if (pending(i)) return i;
    for (let i = 0; i < from; i++) if (pending(i)) return i;
    return -1;
  };

  const advance = (from: number) => {
    const justDone = items[from].programExerciseId;
    const next = nextIndex(from, justDone);
    setDirection("forward");
    setSheet(null);
    if (next === -1) {
      setPhase({ kind: "complete" });
      void queue.flush();
    } else {
      setPhase({ kind: "exercise", index: next });
    }
  };

  // Resuming after a reload with completions still saved on this phone: skip past them.
  useEffect(() => {
    if (phase.kind !== "exercise" || !item || !isDone(item)) return;
    const next = items.findIndex((i) => !isDone(i));
    setPhase(next === -1 ? { kind: "complete" } : { kind: "exercise", index: next });
  }, [phase.kind, item, isDone, items]);

  /* ---------- actions ---------- */

  const complete = () => {
    if (!item) return;
    const tracked = setsByItem[item.programExerciseId];
    const setsCompleted = tracked && tracked > 0 && tracked < item.sets ? tracked : undefined;
    setLocalDone((prev) => new Set(prev).add(item.programExerciseId));
    queue.complete(item.programExerciseId, setsCompleted);
    setDirection("none");
    setPhase({ kind: "feedback", index });
  };

  const rate = (rating: RatingKey) => {
    if (!item) return;
    if (rating === "painful") {
      setSheet("pain");
      return;
    }
    queue.feedback(item.programExerciseId, { rating });
    advance(index);
  };

  const sendMore = (input: { rating: RatingKey; painLocation: string | null; note: string | null }) => {
    if (!item) return;
    queue.feedback(item.programExerciseId, input);
    if (input.rating === "painful") {
      setSheet(null);
      setDirection("none");
      setPhase({ kind: "after-pain", index });
    } else {
      advance(index);
    }
  };

  const painNotNow = () => {
    if (!item) return;
    if (sheet === "pain") {
      queue.feedback(item.programExerciseId, { rating: "painful" });
      setSheet(null);
      setDirection("none");
      setPhase({ kind: "after-pain", index });
    } else {
      setSheet(null);
    }
  };

  const finishEarly = async () => {
    setFinishing(true);
    await queue.flush();
    if (queue.hasPending()) {
      setFinishing(false);
      toast("You're offline. Your progress is saved on this phone — try again when you're connected.", "error");
      return;
    }
    const res = await finishSession({ sessionId }).catch(() => null);
    setFinishing(false);
    if (!res) {
      toast("We couldn't reach FORM. Your progress is saved — try again in a moment.", "error");
      return;
    }
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(doneCount === 0 ? "Okay — today is marked as skipped." : "That's fine — what you did counts.", "success");
    router.push("/app");
    router.refresh();
  };

  /* ---------- render ---------- */

  if (phase.kind === "complete") {
    const elapsedMin = Math.max(1, Math.round((Date.now() - startedAt.current) / 60000));
    const minutes = serverDurationSec
      ? Math.max(1, Math.round(serverDurationSec / 60))
      : resumed
        ? estimatedMinutes
        : elapsedMin;
    return (
      <SessionComplete
        done={doneCount}
        total={total}
        minutes={minutes}
        approximate={!serverDurationSec && resumed}
        pending={snapshot.pending > 0}
        offline={snapshot.offline}
      />
    );
  }

  if (!item) return null;
  const setsDone = setsByItem[item.programExerciseId] ?? 0;
  const currentForBar = phase.kind === "exercise" ? index : -1;
  const showOffline = snapshot.pending > 0 && snapshot.offline;

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {/* Top bar */}
      <div className="sticky top-0 z-[var(--z-nav)] border-b border-line bg-paper/95">
        <div className="mx-auto flex h-16 max-w-[640px] items-center gap-3 px-3">
          <Link
            href="/app"
            aria-label="Leave session — your progress is saved"
            title="Leave session — your progress is saved"
            className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-ink hover:bg-sunken"
          >
            <X aria-hidden className="size-6" />
          </Link>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <StepProgress
              total={total}
              done={doneCount}
              current={currentForBar >= 0 && !isDone(item) ? currentForBar : undefined}
              label={`${doneCount} of ${total} exercises complete`}
            />
            <p className="text-[13px] font-medium text-muted tabular" aria-hidden>
              {phase.kind === "exercise" ? `Exercise ${index + 1} of ${total}` : `${doneCount} of ${total} complete`}
            </p>
          </div>
          {doneCount < total ? (
            <IconButton label="More options" onClick={() => setFinishOpen(true)}>
              <Ellipsis aria-hidden className="size-5" />
            </IconButton>
          ) : (
            <span className="size-11" aria-hidden />
          )}
        </div>
        <div aria-live="polite" className="mx-auto max-w-[640px]">
          {showOffline ? (
            <p className="flex items-center gap-2 px-5 pb-2.5 text-[13px] text-muted">
              <CloudOff aria-hidden className="size-4 shrink-0" />
              Saved on this phone — we&apos;ll sync when you&apos;re back online.
            </p>
          ) : null}
        </div>
      </div>

      <main id="main" className="mx-auto w-full max-w-[640px] flex-1 px-5 pt-6">
        <div
          key={phaseKey}
          className={cn(direction === "forward" ? "animate-slide-in" : "animate-fade", phase.kind === "exercise" ? "pb-36" : "pb-16")}
        >
          {phase.kind === "exercise" ? (
            <ExerciseStep
              item={item}
              index={index}
              total={total}
              clinicianFirstName={clinicianFirstName}
              multiplePrograms={multiplePrograms}
              setsDone={setsDone}
              onSetsChange={(n) => setSetsByItem((prev) => ({ ...prev, [item.programExerciseId]: n }))}
            />
          ) : phase.kind === "feedback" ? (
            <FeedbackStep
              exerciseName={item.exercise.name}
              doneCount={doneCount}
              total={total}
              clinicianFirstName={clinicianFirstName}
              onRate={rate}
              onAddNote={() => setSheet("note")}
            />
          ) : (
            <AfterPain
              item={item}
              clinicianFirstName={clinicianFirstName}
              isLast={nextIndex(index, item.programExerciseId) === -1}
              onContinue={() => advance(index)}
              onFinish={() => setFinishOpen(true)}
            />
          )}
        </div>
      </main>

      {phase.kind === "exercise" ? (
        <div className="fixed inset-x-0 bottom-0 z-[var(--z-sticky)] border-t border-line bg-paper/95 safe-bottom">
          <div className="mx-auto max-w-[640px] px-5 py-3">
            <Button variant="primary" size="xl" block onClick={complete}>
              Complete exercise
              <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none">
                <path d="M5 12.5 10 17 19 7.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Button>
          </div>
        </div>
      ) : null}

      <MoreSheet
        key={`${item.programExerciseId}-${sheet ?? "closed"}`}
        open={sheet !== null}
        mode={sheet ?? "note"}
        clinicianFirstName={clinicianFirstName}
        onSend={sendMore}
        onNotNow={painNotNow}
      />

      <Sheet
        open={finishOpen}
        onClose={() => setFinishOpen(false)}
        title="Finish for today?"
        description="That's fine — what you did counts."
        footer={
          <div className="flex flex-col gap-2">
            <Button variant="dark" size="lg" block loading={finishing} onClick={finishEarly}>
              Finish for today
            </Button>
            <Button variant="ghost" size="lg" block onClick={() => setFinishOpen(false)}>
              Keep going
            </Button>
          </div>
        }
      >
        <p className="text-[17px] tabular">
          {doneCount === 0
            ? "You haven't completed an exercise yet. Finishing now will mark today as skipped."
            : `${doneCount} of ${total} exercises done. ${clinicianFirstName ?? "Your physio"} will see what you completed.`}
        </p>
        <p className="mt-3 text-[15px] text-muted">
          Leaving with the close button keeps today open instead, so you can come back later.
        </p>
      </Sheet>
    </div>
  );
}

function AfterPain({
  item,
  clinicianFirstName,
  isLast,
  onContinue,
  onFinish,
}: {
  item: FlowItem;
  clinicianFirstName: string | null;
  isLast: boolean;
  onContinue: () => void;
  onFinish: () => void;
}) {
  return (
    <section aria-labelledby="after-pain-title" className="flex flex-col gap-6">
      <DrawnCheck className="size-14" />
      <h1
        id="after-pain-title"
        data-step-heading
        tabIndex={-1}
        className="text-[2rem] leading-[1.02] font-black tracking-[-0.04em] outline-none"
      >
        Thanks for letting {clinicianFirstName ?? "your physio"} know.
      </h1>
      <p className="text-[17px] text-ink/80">
        Your answer for {item.exercise.name} has been recorded and {clinicianFirstName ?? "your physio"} will see it.
      </p>
      {item.note ? <PhysioNote note={item.note} clinicianFirstName={clinicianFirstName} /> : null}
      {item.exercise.safetyNotes ? (
        <div className="rounded-[12px] border border-line p-4">
          <p className="kicker text-muted">About this exercise</p>
          <p className="mt-1.5 text-[15px] leading-relaxed">{item.exercise.safetyNotes}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2 pt-2">
        <Button variant="dark" size="xl" block onClick={onContinue}>
          {isLast ? "Finish session" : "Next exercise"}
        </Button>
        {!isLast ? (
          <Button variant="ghost" size="lg" block onClick={onFinish}>
            Finish for today
          </Button>
        ) : null}
      </div>
    </section>
  );
}

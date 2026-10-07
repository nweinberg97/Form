"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp } from "lucide-react";
import { markThreadRead, sendPatientMessage } from "@/server/actions/patient";
import { RATING_LABEL, RATING_TONE, type RatingKey } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

export type ThreadEntry = {
  id: string;
  body: string;
  createdAt: string;
  mine: boolean;
  senderName: string;
  senderCredentials: string | null;
  exerciseName: string | null;
  rating: RatingKey | null;
  painLocation: string | null;
};

type LocalEntry = ThreadEntry & { status: "sending" | "failed"; clientId: string; confirmed: boolean; since: number };

function dayKey(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

function dayLabel(iso: string, timeZone: string) {
  const key = dayKey(iso, timeZone);
  const now = new Date();
  const today = dayKey(now.toISOString(), timeZone);
  const yesterday = dayKey(new Date(now.getTime() - 86_400_000).toISOString(), timeZone);
  if (key === today) return "Today";
  if (key === yesterday) return "Yesterday";
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" }).format(new Date(iso));
}

function timeLabel(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function newClientId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export function MessageThread({
  messages,
  clinicianFirstName,
  timeZone,
  canSend,
}: {
  messages: ThreadEntry[];
  clinicianFirstName: string | null;
  timeZone: string;
  canSend: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [local, setLocal] = useState<LocalEntry[]>([]);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const marked = useRef(false);

  useEffect(() => {
    if (marked.current || !canSend) return;
    marked.current = true;
    void markThreadRead().catch(() => undefined);
  }, [canSend]);

  // An optimistic entry disappears once the server's copy (same body, sent after it was written) is in the list.
  const pendingLocal = local.filter(
    (l) =>
      !(
        l.confirmed &&
        messages.some((m) => m.mine && m.body === l.body && new Date(m.createdAt).getTime() >= l.since - 120_000)
      ),
  );
  const all: (ThreadEntry | LocalEntry)[] = [...messages, ...pendingLocal];

  useLayoutEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [all.length]);

  // Autogrow
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 180)}px`;
  }, [draft]);

  const send = async (body: string, clientId: string) => {
    const res = await sendPatientMessage({ body, clientId }).catch(() => null);
    if (!res || !res.ok) {
      setLocal((prev) => prev.map((l) => (l.clientId === clientId ? { ...l, status: "failed" } : l)));
      toast(res && !res.ok ? res.error : "Your message didn't send. It's kept here — tap to try again.", "error");
      return;
    }
    setLocal((prev) => prev.map((l) => (l.clientId === clientId ? { ...l, confirmed: true } : l)));
    router.refresh();
  };

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const clientId = newClientId();
    setLocal((prev) => [
      ...prev,
      {
        id: clientId,
        clientId,
        body,
        createdAt: new Date().toISOString(),
        mine: true,
        senderName: "You",
        senderCredentials: null,
        exerciseName: null,
        rating: null,
        painLocation: null,
        status: "sending",
        confirmed: false,
        since: Date.now(),
      },
    ]);
    setDraft("");
    void send(body, clientId);
  };

  const retry = (entry: LocalEntry) => {
    setLocal((prev) => prev.map((l) => (l.clientId === entry.clientId ? { ...l, status: "sending" } : l)));
    void send(entry.body, entry.clientId);
  };

  let lastDay = "";

  return (
    <div className="flex flex-col">
      {all.length === 0 ? (
        <div className="rounded-[14px] border border-dashed border-line-strong px-6 py-10">
          <p className="text-lg font-semibold tracking-[-0.015em]">
            Questions about your plan? Message {clinicianFirstName ?? "your physio"} here.
          </p>
          <p className="mt-1 text-[15px] text-muted">
            Notes you leave on an exercise show up here too, with the exercise attached.
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3" aria-label="Messages with your care team">
          {all.map((m) => {
            const key = dayKey(m.createdAt, timeZone);
            const showDay = key !== lastDay;
            lastDay = key;
            const localEntry = "status" in m ? (m as LocalEntry) : null;
            return (
              <li key={m.id} className="flex flex-col">
                {showDay ? (
                  <p className="kicker my-3 text-center text-muted">{dayLabel(m.createdAt, timeZone)}</p>
                ) : null}
                <div className={cn("flex max-w-[85%] flex-col gap-1", m.mine ? "self-end items-end" : "self-start items-start")}>
                  <p className="px-1 text-[12px] text-muted">
                    <span className="font-medium text-ink">
                      {m.mine ? "You" : `${m.senderName}${m.senderCredentials ? `, ${m.senderCredentials}` : ""}`}
                    </span>
                    <span aria-hidden> · </span>
                    <time dateTime={m.createdAt}>{timeLabel(m.createdAt, timeZone)}</time>
                  </p>
                  <div
                    className={cn(
                      "rounded-[16px] px-4 py-3 text-[16px] leading-relaxed whitespace-pre-wrap break-words",
                      m.mine ? "rounded-br-[6px] bg-ink text-paper" : "rounded-bl-[6px] border border-line bg-surface text-ink",
                      localEntry?.status === "sending" && !localEntry.confirmed && "opacity-70",
                    )}
                  >
                    {m.exerciseName ? (
                      <span
                        className={cn(
                          "mb-2 flex flex-wrap items-center gap-1.5 border-b pb-2 text-[13px]",
                          m.mine ? "border-paper/15" : "border-line",
                        )}
                      >
                        <span className={cn("kicker", m.mine ? "text-night-muted" : "text-muted")}>Exercise</span>
                        <span className="font-semibold">{m.exerciseName}</span>
                        {m.rating ? (
                          <Badge tone={RATING_TONE[m.rating]} className="h-5 text-[11px]">
                            {RATING_LABEL[m.rating]}
                          </Badge>
                        ) : null}
                        {m.painLocation ? (
                          <span className={m.mine ? "text-night-muted" : "text-muted"}>· {m.painLocation}</span>
                        ) : null}
                      </span>
                    ) : null}
                    {m.body}
                  </div>
                  {localEntry?.status === "sending" && !localEntry.confirmed ? (
                    <p className="flex items-center gap-1.5 px-1 text-[12px] text-muted" aria-live="polite">
                      <Spinner className="size-3" /> Sending
                    </p>
                  ) : localEntry?.status === "failed" ? (
                    <button
                      type="button"
                      onClick={() => retry(localEntry)}
                      className="min-h-11 px-1 text-[13px] font-medium text-danger underline underline-offset-4"
                    >
                      Not sent — tap to try again
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <div ref={endRef} />

      {canSend ? (
        <form
          onSubmit={submit}
          className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[var(--z-sticky)] border-t border-line bg-paper/95 px-5 py-3 md:sticky md:bottom-0 md:mt-8 md:px-0"
        >
          <div className="mx-auto flex max-w-[640px] items-end gap-2">
            <label htmlFor="message-input" className="sr-only">
              Message {clinicianFirstName ?? "your care team"}
            </label>
            <textarea
              id="message-input"
              ref={inputRef}
              value={draft}
              rows={1}
              maxLength={2000}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                  e.preventDefault();
                  submit();
                }
              }}
              placeholder={`Message ${clinicianFirstName ?? "your care team"}`}
              className="max-h-[180px] min-h-12 flex-1 resize-none rounded-[12px] border border-line-strong bg-white px-4 py-3 text-[16px] leading-snug placeholder:text-faint focus:border-ink focus:outline-none"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              aria-label="Send message"
              className="inline-flex size-12 shrink-0 items-center justify-center rounded-[12px] bg-signal text-ink transition-colors hover:bg-signal-deep disabled:bg-sunken disabled:text-faint"
            >
              <ArrowUp aria-hidden className="size-5" strokeWidth={2.5} />
            </button>
          </div>
        </form>
      ) : (
        <p className="mt-8 text-[15px] text-muted">Your plan has ended, so this thread is read-only.</p>
      )}
    </div>
  );
}

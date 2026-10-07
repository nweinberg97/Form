"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Dumbbell, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/dates";
import { RATING_LABEL, RATING_TONE, type RatingKey } from "@/lib/labels";
import { markPatientThreadRead, sendClinicianMessage } from "@/server/actions/clinician";
import type { ThreadMessage } from "@/server/services/patient";
import { newClientId, useOnce } from "../hooks";

type Pending = { clientId: string; body: string; failed?: boolean };

export function MessageThread({
  patientId,
  firstName,
  viewerId,
  messages,
  hasUnread,
}: {
  patientId: string;
  firstName: string;
  viewerId: string;
  messages: ThreadMessage[];
  hasUnread: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [isSending, start] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  useOnce(() => {
    if (!hasUnread) return;
    void markPatientThreadRead({ patientId }).then((r) => r.ok && router.refresh());
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, pending.length]);

  // Drop optimistic messages once the server copy arrives.
  useEffect(() => {
    setPending((list) => list.filter((p) => p.failed || !messages.some((m) => m.body === p.body && m.senderId === viewerId)));
  }, [messages, viewerId]);

  const send = (text: string, clientId: string) =>
    start(async () => {
      const result = await sendClinicianMessage({ patientId, body: text, clientId });
      if (result.ok) router.refresh();
      else {
        setPending((list) => list.map((p) => (p.clientId === clientId ? { ...p, failed: true } : p)));
        setError(result.error);
      }
    });

  return (
    <section aria-labelledby="thread-title" className="flex flex-col rounded-[14px] border border-line bg-surface">
      <h2 id="thread-title" className="border-b border-line px-5 py-3 text-[15px] font-semibold">
        Messages with {firstName}
      </h2>
      <div className="max-h-[60dvh] min-h-64 overflow-y-auto px-5 py-5">
        {messages.length === 0 && pending.length === 0 ? (
          <EmptyState
            title="No messages yet"
            description={`Feedback notes from ${firstName} arrive here with the exercise attached. You can start the conversation too.`}
          />
        ) : (
          <ol aria-label="Conversation" className="flex flex-col gap-4">
            {messages.map((m) => {
              const mine = m.senderRole !== "patient";
              const rating = m.rating as RatingKey | null;
              return (
                <li key={m.id} className={cn("flex max-w-[78%] flex-col gap-1", mine ? "self-end items-end" : "self-start items-start")}>
                  <p className="kicker text-muted">
                    {mine ? (m.senderId === viewerId ? "You" : m.senderName) : m.senderName.split(" ")[0]} · {timeAgo(m.createdAt)}
                  </p>
                  {m.exerciseName ? (
                    <span className="inline-flex flex-wrap items-center gap-1.5 text-xs text-muted">
                      <span className="inline-flex h-6 items-center gap-1 rounded-[5px] border border-line px-2 font-medium text-ink">
                        <Dumbbell aria-hidden className="size-3" />
                        {m.exerciseName}
                      </span>
                      {rating && rating in RATING_LABEL ? <Badge tone={RATING_TONE[rating]}>{RATING_LABEL[rating]}</Badge> : null}
                      {m.painLocation ? (
                        <span className="inline-flex items-center gap-1 text-danger">
                          <MapPin aria-hidden className="size-3" />
                          {m.painLocation}
                        </span>
                      ) : null}
                    </span>
                  ) : null}
                  <p
                    className={cn(
                      "rounded-[12px] px-3.5 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap",
                      mine ? "bg-ink text-paper" : "bg-sunken text-ink",
                    )}
                  >
                    {m.body}
                  </p>
                </li>
              );
            })}
            {pending.map((p) => (
              <li key={p.clientId} className="flex max-w-[78%] flex-col items-end gap-1 self-end">
                <p className="kicker text-muted">{p.failed ? "Not sent" : "Sending…"}</p>
                <p className={cn("rounded-[12px] px-3.5 py-2.5 text-[15px] whitespace-pre-wrap", p.failed ? "border border-danger/40 bg-danger-soft text-ink" : "bg-ink/80 text-paper")}>
                  {p.body}
                </p>
                {p.failed ? (
                  <button
                    type="button"
                    className="text-xs font-semibold text-ink underline"
                    onClick={() => {
                      setError(null);
                      setPending((list) => list.map((x) => (x.clientId === p.clientId ? { ...x, failed: false } : x)));
                      send(p.body, p.clientId);
                    }}
                  >
                    Try again
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        )}
        <div ref={endRef} />
      </div>
      <form
        className="flex flex-col gap-2 border-t border-line p-4"
        onSubmit={(e) => {
          e.preventDefault();
          const text = body.trim();
          if (!text) return setError("Write a message first.");
          setError(null);
          const clientId = newClientId();
          setPending((list) => [...list, { clientId, body: text }]);
          setBody("");
          send(text, clientId);
        }}
      >
        <label htmlFor="thread-composer" className="sr-only">
          Message {firstName}
        </label>
        <Textarea
          id="thread-composer"
          rows={2}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
          }}
          placeholder={`Write to ${firstName}…`}
          maxLength={2000}
        />
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <div className="flex items-center justify-between gap-2">
          <span className="kicker hidden text-faint sm:inline">⌘ + Enter to send</span>
          <Button type="submit" variant="dark" size="sm" loading={isSending} className="ml-auto">
            Send
          </Button>
        </div>
      </form>
    </section>
  );
}

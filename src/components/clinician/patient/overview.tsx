"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, CornerDownRight, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { RATING_LABEL, RATING_TONE, type RatingKey } from "@/lib/labels";
import { regenerateInvite, resolveAttentionItem, sendClinicianMessage } from "@/server/actions/clinician";
import { ATTENTION_LABEL, ATTENTION_TONE, asKind, sortSignals } from "../attention";
import { CopyLink } from "../copy-link";
import { newClientId } from "../hooks";

/* ---------------- Attention ---------------- */

type AttentionItem = { id: string; kind: string; message: string; createdAt: Date; ago: string };

export function AttentionItems({ patientId, items }: { patientId: string; items: AttentionItem[] }) {
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const visible = sortSignals(items).filter((i) => !resolved.has(i.id));
  if (visible.length === 0) return null;
  return (
    <section aria-labelledby="attention-items" className="rounded-[14px] border border-line bg-surface">
      <h2 id="attention-items" className="flex items-baseline gap-2 border-b border-line px-5 py-3 text-[15px] font-semibold">
        Attention <span className="tabular text-sm font-normal text-muted">{visible.length}</span>
      </h2>
      <ul className="divide-y divide-line">
        {visible.map((item) => (
          <AttentionLine
            key={item.id}
            patientId={patientId}
            item={item}
            onResolved={() => setResolved((s) => new Set(s).add(item.id))}
          />
        ))}
      </ul>
    </section>
  );
}

function AttentionLine({ patientId, item, onResolved }: { patientId: string; item: AttentionItem; onResolved: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const kind = asKind(item.kind);
  return (
    <li className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1">
        <Badge tone={ATTENTION_TONE[kind]}>{ATTENTION_LABEL[kind]}</Badge>
        <p className={cn("text-[15px]", kind === "pain" ? "font-medium text-danger" : "text-ink")}>{item.message}</p>
        <span className="kicker text-muted">{item.ago}</span>
      </div>
      <Button
        size="sm"
        variant="ghost"
        loading={pending}
        icon={<Check aria-hidden className="size-4" />}
        onClick={() =>
          start(async () => {
            const result = await resolveAttentionItem({ patientId, itemId: item.id });
            if (result.ok) {
              onResolved();
              toast("Marked reviewed", "success");
              router.refresh();
            } else toast(result.error, "error");
          })
        }
      >
        Reviewed
      </Button>
    </li>
  );
}

/* ---------------- Feedback ---------------- */

type FeedbackEntry = {
  id: string;
  rating: string;
  note: string | null;
  painLocation: string | null;
  ago: string;
  reviewedAt: Date | null;
  exerciseId: string;
  exerciseName: string;
};

export function RecentFeedback({ patientId, firstName, entries }: { patientId: string; firstName: string; entries: FeedbackEntry[] }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? entries : entries.slice(0, 8);
  return (
    <section aria-labelledby="recent-feedback">
      <div className="mb-3 flex items-baseline justify-between">
        <h2 id="recent-feedback" className="text-[15px] font-semibold">
          Recent feedback
        </h2>
        <span className="kicker text-muted">Last 30 days</span>
      </div>
      {entries.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line-strong px-5 py-5 text-sm text-muted">
          No feedback yet. After each exercise {firstName} can rate it Easy, Good, Hard or Painful.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
            {list.map((entry) => (
              <FeedbackLine key={entry.id} patientId={patientId} firstName={firstName} entry={entry} />
            ))}
          </ul>
          {entries.length > 8 ? (
            <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAll((s) => !s)} aria-expanded={showAll}>
              {showAll ? "Show fewer" : `Show all ${entries.length}`}
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

function FeedbackLine({ patientId, firstName, entry }: { patientId: string; firstName: string; entry: FeedbackEntry }) {
  const toast = useToast();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const clientId = useRef(newClientId());
  const replyRef = useRef<HTMLButtonElement>(null);
  const rating = (entry.rating in RATING_LABEL ? entry.rating : "good") as RatingKey;
  const painful = rating === "painful";

  return (
    <li className="px-5 py-3.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-semibold tracking-[-0.01em]">{entry.exerciseName}</span>
        <Badge tone={RATING_TONE[rating]}>{RATING_LABEL[rating]}</Badge>
        {painful && entry.painLocation ? (
          <span className="inline-flex items-center gap-1 text-sm text-danger">
            <MapPin aria-hidden className="size-3.5" />
            {entry.painLocation}
          </span>
        ) : null}
        <span className="kicker ml-auto text-muted">{entry.ago}</span>
      </div>
      {entry.note ? <p className="mt-1.5 max-w-prose text-[15px] text-ink">&ldquo;{entry.note}&rdquo;</p> : null}

      {sent ? (
        <p role="status" className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted">
          <Check aria-hidden className="size-4 text-success" /> Reply sent to {firstName}
        </p>
      ) : open ? (
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!body.trim()) return setError("Write a message first.");
            setError(null);
            start(async () => {
              const result = await sendClinicianMessage({
                patientId,
                body: body.trim(),
                clientId: clientId.current,
                exerciseId: entry.exerciseId,
                feedbackId: entry.id,
              });
              if (result.ok) {
                setSent(true);
                setOpen(false);
                toast(`Sent to ${firstName}`, "success");
                router.refresh();
              } else setError(result.error);
            });
          }}
        >
          <label htmlFor={`reply-${entry.id}`} className="sr-only">
            Reply to {firstName} about {entry.exerciseName}
          </label>
          <Textarea
            id={`reply-${entry.id}`}
            autoFocus
            rows={2}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setOpen(false);
                replyRef.current?.focus();
              }
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit();
            }}
            placeholder={`Reply about ${entry.exerciseName}…`}
            maxLength={2000}
          />
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <div className="flex items-center gap-2">
            <Button type="submit" size="sm" variant="dark" loading={pending}>
              Send
            </Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <span className="kicker ml-auto hidden text-faint sm:inline">⌘ + Enter to send</span>
          </div>
        </form>
      ) : (
        <button
          ref={replyRef}
          type="button"
          onClick={() => setOpen(true)}
          className="mt-1.5 inline-flex h-8 items-center gap-1.5 rounded-md text-sm font-medium text-muted transition-colors hover:text-ink"
        >
          <CornerDownRight aria-hidden className="size-4" />
          Reply
          <span className="sr-only"> about {entry.exerciseName}</span>
        </button>
      )}
    </li>
  );
}

/* ---------------- Invite ---------------- */

export function InviteCard({ patientId, firstName, expiresAt }: { patientId: string; firstName: string; expiresAt: Date | null }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : true;
  return (
    <section aria-labelledby="invite-title" className="rounded-[14px] border border-line bg-surface p-5">
      <h2 id="invite-title" className="text-[15px] font-semibold">
        {firstName} hasn&rsquo;t set up their account yet
      </h2>
      <p className="mt-1 text-sm text-muted">
        {expired
          ? "Their last invite link has expired. Create a fresh one to send."
          : "Create a fresh link to send again. Older links stop working."}
      </p>
      {error ? <Alert tone="danger" className="mt-3">{error}</Alert> : null}
      <div className="mt-4">
        {url ? (
          <CopyLink url={url} label={`Invite link for ${firstName}`} />
        ) : (
          <Button
            variant="dark"
            size="sm"
            loading={pending}
            onClick={() =>
              start(async () => {
                const result = await regenerateInvite({ patientId });
                if (result.ok) setUrl(result.data.inviteUrl);
                else setError(result.error);
              })
            }
          >
            Get invite link
          </Button>
        )}
      </div>
    </section>
  );
}

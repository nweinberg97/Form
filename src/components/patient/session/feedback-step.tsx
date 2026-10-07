"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { PAIN_LOCATIONS, RATING_LABEL, type RatingKey } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Sheet } from "@/components/ui/sheet";
import { DrawnCheck } from "./check-mark";

const RATINGS: { key: RatingKey; hint: string }[] = [
  { key: "easy", hint: "Could do more" },
  { key: "good", hint: "About right" },
  { key: "hard", hint: "A real effort" },
  { key: "painful", hint: "It hurt" },
];

/** "Done · 2 of 4 complete" then "How did that feel?" — one tap. */
export function FeedbackStep({
  exerciseName,
  doneCount,
  total,
  clinicianFirstName,
  onRate,
  onAddNote,
}: {
  exerciseName: string;
  doneCount: number;
  total: number;
  clinicianFirstName: string | null;
  onRate: (rating: RatingKey) => void;
  onAddNote: () => void;
}) {
  return (
    <section aria-labelledby="feedback-title" className="flex flex-col gap-8">
      <div className="flex items-center gap-4" role="status">
        <DrawnCheck className="size-14" />
        <div>
          <p className="text-2xl font-black tracking-[-0.035em]">Done</p>
          <p className="text-[15px] text-muted tabular">
            {exerciseName} · {doneCount} of {total} complete
          </p>
        </div>
      </div>

      <div>
        <h1 id="feedback-title" data-step-heading tabIndex={-1} className="text-[2rem] leading-none font-black tracking-[-0.04em] outline-none">
          How did that feel?
        </h1>
        <p className="mt-2 text-[15px] text-muted">One tap. {clinicianFirstName ?? "Your physio"} sees this.</p>
      </div>

      <div role="group" aria-label="How did that feel?" className="grid grid-cols-2 gap-3">
        {RATINGS.map(({ key, hint }) => (
          <button
            key={key}
            type="button"
            onClick={() => onRate(key)}
            className={cn(
              "group flex min-h-28 flex-col items-start justify-between rounded-[14px] border-2 p-4 text-left transition-[background-color,border-color,transform] duration-150 ease-[var(--ease-form)] active:scale-[0.98]",
              key === "painful"
                ? "border-danger/35 bg-danger-soft/40 hover:border-danger hover:bg-danger-soft"
                : "border-line bg-surface hover:border-ink",
            )}
          >
            <RatingGlyph rating={key} />
            <span>
              <span className={cn("block text-xl font-bold tracking-[-0.02em]", key === "painful" && "text-danger")}>
                {RATING_LABEL[key]}
              </span>
              <span className="block text-[13px] text-muted">{hint}</span>
            </span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onAddNote}
        className="-mt-2 self-start rounded-md py-2 text-[15px] font-medium text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink"
      >
        Add a note for {clinicianFirstName ?? "your physio"}
      </button>
    </section>
  );
}

/** Simple, physical marks — not emoji, not faces. Effort as a rising bar. */
function RatingGlyph({ rating }: { rating: RatingKey }) {
  const filled = { easy: 1, good: 2, hard: 3, painful: 0 }[rating];
  if (rating === "painful") {
    return (
      <span aria-hidden className="inline-flex size-7 items-center justify-center rounded-full border-2 border-danger text-danger">
        <span className="font-mono text-sm font-bold">!</span>
      </span>
    );
  }
  return (
    <span aria-hidden className="flex h-7 items-end gap-[3px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className={cn("w-1.5 rounded-full", i < filled ? "bg-ink" : "bg-line-strong")}
          style={{ height: `${10 + i * 7}px` }}
        />
      ))}
    </span>
  );
}

/**
 * "Want to tell Marina a little more?" — optional, three ways out, no triage.
 * mode "pain" offers location chips; mode "note" is just a note.
 */
export function MoreSheet({
  open,
  mode,
  clinicianFirstName,
  onSend,
  onNotNow,
}: {
  open: boolean;
  mode: "pain" | "note";
  clinicianFirstName: string | null;
  onSend: (input: { rating: RatingKey; painLocation: string | null; note: string | null }) => void;
  onNotNow: () => void;
}) {
  const [location, setLocation] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [rating, setRating] = useState<RatingKey | null>(mode === "pain" ? "painful" : null);
  const name = clinicianFirstName ?? "your physio";
  const hasNote = note.trim().length > 0;
  const canSend = mode === "pain" || (hasNote && rating !== null);

  return (
    <Sheet
      open={open}
      onClose={onNotNow}
      title={mode === "pain" ? `Want to tell ${name} a little more?` : `Add a note for ${name}`}
      description={
        mode === "pain" ? "Optional. Your Painful rating is recorded either way." : `It goes to ${name} with this exercise attached.`
      }
      footer={
        <div className="flex flex-col gap-2">
          <Button
            variant="dark"
            size="lg"
            block
            disabled={!canSend}
            onClick={() => onSend({ rating: rating ?? "painful", painLocation: location, note: hasNote ? note.trim() : null })}
          >
            Send
          </Button>
          {mode === "pain" ? (
            <Button
              variant="secondary"
              size="lg"
              block
              onClick={() => onSend({ rating: "painful", painLocation: location, note: null })}
            >
              Send without a note
            </Button>
          ) : null}
          <Button variant="ghost" size="lg" block onClick={onNotNow}>
            Not now
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-6">
        {mode === "note" ? (
          <fieldset>
            <legend className="text-[15px] font-semibold">How did it feel?</legend>
            <div role="radiogroup" aria-label="How did it feel?" className="mt-3 grid grid-cols-3 gap-2">
              {(["easy", "good", "hard"] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={rating === key}
                  onClick={() => setRating(key)}
                  className={cn(
                    "h-12 rounded-[10px] border text-[15px] font-semibold transition-colors",
                    rating === key ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:border-ink",
                  )}
                >
                  {RATING_LABEL[key]}
                </button>
              ))}
            </div>
            <p className="mt-2 text-[13px] text-muted">If it hurt, close this and choose Painful instead.</p>
          </fieldset>
        ) : null}
        {mode === "pain" ? (
          <fieldset>
            <legend className="text-[15px] font-semibold">Where did it hurt?</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAIN_LOCATIONS.map((place) => {
                const selected = location === place;
                return (
                  <button
                    key={place}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => setLocation(selected ? null : place)}
                    className={cn(
                      "inline-flex h-11 items-center rounded-full border px-4 text-[15px] font-medium transition-colors",
                      selected ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface hover:border-ink",
                    )}
                  >
                    {place}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="feedback-note" className="text-[15px] font-semibold">
            {mode === "pain" ? "Add a note" : "Your note"} <span className="font-normal text-muted">(optional)</span>
          </label>
          <Textarea
            id="feedback-note"
            value={note}
            maxLength={1000}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything your physio should know?"
            rows={3}
          />
          <p className="text-[13px] text-muted">For example: left side felt tighter, or couldn&apos;t finish the final set.</p>
        </div>
      </div>
    </Sheet>
  );
}

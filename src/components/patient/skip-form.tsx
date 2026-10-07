"use client";

import { useId, useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";
import { SKIP_REASON_LABEL, type SkipReasonKey } from "@/lib/labels";
import { Textarea } from "@/components/ui/field";

export const SKIP_REASONS = Object.keys(SKIP_REASON_LABEL) as SkipReasonKey[];

/** Large, tappable reason options. A radiogroup, keyboard friendly. */
export function ReasonOptions({
  value,
  onChange,
  label,
  compact,
}: {
  value: SkipReasonKey | null;
  onChange: (reason: SkipReasonKey) => void;
  label: string;
  compact?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn(compact ? "flex flex-wrap gap-2" : "grid gap-2")}>
      {SKIP_REASONS.map((reason) => {
        const selected = value === reason;
        return (
          <button
            key={reason}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(reason)}
            className={cn(
              "flex items-center justify-between gap-3 rounded-[12px] border text-left font-medium transition-colors duration-150",
              compact ? "min-h-11 px-4 text-[15px]" : "min-h-14 px-4 text-base",
              selected ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink",
            )}
          >
            {SKIP_REASON_LABEL[reason]}
            {!compact ? (
              <span
                aria-hidden
                className={cn(
                  "inline-flex size-6 items-center justify-center rounded-full border",
                  selected ? "border-paper bg-paper text-ink" : "border-line-strong",
                )}
              >
                {selected ? <Check className="size-3.5" strokeWidth={3} /> : null}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function OptionalNote({
  value,
  onChange,
  clinicianFirstName,
}: {
  value: string;
  onChange: (value: string) => void;
  clinicianFirstName: string | null;
}) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Tell {clinicianFirstName ?? "your physio"} <span className="font-normal text-muted">(optional)</span>
      </label>
      <Textarea
        id={id}
        value={value}
        maxLength={1000}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything your physio should know?"
        rows={3}
      />
    </div>
  );
}

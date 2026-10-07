"use client";

import { useEffect, useId, useState, forwardRef } from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEK_ORDER, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "@/lib/dates";

/** Numeric stepper: − value +. Typing is allowed; the value clamps on blur. */
export const Stepper = forwardRef<
  HTMLInputElement,
  {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step?: number | ((value: number, dir: 1 | -1) => number);
    suffix?: string;
    hideLabel?: boolean;
  }
>(function Stepper({ label, value, onChange, min, max, step = 1, suffix, hideLabel }, ref) {
  const id = useId();
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const clamp = (n: number) => Math.min(max, Math.max(min, n));
  const next = (dir: 1 | -1) => (typeof step === "function" ? step(value, dir) : value + dir * step);

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-sm font-medium text-ink", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="inline-flex h-11 items-stretch overflow-hidden rounded-md border border-line-strong bg-white focus-within:border-ink">
        <button
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(next(-1)))}
          disabled={value <= min}
          className="inline-flex w-10 items-center justify-center text-ink transition-colors hover:bg-sunken disabled:opacity-35"
        >
          <Minus aria-hidden className="size-4" />
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-center gap-1 border-x border-line">
          <input
            ref={ref}
            id={id}
            inputMode="numeric"
            pattern="[0-9]*"
            value={text}
            onChange={(e) => {
              const raw = e.target.value.replace(/[^0-9]/g, "");
              setText(raw);
              const n = Number(raw);
              if (raw && n >= min && n <= max) onChange(n);
            }}
            onBlur={() => {
              const n = Number(text);
              const v = text && Number.isFinite(n) ? clamp(n) : value;
              setText(String(v));
              if (v !== value) onChange(v);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp") {
                e.preventDefault();
                onChange(clamp(next(1)));
              } else if (e.key === "ArrowDown") {
                e.preventDefault();
                onChange(clamp(next(-1)));
              }
            }}
            className="w-12 bg-transparent text-center text-[17px] font-semibold tabular text-ink focus:outline-none"
          />
          {suffix ? <span aria-hidden className="text-sm text-muted">{suffix}</span> : null}
        </div>
        <button
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          onClick={() => onChange(clamp(next(1)))}
          disabled={value >= max}
          className="inline-flex w-10 items-center justify-center text-ink transition-colors hover:bg-sunken disabled:opacity-35"
        >
          <Plus aria-hidden className="size-4" />
        </button>
      </div>
    </div>
  );
});

/** Mon–Sun toggle buttons (aria-pressed). `allowed` limits choices to a subset. */
export function DayToggles({
  label,
  value,
  onChange,
  allowed,
  size = "md",
}: {
  label: string;
  value: number[];
  onChange: (days: number[]) => void;
  allowed?: number[];
  size?: "sm" | "md";
}) {
  const set = new Set(value);
  return (
    <div role="group" aria-label={label} className="flex gap-1">
      {WEEK_ORDER.map((day) => {
        const disabled = allowed ? !allowed.includes(day) : false;
        const on = set.has(day);
        return (
          <button
            key={day}
            type="button"
            aria-pressed={on}
            aria-label={WEEKDAYS_LONG[day]}
            title={WEEKDAYS_LONG[day]}
            disabled={disabled}
            onClick={() => {
              const next = new Set(set);
              if (on) next.delete(day);
              else next.add(day);
              onChange([...next].sort((a, b) => a - b));
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-md border font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-30",
              size === "md" ? "h-10 min-w-10 flex-1 text-[13px]" : "h-8 min-w-8 flex-1 text-xs",
              on ? "border-ink bg-ink text-paper" : "border-line-strong bg-white text-ink hover:border-ink",
            )}
          >
            <span aria-hidden className="sm:hidden">{WEEKDAYS_SHORT[day].slice(0, 1)}</span>
            <span aria-hidden className="hidden sm:inline">{WEEKDAYS_SHORT[day]}</span>
          </button>
        );
      })}
    </div>
  );
}

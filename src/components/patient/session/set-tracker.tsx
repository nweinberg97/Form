"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/dosage";

/**
 * Optional set tracking. The primary action is always "Complete exercise";
 * this is for people who like to count. Each marker is a toggle.
 */
export function SetTracker({
  sets,
  done,
  onChange,
}: {
  sets: number;
  done: number;
  onChange: (done: number) => void;
}) {
  if (sets <= 1) return null;
  return (
    <div>
      <p id="set-tracker-label" className="kicker text-muted">
        Track your sets <span className="normal-case tracking-normal">(optional)</span>
      </p>
      <div role="group" aria-labelledby="set-tracker-label" className="mt-2.5 flex flex-wrap gap-2">
        {Array.from({ length: sets }, (_, i) => {
          const pressed = i < done;
          return (
            <button
              key={i}
              type="button"
              aria-pressed={pressed}
              aria-label={`Set ${i + 1}${pressed ? ", done" : ""}`}
              onClick={() => onChange(pressed && i === done - 1 ? i : i + 1)}
              className={cn(
                "inline-flex h-12 min-w-12 items-center justify-center gap-1.5 rounded-[10px] border px-3 font-mono text-[15px] font-medium tabular transition-colors duration-150",
                pressed ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface text-ink hover:border-ink",
              )}
            >
              {pressed ? <Check aria-hidden className="size-4" strokeWidth={3} /> : null}
              {String(i + 1).padStart(2, "0")}
            </button>
          );
        })}
      </div>
    </div>
  );
}

type TimerState = "idle" | "running" | "paused" | "done";

/**
 * A built-in hold timer for timed exercises. Big, readable at arm's length,
 * announced politely at the start, near the end and on completion.
 */
export function HoldTimer({
  seconds,
  perSide,
  onFinished,
}: {
  seconds: number;
  perSide: boolean;
  onFinished: () => void;
}) {
  const [state, setState] = useState<TimerState>("idle");
  const [remainingMs, setRemainingMs] = useState(seconds * 1000);
  const [announcement, setAnnouncement] = useState("");
  const endAt = useRef(0);
  const frame = useRef<number | null>(null);
  const lastWhole = useRef(seconds);
  const finished = useRef(onFinished);
  finished.current = onFinished;

  useEffect(() => {
    if (state !== "running") return;
    const tick = () => {
      const left = Math.max(0, endAt.current - Date.now());
      setRemainingMs(left);
      const whole = Math.ceil(left / 1000);
      if (whole !== lastWhole.current) {
        lastWhole.current = whole;
        if (whole === 10 && seconds > 15) setAnnouncement("10 seconds left");
        else if (whole <= 3 && whole > 0) setAnnouncement(String(whole));
      }
      if (left <= 0) {
        setState("done");
        setAnnouncement(perSide ? "Hold complete. Switch sides when you're ready." : "Hold complete. Nice and easy.");
        if (typeof navigator !== "undefined" && "vibrate" in navigator) navigator.vibrate?.(120);
        finished.current();
        return;
      }
      frame.current = window.requestAnimationFrame(tick);
    };
    frame.current = window.requestAnimationFrame(tick);
    return () => {
      if (frame.current) window.cancelAnimationFrame(frame.current);
    };
  }, [state, seconds, perSide]);

  const start = () => {
    const ms = state === "paused" ? remainingMs : seconds * 1000;
    endAt.current = Date.now() + ms;
    lastWhole.current = Math.ceil(ms / 1000);
    setRemainingMs(ms);
    setState("running");
    setAnnouncement(state === "paused" ? "Resumed" : `Hold started, ${formatDuration(seconds)}`);
  };
  const pause = () => {
    setState("paused");
    setAnnouncement("Paused");
  };
  const reset = () => {
    setState("idle");
    setRemainingMs(seconds * 1000);
    setAnnouncement("Timer reset");
  };

  const whole = Math.ceil(remainingMs / 1000);
  const pct = 1 - remainingMs / (seconds * 1000);
  const display = whole >= 60 ? `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}` : String(whole);

  return (
    <section aria-label="Hold timer" className="rounded-[14px] border border-line bg-surface p-4">
      <div className="flex items-center gap-4">
        <div className="relative size-20 shrink-0">
          <svg viewBox="0 0 80 80" className="size-full -rotate-90" aria-hidden>
            <circle cx="40" cy="40" r="35" fill="none" strokeWidth="5" className="stroke-line" />
            <circle
              cx="40"
              cy="40"
              r="35"
              fill="none"
              strokeWidth="5"
              strokeLinecap="round"
              className={cn(state === "done" ? "stroke-ink" : "stroke-signal")}
              strokeDasharray={2 * Math.PI * 35}
              strokeDashoffset={2 * Math.PI * 35 * (1 - (state === "idle" ? 0 : pct))}
            />
          </svg>
          <span aria-hidden className="absolute inset-0 flex items-center justify-center font-mono text-2xl font-semibold tabular">
            {state === "done" ? <Check className="size-7" strokeWidth={3} /> : display}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold">
            {state === "done"
              ? "Hold complete"
              : state === "running"
                ? "Hold steady, breathe easy"
                : state === "paused"
                  ? "Paused"
                  : `${formatDuration(seconds)} hold${perSide ? " each side" : ""}`}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {state === "running" ? (
              <TimerButton onClick={pause} icon={<Pause className="size-4" />}>
                Pause
              </TimerButton>
            ) : (
              <TimerButton onClick={start} icon={<Play className="size-4" />} primary>
                {state === "paused" ? "Resume" : state === "done" ? "Start again" : `Start ${formatDuration(seconds)}`}
              </TimerButton>
            )}
            {state !== "idle" ? (
              <TimerButton onClick={reset} icon={<RotateCcw className="size-4" />}>
                Reset
              </TimerButton>
            ) : null}
          </div>
        </div>
      </div>
      <p className="sr-only" aria-live="polite" aria-atomic>
        {announcement}
      </p>
    </section>
  );
}

function TimerButton({
  onClick,
  icon,
  children,
  primary,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center gap-2 rounded-md px-4 text-[15px] font-semibold transition-colors",
        primary ? "bg-ink text-paper hover:bg-ink-soft" : "border border-line-strong text-ink hover:border-ink",
      )}
    >
      <span aria-hidden>{icon}</span>
      {children}
    </button>
  );
}

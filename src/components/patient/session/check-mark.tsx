"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

/** A controlled check that draws itself once. No bounce, no confetti. */
export function DrawnCheck({ className, tone = "ink" }: { className?: string; tone?: "ink" | "paper" | "signal" }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setDrawn(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);
  const length = 30;
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex items-center justify-center rounded-full transition-[transform,background-color] duration-300 ease-[var(--ease-form)]",
        tone === "ink" && "bg-ink text-paper",
        tone === "paper" && "bg-paper text-ink",
        tone === "signal" && "bg-signal text-ink",
        drawn ? "scale-100" : "scale-90",
        className,
      )}
    >
      <svg viewBox="0 0 24 24" className="size-[55%]" fill="none">
        <path
          d="M5 12.5 10 17 19 7.5"
          stroke="currentColor"
          strokeWidth="2.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray={length}
          strokeDashoffset={drawn ? 0 : length}
          style={{ transition: "stroke-dashoffset 480ms cubic-bezier(0.2, 0.7, 0.1, 1) 80ms" }}
        />
      </svg>
    </span>
  );
}

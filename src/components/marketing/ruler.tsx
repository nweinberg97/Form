import { cn } from "@/lib/cn";

/**
 * A coordinate ruler: a hairline with ticks and mono labels.
 * Part of FORM's alignment language. Decorative.
 */
export function Ruler({ className, labels = ["000", "040", "080", "120", "160", "200", "240", "280", "320"], tone = "dark" }: { className?: string; labels?: string[]; tone?: "dark" | "light" }) {
  return (
    <div aria-hidden className={cn("relative select-none", className)}>
      <div className={cn("h-px w-full", tone === "dark" ? "bg-paper/25" : "bg-ink/20")} />
      <div className="flex justify-between">
        {labels.map((label, i) => (
          <span key={label + i} className="flex flex-col items-center">
            <span className={cn("h-2 w-px", tone === "dark" ? "bg-paper/35" : "bg-ink/30", i === Math.floor(labels.length / 2) && "h-3 bg-signal")} />
            <span className={cn("mt-1.5 font-mono text-[10px] tracking-[0.08em]", tone === "dark" ? "text-night-muted" : "text-muted", i % 2 === 1 && "hidden sm:inline")}>
              {label}
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Card({
  className,
  tone = "surface",
  padded = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: "surface" | "paper" | "dark" | "outline"; padded?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-[14px]",
        tone === "surface" && "bg-surface border border-line",
        tone === "paper" && "bg-paper",
        tone === "outline" && "border border-line",
        tone === "dark" && "bg-ink text-paper on-dark",
        padded && "p-5",
        className,
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  kicker,
  action,
  className,
  as: As = "h2",
}: {
  title: ReactNode;
  kicker?: ReactNode;
  action?: ReactNode;
  className?: string;
  as?: "h1" | "h2" | "h3";
}) {
  return (
    <div className={cn("flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {kicker ? <div className="kicker mb-1.5 text-muted">{kicker}</div> : null}
        <As className="text-lg font-semibold tracking-[-0.015em]">{title}</As>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-line", className)} />;
}

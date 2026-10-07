import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type Tone = "neutral" | "dark" | "signal" | "success" | "warning" | "danger" | "blue" | "outline";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink",
  dark: "bg-ink text-paper",
  signal: "bg-signal-soft text-ink",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning-ink",
  danger: "bg-danger-soft text-danger",
  blue: "bg-blue-soft text-blue",
  outline: "border border-line-strong text-muted",
};

export function Badge({
  tone = "neutral",
  children,
  className,
  icon,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-[5px] px-2 text-xs font-semibold whitespace-nowrap",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}

/** A small status dot that never carries meaning on its own — always pair it with text. */
export function Dot({ tone = "neutral", className }: { tone?: Tone; className?: string }) {
  const color: Record<Tone, string> = {
    neutral: "bg-line-strong",
    dark: "bg-ink",
    signal: "bg-signal",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
    blue: "bg-blue",
    outline: "border border-line-strong",
  };
  return <span aria-hidden className={cn("inline-block size-2 shrink-0 rounded-full", color[tone], className)} />;
}

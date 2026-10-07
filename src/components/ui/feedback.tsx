import type { ReactNode } from "react";
import { CircleAlert, Info, TriangleAlert, CircleCheck } from "lucide-react";
import { cn } from "@/lib/cn";

export function EmptyState({
  title,
  description,
  action,
  className,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-line-strong px-6 py-8",
        className,
      )}
    >
      {icon ? <div className="text-muted">{icon}</div> : null}
      <div>
        <p className="text-base font-semibold tracking-[-0.01em]">{title}</p>
        {description ? <p className="mt-1 max-w-prose text-[15px] text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-md bg-sunken", className)} />;
}

export function Alert({
  tone = "info",
  title,
  children,
  action,
  className,
}: {
  tone?: "info" | "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  const Icon = { info: Info, success: CircleCheck, warning: TriangleAlert, danger: CircleAlert }[tone];
  return (
    <div
      role={tone === "danger" ? "alert" : undefined}
      className={cn(
        "flex gap-3 rounded-[12px] px-4 py-3.5",
        tone === "info" && "bg-sunken text-ink",
        tone === "success" && "bg-success-soft text-ink",
        tone === "warning" && "bg-warning-soft text-ink",
        tone === "danger" && "bg-danger-soft text-ink",
        className,
      )}
    >
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-[18px] shrink-0",
          tone === "info" && "text-muted",
          tone === "success" && "text-success",
          tone === "warning" && "text-warning-ink",
          tone === "danger" && "text-danger",
        )}
      />
      <div className="min-w-0 flex-1 text-[15px]">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className={cn(title && "mt-0.5", "text-ink/80")}>{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

/** Linear progress. Always accompanied by visible text for screen readers. */
export function ProgressBar({
  value,
  max,
  label,
  tone = "signal",
  className,
}: {
  value: number;
  max: number;
  label: string;
  tone?: "signal" | "ink" | "light";
  className?: string;
}) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      className={cn("h-1.5 w-full overflow-hidden rounded-full", tone === "light" ? "bg-night-line" : "bg-sunken", className)}
    >
      <div
        className={cn(
          "h-full rounded-full transition-[width] duration-500 ease-[var(--ease-form)]",
          tone === "signal" && "bg-signal",
          tone === "ink" && "bg-ink",
          tone === "light" && "bg-paper",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Segmented progress — one segment per exercise. */
export function StepProgress({
  total,
  done,
  current,
  label,
  className,
  dark,
}: {
  total: number;
  done: number;
  current?: number;
  label: string;
  className?: string;
  dark?: boolean;
}) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-valuenow={done}
      className={cn("flex w-full gap-1", className)}
    >
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1 flex-1 rounded-full transition-colors duration-500",
            i < done ? (dark ? "bg-paper" : "bg-ink") : i === current ? "bg-signal" : dark ? "bg-night-line" : "bg-line",
          )}
        />
      ))}
    </div>
  );
}

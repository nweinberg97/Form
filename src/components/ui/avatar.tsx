import { cn } from "@/lib/cn";

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "·";
  const first = parts[0][0] ?? "";
  const last = parts.length > 1 ? parts[parts.length - 1][0] : "";
  return (first + last).toUpperCase();
}

export function Avatar({
  name,
  size = "md",
  tone = "light",
  className,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  tone?: "light" | "dark" | "signal";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-semibold tracking-tight select-none",
        size === "sm" && "size-7 text-[11px]",
        size === "md" && "size-9 text-xs",
        size === "lg" && "size-14 text-base",
        tone === "light" && "bg-sunken text-ink",
        tone === "dark" && "bg-ink text-paper",
        tone === "signal" && "bg-signal text-ink",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}

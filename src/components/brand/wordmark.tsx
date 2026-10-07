import { cn } from "@/lib/cn";

/**
 * The FORM wordmark. Pure typography: heavy grotesk, tight tracking,
 * with the signature Signal bar — a single aligned stroke that reads as
 * "in form": straight, deliberate, ready.
 */
export function Wordmark({
  className,
  tone = "ink",
  size = "md",
  bar = true,
}: {
  className?: string;
  tone?: "ink" | "paper";
  size?: "sm" | "md" | "lg" | "xl";
  bar?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-baseline font-black leading-none tracking-[-0.06em] select-none",
        tone === "ink" ? "text-ink" : "text-paper",
        size === "sm" && "text-lg",
        size === "md" && "text-2xl",
        size === "lg" && "text-4xl",
        size === "xl" && "text-7xl",
        className,
      )}
    >
      <span aria-hidden>FORM</span>
      {bar ? (
        <span
          aria-hidden
          className={cn(
            "ml-[0.08em] inline-block bg-signal",
            size === "sm" && "h-[3px] w-[0.55em]",
            size === "md" && "h-[4px] w-[0.55em]",
            size === "lg" && "h-[6px] w-[0.55em]",
            size === "xl" && "h-[10px] w-[0.55em]",
          )}
        />
      ) : null}
      <span className="sr-only">FORM</span>
    </span>
  );
}

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "light";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap select-none transition-[background-color,color,border-color,transform,opacity] duration-150 ease-[var(--ease-form)] active:scale-[0.985] disabled:pointer-events-none disabled:opacity-45";

const variants: Record<Variant, string> = {
  // Signal is the action language. Ink text keeps it AA-accessible.
  primary: "bg-signal text-ink hover:bg-signal-deep",
  dark: "bg-ink text-paper hover:bg-ink-soft",
  secondary: "border border-line-strong bg-transparent text-ink hover:border-ink hover:bg-white/60",
  ghost: "bg-transparent text-ink hover:bg-sunken",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger-soft",
  light: "bg-paper text-ink hover:bg-white",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-md",
  md: "h-11 px-4 text-[15px] rounded-md",
  lg: "h-13 px-6 text-base rounded-[10px]",
  xl: "h-16 px-7 text-lg rounded-[10px] tracking-[-0.01em]",
};

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  block?: boolean;
  loading?: boolean;
  icon?: ReactNode;
};

export function buttonClasses({
  variant = "primary",
  size = "md",
  block,
  className,
}: { variant?: Variant; size?: Size; block?: boolean; className?: string } = {}) {
  return cn(base, variants[variant], sizes[size], block && "w-full", className);
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, loading, icon, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={buttonClasses({ variant, size, block, className })}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant,
  size,
  block,
  className,
  children,
  icon,
  ...props
}: {
  href: string;
  variant?: Variant;
  size?: Size;
  block?: boolean;
  className?: string;
  children: ReactNode;
  icon?: ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  return (
    <Link href={href} className={buttonClasses({ variant, size, block, className })} {...props}>
      {icon}
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current border-r-transparent",
        className,
      )}
    />
  );
}

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; tone?: "light" | "dark"; size?: "sm" | "md" }
>(function IconButton({ label, tone = "light", size = "md", className, children, type = "button", ...props }, ref) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md transition-colors duration-150 disabled:opacity-40",
        size === "md" ? "size-11" : "size-9",
        tone === "light" ? "text-ink hover:bg-sunken" : "text-paper hover:bg-night-line",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
});

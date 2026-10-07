"use client";

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/cn";

const SELECT_ARROW = `bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23111' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")]`;
const CHECKBOX_CLASS = `mt-0.5 size-5 shrink-0 cursor-pointer appearance-none rounded-[5px] border border-line-strong bg-white transition-colors checked:border-ink checked:bg-ink checked:bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23F4F2ED' stroke-width='3'%3E%3Cpath d='M5 12.5 10 17 19 7'/%3E%3C/svg%3E")] checked:bg-[length:14px] checked:bg-center checked:bg-no-repeat`;

const control =
  "w-full rounded-md border border-line-strong bg-white px-3.5 text-[15px] text-ink placeholder:text-faint transition-colors duration-150 hover:border-ink/50 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ink aria-[invalid=true]:border-danger";

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
  optional,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
  optional?: boolean;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-sm font-medium text-ink">
        {label}
        {optional ? <span className="ml-1.5 font-normal text-muted">Optional</span> : null}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(control, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, rows = 3, ...props }, ref) {
    return <textarea ref={ref} rows={rows} className={cn(control, "resize-y py-3 leading-relaxed", className)} {...props} />;
  },
);

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        control,
        "h-12 appearance-none bg-[length:16px] bg-[right_12px_center] bg-no-repeat pr-10",
        SELECT_ARROW,
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
});

export const SearchInput = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; shortcut?: string }
>(function SearchInput({ className, label, shortcut, ...props }, ref) {
  return (
    <div className={cn("relative", className)}>
      <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" />
      <input
        ref={ref}
        type="search"
        aria-label={label}
        placeholder={label}
        className={cn(control, "h-11 pl-10", shortcut && "pr-12")}
        {...props}
      />
      {shortcut ? (
        <kbd className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 rounded border border-line px-1.5 font-mono text-[11px] text-muted">
          {shortcut}
        </kbd>
      ) : null}
    </div>
  );
});

export function Checkbox({
  label,
  description,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: ReactNode; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={props.id ?? id} className={cn("flex cursor-pointer items-start gap-3", className)}>
      <input
        id={props.id ?? id}
        type="checkbox"
        className={CHECKBOX_CLASS}
        {...props}
      />
      <span className="flex flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function Toggle({
  label,
  description,
  checked,
  onChange,
  name,
  disabled,
}: {
  label: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  name?: string;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-6">
      <label htmlFor={id} className="flex min-w-0 flex-col">
        <span className="text-[15px] text-ink">{label}</span>
        {description ? <span className="text-sm text-muted">{description}</span> : null}
      </label>
      <button
        id={id}
        role="switch"
        type="button"
        name={name}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-50",
          checked ? "bg-ink" : "bg-line-strong",
        )}
      >
        <span
          aria-hidden
          className={cn(
            "absolute top-1 left-1 size-5 rounded-full bg-paper transition-transform duration-200 ease-[var(--ease-form)]",
            checked && "translate-x-5",
          )}
        />
      </button>
    </div>
  );
}

/** A row of mutually exclusive, large, touch-friendly options. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-md bg-sunken p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-[7px] px-3 font-medium transition-colors duration-150",
            size === "md" ? "h-9 text-sm" : "h-7 text-xs",
            value === option.value ? "bg-white text-ink shadow-[0_1px_2px_rgb(17_17_17/0.08)]" : "text-muted hover:text-ink",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

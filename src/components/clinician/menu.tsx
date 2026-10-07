"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/cn";

export type MenuItem = { label: string; onSelect: () => void; icon?: ReactNode; tone?: "danger"; disabled?: boolean };

/** A small accessible overflow menu: arrow keys move, Esc closes and returns focus. */
export function OverflowMenu({ label, items, className }: { label: string; items: MenuItem[]; className?: string }) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const id = useId();

  useEffect(() => {
    if (!open) return;
    const first = listRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])");
    first?.focus();
    const onDown = (e: MouseEvent) => {
      if (!listRef.current?.contains(e.target as Node) && !buttonRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const close = (focus = true) => {
    setOpen(false);
    if (focus) buttonRef.current?.focus();
  };

  return (
    <div className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        title={label}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className="inline-flex size-11 items-center justify-center rounded-md border border-line-strong text-ink transition-colors hover:border-ink hover:bg-white/60"
      >
        <MoreHorizontal aria-hidden className="size-5" />
      </button>
      {open ? (
        <ul
          ref={listRef}
          id={id}
          role="menu"
          aria-label={label}
          onKeyDown={(e) => {
            const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("button:not([disabled])") ?? [])];
            const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
            if (e.key === "Escape") {
              e.preventDefault();
              close();
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              buttons[(index + 1) % buttons.length]?.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              buttons[(index - 1 + buttons.length) % buttons.length]?.focus();
            } else if (e.key === "Tab") {
              setOpen(false);
            }
          }}
          className="absolute right-0 z-[var(--z-sticky)] mt-2 min-w-56 animate-[rise_180ms_var(--ease-form)_both] rounded-[12px] border border-line bg-surface p-1.5 shadow-[var(--shadow-lift)]"
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  close(false);
                  item.onSelect();
                }}
                className={cn(
                  "flex h-10 w-full items-center gap-2.5 rounded-md px-3 text-left text-sm font-medium transition-colors hover:bg-sunken focus:bg-sunken focus:outline-none disabled:opacity-40",
                  item.tone === "danger" ? "text-danger" : "text-ink",
                )}
              >
                {item.icon}
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

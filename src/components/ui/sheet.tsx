"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";
import { IconButton } from "./button";

/**
 * Sheet: a native <dialog> (free focus trap, Esc to close, inert background).
 * - "bottom": slides up on mobile, centered panel from sm and up.
 * - "right": a drawer for clinician detail panes.
 * - "center": a modal.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  side = "bottom",
  size = "md",
  hideTitle,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  side?: "bottom" | "right" | "center";
  size?: "sm" | "md" | "lg";
  hideTitle?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === ref.current) onClose();
      }}
      aria-labelledby="sheet-title"
      className={cn(
        "m-0 max-h-none max-w-none bg-transparent p-0 text-ink backdrop:animate-[fade_200ms_ease-out]",
        "open:flex",
        side === "bottom" && "fixed inset-0 h-full w-full items-end justify-center sm:items-center",
        side === "center" && "fixed inset-0 h-full w-full items-center justify-center p-4",
        side === "right" && "fixed inset-0 h-full w-full justify-end",
      )}
    >
      <div
        className={cn(
          "flex max-h-[92dvh] w-full flex-col bg-paper",
          side === "bottom" &&
            "animate-[rise_320ms_var(--ease-form)_both] rounded-t-[20px] shadow-[var(--shadow-sheet)] safe-bottom sm:rounded-[20px]",
          side === "center" && "animate-[rise_280ms_var(--ease-form)_both] rounded-[20px] shadow-[var(--shadow-lift)]",
          side === "right" && "h-full max-h-none animate-[slide-in_320ms_var(--ease-form)_both] border-l border-line",
          side !== "right" && size === "sm" && "sm:max-w-md",
          side !== "right" && size === "md" && "sm:max-w-lg",
          side !== "right" && size === "lg" && "sm:max-w-2xl",
          side === "right" && size === "sm" && "max-w-md",
          side === "right" && size === "md" && "max-w-xl",
          side === "right" && size === "lg" && "max-w-3xl",
        )}
      >
        <div className={cn("flex items-start justify-between gap-4 px-6 pt-5", hideTitle && "sr-only")}>
          <div className="min-w-0 pt-1.5">
            <h2 id="sheet-title" className="text-xl font-semibold tracking-[-0.02em]">
              {title}
            </h2>
            {description ? <p className="mt-1 text-[15px] text-muted">{description}</p> : null}
          </div>
          <IconButton label="Close" onClick={onClose} className="-mr-2">
            <X className="size-5" />
          </IconButton>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pt-4 pb-6">{children}</div>
        {footer ? <div className="border-t border-line px-6 py-4">{footer}</div> : null}
      </div>
    </dialog>
  );
}

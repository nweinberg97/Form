"use client";

import type { ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

export function ConfirmSheet({
  open,
  onClose,
  title,
  description,
  confirmLabel,
  onConfirm,
  pending,
  tone = "dark",
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  pending?: boolean;
  tone?: "dark" | "danger";
  children?: ReactNode;
}) {
  // Mounted only while open so sibling sheets never share heading ids.
  if (!open) return null;
  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="center"
      size="sm"
      title={title}
      description={description}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button variant={tone === "danger" ? "danger" : "dark"} onClick={onConfirm} loading={pending}>
            {confirmLabel}
          </Button>
        </div>
      }
    >
      {children}
    </Sheet>
  );
}

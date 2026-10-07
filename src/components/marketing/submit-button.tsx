"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

/** A submit button that shows progress while its parent form's action runs. */
export function SubmitButton({
  children,
  pendingLabel,
  ...props
}: Omit<ButtonProps, "type" | "loading"> & { children: ReactNode; pendingLabel?: ReactNode }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {pending && pendingLabel ? pendingLabel : children}
    </Button>
  );
}

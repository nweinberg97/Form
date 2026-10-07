import type { ReactNode } from "react";
import { startDemo } from "@/server/actions/auth";
import { SubmitButton } from "./submit-button";
import { TimezoneInput } from "./timezone-input";
import type { ButtonProps } from "@/components/ui/button";

/** Whether the public demo entry point is switched on for this deployment. */
export function demoEnabled() {
  return process.env.FORM_DEMO_ENABLED !== "false";
}

/**
 * One button that creates (or re-enters) the visitor's private demo clinic
 * as either the patient or the clinician.
 */
export function DemoForm({
  as,
  children,
  variant = "primary",
  size = "lg",
  block,
  className,
  formClassName,
}: {
  as: "patient" | "clinician";
  children: ReactNode;
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  block?: boolean;
  className?: string;
  formClassName?: string;
}) {
  return (
    <form action={startDemo} className={formClassName}>
      <input type="hidden" name="as" value={as} />
      <TimezoneInput />
      <SubmitButton variant={variant} size={size} block={block} className={className} pendingLabel="Setting up your clinic…">
        {children}
      </SubmitButton>
    </form>
  );
}

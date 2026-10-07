"use client";

import { useActionState } from "react";
import { acceptInvite } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";
import { TimezoneInput } from "./timezone-input";

export function InviteForm({ code, email, isPatient }: { code: string; email: string; isPatient: boolean }) {
  const [state, action] = useActionState(acceptInvite, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      <input type="hidden" name="code" value={code} />
      <TimezoneInput />
      <Field label="Email" htmlFor="email" hint={email ? "You can change this if you prefer another address." : undefined}>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          defaultValue={email}
          required
          autoFocus={!email}
        />
      </Field>
      <Field label="Choose a password" htmlFor="password" hint="At least 10 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} autoFocus={Boolean(email)} />
      </Field>
      <SubmitButton size="lg" block pendingLabel="Setting things up…" className="mt-1">
        {isPatient ? "Get started" : "Join your clinic"}
      </SubmitButton>
      <p className="text-sm text-muted">You&rsquo;ll use this email and password to sign in next time.</p>
    </form>
  );
}

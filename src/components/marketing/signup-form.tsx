"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpClinic } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";
import { TimezoneInput } from "./timezone-input";

export function SignupForm() {
  const [state, action] = useActionState(signUpClinic, null);
  return (
    <form action={action} className="flex flex-col gap-5">
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      <div className="grid gap-5 sm:grid-cols-[1fr_7rem]">
        <Field label="Your name" htmlFor="name">
          <Input id="name" name="name" autoComplete="name" required maxLength={80} autoFocus />
        </Field>
        <Field label="Credentials" htmlFor="credentials">
          <Input id="credentials" name="credentials" defaultValue="PT" maxLength={20} />
        </Field>
      </div>
      <Field label="Clinic name" htmlFor="clinic">
        <Input id="clinic" name="clinic" autoComplete="organization" required maxLength={100} />
      </Field>
      <Field label="Work email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Password" htmlFor="password" hint="At least 10 characters.">
        <PasswordInput id="password" name="password" autoComplete="new-password" required minLength={10} />
      </Field>
      <TimezoneInput />
      <SubmitButton size="lg" block pendingLabel="Setting up your clinic…" className="mt-1">
        Create clinic
      </SubmitButton>
      <p className="text-sm text-muted">
        You&rsquo;ll be the clinic admin. Invite colleagues and patients once you&rsquo;re in.
      </p>
      <p className="mt-4 border-t border-line pt-6 text-[15px]">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
          Sign in
        </Link>
      </p>
    </form>
  );
}

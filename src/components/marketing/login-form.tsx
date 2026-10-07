"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signIn } from "@/server/actions/auth";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { PasswordInput } from "./password-input";
import { SubmitButton } from "./submit-button";

export function LoginForm({ demo }: { demo: boolean }) {
  const [state, action] = useActionState(signIn, null);
  return (
    <form action={action} className="flex flex-col gap-5" noValidate>
      {state && !state.ok ? <Alert tone="danger">{state.error}</Alert> : null}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <PasswordInput id="password" name="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton size="lg" block pendingLabel="Signing in…" className="mt-1">
        Sign in
      </SubmitButton>
      <p className="text-sm text-muted">Patients: use the email from your clinic&rsquo;s invite.</p>
      <div className="mt-4 flex flex-col gap-2 border-t border-line pt-6 text-[15px]">
        <p>
          New clinic?{" "}
          <Link href="/signup" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
            Create an account
          </Link>
        </p>
        {demo ? (
          <p className="text-muted">
            Just looking?{" "}
            <Link href="/demo" className="font-medium text-ink underline-offset-4 hover:underline">
              Try the demo
            </Link>
          </p>
        ) : null}
      </div>
    </form>
  );
}

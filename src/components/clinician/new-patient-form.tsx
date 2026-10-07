"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ListPlus } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { createPatient } from "@/server/actions/clinician";
import { CopyLink } from "./copy-link";

export function NewPatientForm() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ patientId: string; inviteUrl: string; name: string; hasEmail: boolean } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  if (created) {
    const first = created.name.split(" ")[0];
    return (
      <div className="animate-rise">
        <div className="flex items-center gap-3">
          <span aria-hidden className="inline-flex size-9 items-center justify-center rounded-full bg-ink text-paper">
            <Check className="size-4" />
          </span>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-black tracking-[-0.035em] focus:outline-none">
            {created.name} is added
          </h2>
        </div>
        <p className="mt-3 text-[15px] text-muted">
          Send {first} this link to set up their account. It works for 14 days.
          {created.hasEmail ? null : " You can add their email later — the link is all they need."}
        </p>
        <div className="mt-5">
          <CopyLink url={created.inviteUrl} label={`Invite link for ${created.name}`} />
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          <ButtonLink
            href={`/clinic/patients/${created.patientId}/program`}
            size="lg"
            icon={<ListPlus aria-hidden className="size-4" />}
          >
            Build their program
          </ButtonLink>
          <ButtonLink href={`/clinic/patients/${created.patientId}`} size="lg" variant="ghost">
            Later
          </ButtonLink>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        setError(null);
        if (!name.trim()) {
          setNameError("Add the patient's name.");
          return;
        }
        setNameError(null);
        start(async () => {
          const result = await createPatient({ name: name.trim(), email: email.trim() });
          if (result.ok) {
            setCreated({ ...result.data, name: name.trim(), hasEmail: Boolean(email.trim()) });
            router.refresh();
            window.setTimeout(() => headingRef.current?.focus(), 30);
          } else setError(result.error);
        });
      }}
      className="flex flex-col gap-5"
    >
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <Field label="Full name" htmlFor="patient-name" error={nameError}>
        <Input
          id="patient-name"
          autoFocus
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          aria-invalid={nameError ? true : undefined}
          maxLength={80}
        />
      </Field>
      <Field label="Email" htmlFor="patient-email" optional hint="We'll give you an invite link to send them.">
        <Input
          id="patient-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          maxLength={200}
        />
      </Field>
      <div className="flex gap-2 pt-2">
        <Button type="submit" size="lg" loading={pending}>
          Add patient
        </Button>
        <Button type="button" size="lg" variant="ghost" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

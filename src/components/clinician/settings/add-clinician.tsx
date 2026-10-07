"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { addClinician } from "@/server/actions/clinician";
import { CopyLink } from "../copy-link";

export function AddClinician() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [credentials, setCredentials] = useState("PT");
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<{ url: string; name: string } | null>(null);
  const [pending, start] = useTransition();

  if (invite) {
    return (
      <div className="rounded-[14px] border border-line bg-surface p-5" role="status">
        <p className="font-semibold">{invite.name} is invited</p>
        <p className="mt-1 text-sm text-muted">Send them this link to set a password. It works for 14 days.</p>
        <div className="mt-4">
          <CopyLink url={invite.url} label={`Invite link for ${invite.name}`} />
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="mt-3"
          onClick={() => {
            setInvite(null);
            setOpen(true);
          }}
        >
          Add another
        </Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button variant="dark" size="sm" onClick={() => setOpen(true)} icon={<UserPlus aria-hidden className="size-4" />}>
        Add clinician
      </Button>
    );
  }

  return (
    <form
      className="flex flex-col gap-4 rounded-[14px] border border-line bg-surface p-5"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const result = await addClinician({ name: name.trim(), email: email.trim(), credentials: credentials.trim() || undefined });
          if (result.ok) {
            setInvite({ url: result.data.inviteUrl, name: name.trim() });
            setName("");
            setEmail("");
            setOpen(false);
            router.refresh();
          } else setError(result.error);
        });
      }}
    >
      <h3 className="text-[15px] font-semibold">Add a clinician</h3>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-[1fr_1fr_120px]">
        <Field label="Name" htmlFor="clin-name">
          <Input id="clin-name" autoFocus required value={name} onChange={(e) => setName(e.target.value)} maxLength={80} className="!h-11" />
        </Field>
        <Field label="Email" htmlFor="clin-email">
          <Input id="clin-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="!h-11" />
        </Field>
        <Field label="Credentials" htmlFor="clin-cred">
          <Input id="clin-cred" value={credentials} onChange={(e) => setCredentials(e.target.value)} maxLength={20} className="!h-11" />
        </Field>
      </div>
      <div className="flex gap-2">
        <Button type="submit" size="sm" variant="dark" loading={pending}>
          Create invite
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

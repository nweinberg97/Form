"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, X } from "lucide-react";
import { dismissNotification, skipDay, startSession } from "@/server/actions/patient";
import type { SkipReasonKey } from "@/lib/labels";
import { cn } from "@/lib/cn";
import { Button, IconButton } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { OptionalNote, ReasonOptions } from "./skip-form";

/** Sticky, thumb-reachable primary action. On md+ it sits in the flow. */
export function StickyAction({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-[var(--z-sticky)] border-t border-line bg-paper/95 px-5 py-3 md:static md:z-auto md:border-0 md:bg-transparent md:p-0">
      <div className="mx-auto max-w-[640px]">{children}</div>
    </div>
  );
}

/**
 * Starts (or resumes / reopens) today's session, then opens the focused flow.
 * startSession is idempotent, so a double tap is harmless.
 */
export function StartButton({
  children,
  variant = "primary",
  size = "xl",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "dark" | "secondary" | "ghost";
  size?: "lg" | "xl" | "md";
  className?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setBusy(true);
    const res = await startSession().catch(() => null);
    if (!res) {
      setBusy(false);
      toast("We couldn't reach FORM. Check your connection and try again.", "error");
      return;
    }
    if (!res.ok) {
      setBusy(false);
      toast(res.error, "error");
      return;
    }
    startTransition(() => router.push("/app/session"));
  };

  return (
    <Button
      variant={variant}
      size={size}
      block
      loading={busy || pending}
      onClick={go}
      className={className}
    >
      {children}
      {busy || pending ? null : <ArrowRight aria-hidden className="size-5" />}
    </Button>
  );
}

/** "Can't do today's session?" — a quiet link into a guilt-free sheet. */
export function SkipToday({ date, clinicianFirstName }: { date: string; clinicianFirstName: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center rounded-md text-[15px] font-medium text-muted underline decoration-line-strong underline-offset-4 hover:text-ink hover:decoration-ink"
      >
        Can&apos;t do today&apos;s session?
      </button>
      <SkipSheet
        open={open}
        onClose={() => setOpen(false)}
        date={date}
        title="Can't do today's session?"
        description="That's okay. Let us know why — missing a day is useful information."
        clinicianFirstName={clinicianFirstName}
      />
    </>
  );
}

export function SkipSheet({
  open,
  onClose,
  date,
  title,
  description,
  clinicianFirstName,
}: {
  open: boolean;
  onClose: () => void;
  date: string;
  title: string;
  description: string;
  clinicianFirstName: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState<SkipReasonKey | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const res = await skipDay({ date, reason, note: note.trim() || null }).catch(() => null);
    setBusy(false);
    if (!res) {
      toast("We couldn't reach FORM. Nothing was changed — try again in a moment.", "error");
      return;
    }
    if (!res.ok) {
      toast(res.error, "error");
      return;
    }
    toast(`Thanks — ${clinicianFirstName ?? "your physio"} will see this.`, "success");
    onClose();
    setReason(null);
    setNote("");
    router.refresh();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      footer={
        <Button variant="dark" size="lg" block loading={busy} disabled={!reason && !note.trim()} onClick={submit}>
          Let {clinicianFirstName ?? "your physio"} know
        </Button>
      }
    >
      <div className="flex flex-col gap-6">
        <ReasonOptions value={reason} onChange={setReason} label="What got in the way?" />
        <OptionalNote value={note} onChange={setNote} clinicianFirstName={clinicianFirstName} />
      </div>
    </Sheet>
  );
}

/** "Didn't get to Monday's session?" — offered once, gently, never added to today. */
export function MissedCard({
  date,
  label,
  clinicianFirstName,
}: {
  date: string;
  label: string;
  clinicianFirstName: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [reason, setReason] = useState<SkipReasonKey | null>(null);
  const [note, setNote] = useState("");
  const [showNote, setShowNote] = useState(false);
  const [busy, setBusy] = useState<"send" | "dismiss" | null>(null);
  const [hidden, setHidden] = useState(false);
  const dayName = label === "Yesterday" ? "yesterday's" : `${label}'s`;

  const send = async (withReason: boolean) => {
    setBusy(withReason ? "send" : "dismiss");
    const res = await skipDay({
      date,
      reason: withReason ? reason : null,
      note: withReason ? note.trim() || null : null,
    }).catch(() => null);
    setBusy(null);
    if (!res || !res.ok) {
      toast(res && !res.ok ? res.error : "We couldn't reach FORM. Try again in a moment.", "error");
      return;
    }
    setHidden(true);
    if (withReason) toast(`Thanks — ${clinicianFirstName ?? "your physio"} will see this.`, "success");
    router.refresh();
  };

  if (hidden) return null;

  return (
    <section aria-labelledby="missed-title" className="rounded-[14px] border border-line bg-surface p-5">
      <h2 id="missed-title" className="text-lg font-semibold tracking-[-0.015em]">
        Didn&apos;t get to {dayName} session?
      </h2>
      <p className="mt-1 text-[15px] text-muted">
        That&apos;s okay. Missing a day is information, not failure. Today&apos;s plan stays as it is.
      </p>
      <div className="mt-4">
        <ReasonOptions value={reason} onChange={setReason} label="What got in the way?" compact />
      </div>
      {showNote ? (
        <div className="mt-4">
          <OptionalNote value={note} onChange={setNote} clinicianFirstName={clinicianFirstName} />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="mt-3 inline-flex min-h-11 items-center text-[15px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink"
        >
          Tell {clinicianFirstName ?? "your physio"} more
        </button>
      )}
      <div className="mt-4 flex gap-2">
        <Button
          variant="dark"
          size="md"
          loading={busy === "send"}
          disabled={(!reason && !note.trim()) || busy !== null}
          onClick={() => send(true)}
        >
          Send
        </Button>
        <Button variant="ghost" size="md" loading={busy === "dismiss"} disabled={busy !== null} onClick={() => send(false)}>
          Not now
        </Button>
      </div>
    </section>
  );
}

export function PlanUpdateBanner({ id, body }: { id: string; body: string }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  const dismiss = async () => {
    setHidden(true);
    await dismissNotification({ id }).catch(() => null);
    router.refresh();
  };
  return (
    <div className="flex items-center gap-3 rounded-[14px] bg-ink py-2 pr-2 pl-4 text-paper on-dark">
      <span aria-hidden className="h-8 w-[3px] shrink-0 rounded-full bg-signal" />
      <Link
        href="/app/program"
        onClick={() => void dismissNotification({ id }).catch(() => null)}
        className="flex min-h-11 min-w-0 flex-1 items-center justify-between gap-3 rounded-md"
      >
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold">{body}</span>
          <span className="block text-[13px] text-night-muted">See what changed</span>
        </span>
        <ArrowRight aria-hidden className="size-4 shrink-0" />
      </Link>
      <IconButton label="Dismiss" tone="dark" onClick={dismiss}>
        <X aria-hidden className="size-4" />
      </IconButton>
    </div>
  );
}

export function QuietLink({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 text-[15px] font-medium underline decoration-line-strong underline-offset-4 hover:decoration-ink",
        className,
      )}
    >
      {children}
    </Link>
  );
}

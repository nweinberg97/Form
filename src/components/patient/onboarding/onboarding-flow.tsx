"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { completeOnboarding } from "@/server/actions/patient";
import { cn } from "@/lib/cn";
import { Wordmark } from "@/components/brand/wordmark";
import { Button, IconButton } from "@/components/ui/button";
import { Field, Input, Toggle } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";

const STEPS = 3;

export function OnboardingFlow({
  initialName,
  clinicianName,
  orgName,
}: {
  initialName: string;
  clinicianName: string | null;
  orgName: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [reminders, setReminders] = useState(true);
  const [time, setTime] = useState("08:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (step > 0) heading.current?.focus({ preventScroll: true });
  }, [step]);

  const finish = async () => {
    setBusy(true);
    let timezone = "UTC";
    try {
      timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    } catch {
      // keep UTC
    }
    const res = await completeOnboarding({
      name: name.trim(),
      notifyReminders: reminders,
      reminderTime: /^\d{2}:\d{2}$/.test(time) ? time : "08:00",
      timezone,
    }).catch(() => null);
    if (!res || !res.ok) {
      setBusy(false);
      toast(res && !res.ok ? res.error : "We couldn't reach FORM. Check your connection and try again.", "error");
      return;
    }
    router.push("/app");
    router.refresh();
  };

  const dots = (
    <ol aria-label={`Step ${step + 1} of ${STEPS}`} className="flex items-center gap-1.5">
      {Array.from({ length: STEPS }, (_, i) => (
        <li
          key={i}
          aria-hidden
          className={cn(
            "h-1.5 rounded-full transition-all duration-300 ease-[var(--ease-form)]",
            i === step ? "w-6 bg-signal" : i < step ? "w-1.5 bg-current" : "w-1.5 bg-current opacity-25",
          )}
        />
      ))}
    </ol>
  );

  if (step === 0) {
    return (
      <main id="main" data-theme="dark" className="on-dark form-grid flex min-h-dvh flex-col bg-night text-paper">
        <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-between px-6 pt-10 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center justify-between">
            <Wordmark tone="paper" size="sm" />
            <span className="text-night-muted">{dots}</span>
          </div>
          <div className="animate-rise py-12">
            <p className="kicker text-night-muted">{orgName}</p>
            <h1 className="mt-4 text-[clamp(3.25rem,15vw,6.5rem)] leading-[0.88] font-black tracking-[-0.055em]">
              Let&apos;s get you back to it.
            </h1>
            <p className="mt-6 max-w-md text-lg text-paper/80">
              {clinicianName ? `${clinicianName} has set up your plan. ` : ""}
              Each day, FORM shows you exactly what to do — and lets your physio know how it went.
            </p>
          </div>
          <Button variant="primary" size="xl" block onClick={() => setStep(1)}>
            Get started
            <ArrowRight aria-hidden className="size-5" />
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main id="main" className="flex min-h-dvh flex-col bg-paper">
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col px-6 pt-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="flex h-14 items-center justify-between">
          <IconButton label="Back" onClick={() => setStep((s) => s - 1)} className="-ml-3">
            <ArrowLeft aria-hidden className="size-5" />
          </IconButton>
          <span className="text-ink">{dots}</span>
        </div>

        {step === 1 ? (
          <form
            key="name"
            className="flex flex-1 animate-slide-in flex-col justify-between"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) {
                setError("Add your name.");
                return;
              }
              setError(null);
              setStep(2);
            }}
          >
            <div className="pt-8">
              <h1 ref={heading} tabIndex={-1} className="text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em] outline-none">
                What should we call you?
              </h1>
              <p className="mt-3 text-[17px] text-muted">This is how your care team sees your name.</p>
              <Field label="Your name" htmlFor="onboarding-name" error={error} className="mt-8">
                <Input
                  id="onboarding-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  className="h-14 text-lg"
                  aria-invalid={error ? true : undefined}
                />
              </Field>
            </div>
            <Button type="submit" variant="primary" size="xl" block className="mt-10">
              Continue
              <ArrowRight aria-hidden className="size-5" />
            </Button>
          </form>
        ) : (
          <div key="reminders" className="flex flex-1 animate-slide-in flex-col justify-between">
            <div className="pt-8">
              <h1 ref={heading} tabIndex={-1} className="text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em] outline-none">
                Want a daily reminder?
              </h1>
              <p className="mt-3 text-[17px] text-muted">
                Only on days you have a session. Short and gentle: “Your rehabilitation is ready.”
              </p>
              <div className="mt-8 flex flex-col gap-6 rounded-[14px] border border-line bg-surface p-5">
                <Toggle label="Remind me" checked={reminders} onChange={setReminders} />
                {reminders ? (
                  <Field label="At" htmlFor="onboarding-time">
                    <Input
                      id="onboarding-time"
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="h-14 max-w-44 text-lg"
                    />
                  </Field>
                ) : null}
              </div>
              <p className="mt-3 text-[13px] text-muted">You can change this any time in your profile.</p>
            </div>
            <Button variant="primary" size="xl" block loading={busy} onClick={finish} className="mt-10">
              See today&apos;s plan
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

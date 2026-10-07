import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, Clock, Lock } from "lucide-react";
import { AuthHeading, AuthShell } from "@/components/marketing/auth-shell";
import { DemoForm, demoEnabled } from "@/components/marketing/demo-form";

// Read FORM_DEMO_ENABLED at request time, not build time.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Try the demo",
  description: "Step into a private, pre-populated sample clinic. See FORM as a patient or as a physiotherapist.",
};

const CHOICES = [
  {
    as: "patient" as const,
    index: "A",
    title: "The patient app",
    who: "You're Jordan, recovering from neck and shoulder pain.",
    body: "Open today's plan, do a session with the movement guides, and tell Marina how it felt.",
    cta: "See the patient app",
    variant: "primary" as const,
  },
  {
    as: "clinician" as const,
    index: "B",
    title: "The clinician app",
    who: "You're Marina Chen, PT, at Northside Physio.",
    body: "See who needs attention, review Jordan's feedback, and adjust a program in a couple of minutes.",
    cta: "See the clinician app",
    variant: "dark" as const,
  },
];

export default function DemoPage() {
  if (!demoEnabled()) {
    return (
      <AuthShell headline={["Move", "better"]} figure="bird-dog" figureIndex="04">
        <AuthHeading kicker="Demo" title="The demo is switched off here.">
          This installation of FORM doesn&rsquo;t offer the public demo. If you have an account, sign in.
        </AuthHeading>
        <p className="border-t border-line pt-6 text-[15px]">
          <Link href="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
            Sign in
          </Link>
          <span className="mx-2 text-faint">·</span>
          <Link href="/" className="font-medium text-ink underline-offset-4 hover:underline">
            Back to home
          </Link>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell headline={["Move", "better"]} figure="bird-dog" figureIndex="04" wide>
      <AuthHeading kicker="Demo" title="See FORM from both sides.">
        A private, pre-populated sample clinic — just for you. Nothing to sign up for.
      </AuthHeading>

      <ul className="grid gap-4 sm:grid-cols-2">
        {CHOICES.map((choice) => (
          <li key={choice.as} className="flex flex-col rounded-[20px] border border-line bg-surface p-6">
            <span className="font-mono text-sm text-muted">{choice.index}</span>
            <h2 className="mt-3 text-2xl font-black tracking-[-0.035em]">{choice.title}</h2>
            <p className="mt-2 text-[15px] font-medium">{choice.who}</p>
            <p className="mt-2 text-[15px] leading-relaxed text-muted">{choice.body}</p>
            <DemoForm as={choice.as} variant={choice.variant} size="lg" block formClassName="mt-auto pt-6">
              {choice.cta}
            </DemoForm>
          </li>
        ))}
      </ul>

      <ul className="mt-8 grid gap-3 text-sm text-muted sm:grid-cols-3">
        <li className="flex gap-2.5">
          <ArrowLeftRight aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
          Switch between Jordan and Marina any time from the bar at the top.
        </li>
        <li className="flex gap-2.5">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
          Your changes stay in your own clinic. Nobody else sees them.
        </li>
        <li className="flex gap-2.5">
          <Clock aria-hidden className="mt-0.5 size-4 shrink-0 text-ink" />
          Everything is sample data, and it resets after 24 hours.
        </li>
      </ul>

      <p className="mt-10 border-t border-line pt-6 text-[15px]">
        Have an account?{" "}
        <Link href="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}

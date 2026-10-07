import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { getCurrentUser, type CurrentUser } from "@/server/auth/session";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { SiteHeader, homeFor } from "@/components/marketing/site-header";
import { SiteFooter } from "@/components/marketing/site-footer";
import { MovementFigure } from "@/components/marketing/movement-figure";
import { Ticker } from "@/components/marketing/ticker";
import { Ruler } from "@/components/marketing/ruler";
import { DemoForm, accountsEnabled, demoEnabled } from "@/components/marketing/demo-form";
import {
  AttentionVignette,
  ExerciseVignette,
  FeedbackVignette,
  ProgramVignette,
  TodayVignette,
} from "@/components/marketing/vignettes";

export const metadata: Metadata = {
  title: { absolute: "FORM — Move better" },
  description: "Your physio's plan, made obvious. FORM turns a rehabilitation program into today's plan, shows you how to do it right, and keeps your physio in the loop.",
};

async function safeCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    // The landing page should never fail because the database is unavailable.
    return null;
  }
}

export default async function LandingPage() {
  const user = await safeCurrentUser();
  const demo = demoEnabled();

  return (
    <div className="relative bg-ink text-paper">
      <div className="on-dark absolute inset-x-0 top-0 z-10">
        <SiteHeader user={user} demo={demo} />
      </div>
      <main id="main">
        <Hero user={user} demo={demo} />
        <Ticker />
        <Shift />
        <Loop />
        <Clinicians />
        <Principles />
        <CallToAction user={user} demo={demo} />
      </main>
      <SiteFooter demo={demo} />
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return <p className={cn("kicker", className)}>{children}</p>;
}

function Hero({ user, demo }: { user: CurrentUser | null; demo: boolean }) {
  return (
    <div className="on-dark form-grid relative overflow-hidden">
      <section aria-labelledby="hero-title" className="relative mx-auto max-w-[1440px] px-5 pt-28 pb-16 sm:px-8 sm:pt-32 lg:px-12 lg:pb-24">
        <div aria-hidden className="flex items-center justify-between text-night-muted">
          <span className="kicker">Fig. 00 — Rehabilitation</span>
          <span className="kicker tabular">X 160 · Y 097</span>
        </div>

        <h1
          id="hero-title"
          className="mt-6 text-[clamp(4.25rem,17vw,16rem)] leading-[0.84] font-black tracking-[-0.055em] uppercase"
        >
          <span className="block animate-rise">Move</span>
          <span className="block animate-rise pl-[0.42em] [animation-delay:90ms]">
            Better<span className="text-signal">.</span>
          </span>
        </h1>

        <Ruler className="mt-10 sm:mt-14" />

        <div className="mt-12 grid items-end gap-12 lg:mt-16 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className="max-w-md text-[clamp(1.5rem,2.6vw,2.25rem)] leading-[1.08] font-semibold tracking-[-0.03em]">
              Your physio&rsquo;s plan, made obvious.
            </p>
            <p className="mt-4 max-w-md text-base leading-relaxed text-night-muted sm:text-lg">
              FORM turns your rehabilitation into one clear thing to do today — shown properly, done properly, with your
              physio in the loop.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              {user ? (
                <ButtonLink href={homeFor(user)} size="lg" icon={<ArrowRight aria-hidden className="size-4" />}>
                  Open FORM
                </ButtonLink>
              ) : (
                <>
                  {demo ? (
                    <ButtonLink href="/demo" size="lg">
                      Try the demo
                    </ButtonLink>
                  ) : null}
{accountsEnabled() ? (
                  <Link
                    href="/login"
                    className="inline-flex h-13 items-center justify-center rounded-[10px] border border-night-line px-6 text-base font-semibold text-paper transition-colors duration-150 hover:border-paper hover:bg-night-raised"
                  >
                    Sign in
                  </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-6 lg:col-start-7">
            <MovementFigure slug="sit-to-stand" index="01" />
          </div>
        </div>
      </section>
    </div>
  );
}

/* ------------------------------------------------------------------ */

function Shift() {
  return (
    <section aria-labelledby="shift-title" className="bg-paper text-ink">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <Kicker className="text-muted">02 — The shift</Kicker>
        <h2 id="shift-title" className="mt-5 text-display font-black uppercase">
          Rehab
          <br />
          should make
          <br />
          sense<span className="text-signal">.</span>
        </h2>

        <div className="mt-16 grid gap-10 lg:grid-cols-12 lg:gap-8">
          <p className="max-w-xl text-xl leading-snug font-medium tracking-[-0.015em] sm:text-2xl lg:col-span-5">
            Most rehab software is organized around the program. People aren&rsquo;t. They think in today:{" "}
            <span className="text-muted">what do I need to do, and how?</span>
          </p>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-7">
            <div className="rounded-[20px] border border-line p-6">
              <p className="kicker text-muted">What you&rsquo;re usually handed</p>
              <ul className="mt-5 space-y-2.5 font-mono text-[13px] leading-relaxed text-muted">
                <li>Program: Neck &amp; shoulder, phase 2</li>
                <li>Frequency: 3×/wk, non-consecutive</li>
                <li>Ex. 1–4 per protocol, see handout</li>
                <li>Progress load as tolerated</li>
                <li>Video links: see email</li>
              </ul>
            </div>
            <div className="rounded-[20px] bg-ink p-6 text-paper">
              <p className="kicker text-night-muted">What FORM shows you</p>
              <p className="mt-5 text-2xl font-semibold tracking-[-0.025em]">Today&rsquo;s rehabilitation</p>
              <p className="mt-1 text-night-muted">4 exercises · about 12 min</p>
              <p className="mt-8 flex items-center gap-2 text-lg font-semibold">
                <span aria-hidden className="h-[3px] w-6 bg-signal" />
                Start.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const BEATS = [
  {
    index: "01",
    title: "Today.",
    body: "Open FORM and see exactly what's planned: these exercises, in this order, for about this long. One tap to start.",
    Vignette: TodayVignette,
  },
  {
    index: "02",
    title: "Do it right.",
    body: "Every exercise carries its own demonstration, a few clear cues, and anything your physio told you specifically.",
    Vignette: ExerciseVignette,
  },
  {
    index: "03",
    title: "Tell your physio.",
    body: "Easy, Good, Hard or Painful — one tap as you finish. Add a note if you want. It lands with the exercise it's about.",
    Vignette: FeedbackVignette,
  },
];

function Loop() {
  return (
    <section aria-labelledby="loop-title" className="on-dark form-grid">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <Kicker className="text-night-muted">03 — The loop</Kicker>
            <h2 id="loop-title" className="mt-5 text-headline font-black uppercase">
              Open. Do it.
              <br />
              Done for today.
            </h2>
          </div>
          <p className="max-w-sm text-night-muted">
            For patients, FORM is three beats. Nothing to manage, nothing to decode.
          </p>
        </div>

        <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-6 lg:gap-10">
          {BEATS.map(({ index, title, body, Vignette }) => (
            <li key={index} className="flex flex-col">
              <div className="flex items-baseline gap-4 border-t border-night-line pt-5">
                <span className="font-mono text-sm text-signal tabular">{index}</span>
                <h3 className="text-3xl font-black tracking-[-0.04em] sm:text-4xl">{title}</h3>
              </div>
              <p className="mt-4 max-w-sm leading-relaxed text-night-muted">{body}</p>
              <div className="mt-8 md:mt-auto md:pt-8">
                <Vignette />
              </div>
            </li>
          ))}
        </ol>
        <p className="kicker mt-8 text-night-muted">Illustrations of the patient app</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function Clinicians() {
  return (
    <section aria-labelledby="clinicians-title" className="form-grid-light bg-paper text-ink">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <Kicker className="text-muted">04 — For physiotherapists</Kicker>
        <h2 id="clinicians-title" className="mt-5 max-w-5xl text-headline font-black">
          See who needs you.
          <br />
          <span className="text-muted">Change what needs changing.</span>
        </h2>

        <div className="mt-16 grid gap-12 lg:grid-cols-2 lg:gap-10">
          <div>
            <div className="flex items-baseline gap-4 border-t border-line-strong pt-5">
              <span className="font-mono text-sm text-muted tabular">A</span>
              <h3 className="text-2xl font-bold tracking-[-0.03em]">Attention, explained.</h3>
            </div>
            <p className="mt-3 max-w-md leading-relaxed text-muted">
              Your day starts with the few patients who need you — each with what actually happened, never a guess at
              what it means.
            </p>
            <div className="mt-8 rounded-[20px] border border-line bg-sunken p-2 sm:p-3">
              <AttentionVignette />
            </div>
          </div>
          <div>
            <div className="flex items-baseline gap-4 border-t border-line-strong pt-5">
              <span className="font-mono text-sm text-muted tabular">B</span>
              <h3 className="text-2xl font-bold tracking-[-0.03em]">Prescribe in minutes.</h3>
            </div>
            <p className="mt-3 max-w-md leading-relaxed text-muted">
              Search first, smart defaults, schedule once. Built so a 4-exercise program takes under two minutes — and
              every change is versioned and shown to your patient.
            </p>
            <div className="mt-8 rounded-[20px] border border-line bg-sunken p-2 sm:p-3">
              <ProgramVignette />
            </div>
          </div>
        </div>
        <p className="kicker mt-8 text-muted">Illustrations of the clinician app</p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

const PRINCIPLES = [
  { line: "Missing a day is information, not failure.", figure: null },
  { line: "Video belongs inside the exercise.", figure: "bird-dog" },
  { line: "No points. No streaks. No guilt.", figure: null },
  { line: "Feedback happens in context.", figure: "glute-bridge" },
];

function Principles() {
  return (
    <section aria-labelledby="principles-title" className="on-dark relative">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <Kicker className="text-night-muted">05 — Principles</Kicker>
        <h2 id="principles-title" className="sr-only">
          What FORM believes
        </h2>
        <ol className="mt-10">
          {PRINCIPLES.map((p, i) => (
            <li key={p.line} className="grid gap-6 border-t border-night-line py-10 sm:py-14 lg:grid-cols-12 lg:items-center lg:gap-8">
              <span aria-hidden className="font-mono text-sm text-night-muted tabular lg:col-span-1">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p
                className={cn(
                  "text-[clamp(2.25rem,6.2vw,5.75rem)] leading-[0.92] font-black tracking-[-0.045em]",
                  p.figure ? "lg:col-span-7" : "lg:col-span-11",
                  i === 2 && "lg:pl-[8.33%]",
                )}
              >
                {p.line}
              </p>
              {p.figure ? (
                <div className="max-w-md lg:col-span-4">
                  <MovementFigure slug={p.figure} index={String(i + 1).padStart(2, "0")} />
                </div>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function CallToAction({ user, demo }: { user: CurrentUser | null; demo: boolean }) {
  return (
    <section aria-labelledby="cta-title" className="bg-paper text-ink">
      <div className="mx-auto max-w-[1440px] px-5 py-20 sm:px-8 sm:py-28 lg:px-12">
        <div className="grid gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <Kicker className="text-muted">06 — {demo ? "Try it" : "Get started"}</Kicker>
            <h2 id="cta-title" className="mt-5 text-display font-black uppercase">
              Get back
              <br />
              to it<span className="text-signal">.</span>
            </h2>
          </div>

          <div className="flex flex-col justify-end lg:col-span-5">
            {user ? (
              <div>
                <p className="text-xl leading-snug font-medium tracking-[-0.015em]">
                  You&rsquo;re signed in{user.isDemo ? " to your demo clinic" : ""}.
                </p>
                <ButtonLink href={homeFor(user)} size="xl" className="mt-6" icon={<ArrowRight aria-hidden className="size-5" />}>
                  Open FORM
                </ButtonLink>
              </div>
            ) : demo ? (
              <div>
                <p className="text-xl leading-snug font-medium tracking-[-0.015em]">
                  Step into a working clinic. Do a session as Jordan, then see it land on Marina&rsquo;s dashboard.
                </p>
                <div className="mt-8 grid gap-3 sm:grid-cols-2">
                  <DemoForm as="patient" size="xl" block>
                    See the patient app
                  </DemoForm>
                  <DemoForm as="clinician" size="xl" block variant="dark">
                    See the clinician app
                  </DemoForm>
                </div>
                <p className="mt-4 text-sm text-muted">A private sample clinic, just for you. Nothing to sign up for.</p>
              </div>
            ) : (
              <div>
                <p className="text-xl leading-snug font-medium tracking-[-0.015em]">
                  Set up your clinic in a minute, then invite your patients by link.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <ButtonLink href="/signup" size="xl">
                    Create a clinic account
                  </ButtonLink>
                  <ButtonLink href="/login" size="xl" variant="secondary">
                    Sign in
                  </ButtonLink>
                </div>
              </div>
            )}
            {!user ? (
              <p className="mt-10 border-t border-line pt-5 text-sm text-muted">
                Physiotherapist?{" "}
                <Link href="/signup" className="inline-flex items-center gap-0.5 font-semibold text-ink underline-offset-4 hover:underline">
                  Create a clinic account
                  <ArrowUpRight aria-hidden className="size-3.5" />
                </Link>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { CloudOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DrawnCheck } from "./check-mark";

/** The brand moment: Form Black, heavy type, three facts, done. */
export function SessionComplete({
  done,
  total,
  minutes,
  approximate,
  pending,
  offline,
}: {
  done: number;
  total: number;
  minutes: number;
  approximate: boolean;
  pending: boolean;
  offline: boolean;
}) {
  const router = useRouter();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    heading.current?.focus({ preventScroll: true });
  }, []);

  return (
    <main
      id="main"
      data-theme="dark"
      className="on-dark form-grid relative flex min-h-dvh flex-col bg-night text-paper"
    >
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col justify-between px-6 pt-14 pb-[calc(1.5rem+env(safe-area-inset-bottom))]">
        <div className="animate-rise">
          <DrawnCheck tone="signal" className="size-16" />
          <p className="kicker mt-10 text-night-muted">Today&apos;s rehabilitation</p>
          <h1
            ref={heading}
            tabIndex={-1}
            className="mt-3 text-[clamp(4rem,19vw,7.5rem)] leading-[0.86] font-black tracking-[-0.055em] outline-none"
          >
            You&apos;re
            <br />
            done.
          </h1>
          <dl className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-night-line bg-night-line">
            <div className="bg-night px-4 py-4">
              <dt className="kicker text-night-muted">Exercises</dt>
              <dd className="mt-1.5 text-2xl font-bold tracking-[-0.03em] tabular">
                {done} of {total} <span className="sr-only">exercises completed</span>
              </dd>
            </div>
            <div className="bg-night px-4 py-4">
              <dt className="kicker text-night-muted">Time</dt>
              <dd className="mt-1.5 text-2xl font-bold tracking-[-0.03em] tabular">
                {approximate ? "~" : ""}
                {minutes} min<span className="sr-only">{minutes === 1 ? "ute" : "utes"}</span>
              </dd>
            </div>
          </dl>
          <p className="mt-8 text-xl font-semibold tracking-[-0.015em]">Nice work.</p>
          {pending ? (
            <p aria-live="polite" className="mt-3 flex items-center gap-2 text-[15px] text-night-muted">
              <CloudOff aria-hidden className="size-4 shrink-0" />
              {offline
                ? "Saved on this phone — we'll sync when you're back online."
                : "Syncing your session…"}
            </p>
          ) : null}
        </div>

        <div className="mt-12 flex flex-col gap-2">
          <Button
            variant="primary"
            size="xl"
            block
            onClick={() => {
              router.push("/app");
              router.refresh();
            }}
          >
            Done
          </Button>
          <Button
            variant="ghost"
            size="lg"
            block
            className="text-paper hover:bg-night-raised"
            onClick={() => {
              router.push("/app/progress");
              router.refresh();
            }}
          >
            View progress
          </Button>
        </div>
      </div>
    </main>
  );
}

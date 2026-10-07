"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, buttonClasses } from "@/components/ui/button";

export default function PatientError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main id="main" className="mx-auto flex min-h-[70dvh] w-full max-w-[640px] flex-col justify-center px-5 py-16">
      <p className="kicker text-muted">Something went wrong</p>
      <h1 className="mt-3 text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em]">We couldn&apos;t load this page.</h1>
      <p className="mt-4 text-[17px]">Your progress is safe. Anything you completed has been saved.</p>
      <p className="mt-1 text-[17px] text-muted">Check your connection, then try again.</p>
      <div className="mt-8 flex flex-col gap-2 sm:flex-row">
        <Button variant="dark" size="lg" onClick={() => reset()}>
          Try again
        </Button>
        <Link href="/app" className={buttonClasses({ variant: "ghost", size: "lg" })}>
          Go to Today
        </Link>
      </div>
    </main>
  );
}

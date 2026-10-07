"use client";

import { useEffect } from "react";
import Link from "next/link";
import { RotateCcw } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="px-5 py-5 sm:px-8">
        <Link href="/" aria-label="FORM home" className="rounded-sm">
          <Wordmark size="sm" />
        </Link>
      </header>
      <main id="main" className="flex flex-1 items-center px-5 pb-16 sm:px-8">
        <div className="max-w-lg" role="alert">
          <p className="kicker text-muted">Something went wrong</p>
          <h1 className="mt-3 text-[2.5rem] leading-[1] font-black tracking-[-0.04em]">
            Something went wrong. Nothing you&rsquo;ve done is lost.
          </h1>
          <p className="mt-4 text-[15px] leading-relaxed text-muted">
            Anything you finished was saved as you went. Try again — if it keeps happening, wait a minute and reload.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" onClick={reset} icon={<RotateCcw aria-hidden className="size-4" />}>
              Try again
            </Button>
            <Link
              href="/"
              className="inline-flex h-13 items-center rounded-[10px] px-4 text-base font-semibold text-ink underline-offset-4 hover:underline"
            >
              Go home
            </Link>
          </div>
          {error.digest ? <p className="mt-8 font-mono text-xs text-faint">Reference {error.digest}</p> : null}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/clinician/shell";

export default function ClinicError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <PageFrame>
      <div role="alert" className="max-w-lg py-10">
        <p className="kicker text-muted">Something went wrong</p>
        <h1 className="mt-2 text-[28px] leading-tight font-black tracking-[-0.04em]">This page didn&rsquo;t load.</h1>
        <p className="mt-3 text-[15px] text-muted">
          Your patients&rsquo; data is safe — nothing was changed. Try again, and if it keeps happening, go back to Today.
          {error.digest ? <span className="mt-2 block font-mono text-xs text-faint">Reference {error.digest}</span> : null}
        </p>
        <div className="mt-6 flex gap-2">
          <Button onClick={reset} variant="dark" icon={<RotateCcw aria-hidden className="size-4" />}>
            Try again
          </Button>
          <ButtonLink href="/clinic" variant="ghost">
            Back to Today
          </ButtonLink>
        </div>
      </div>
    </PageFrame>
  );
}

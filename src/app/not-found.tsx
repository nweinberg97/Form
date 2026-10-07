import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { ButtonLink } from "@/components/ui/button";
import { Ruler } from "@/components/marketing/ruler";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="on-dark form-grid flex min-h-dvh flex-col bg-ink text-paper">
      <header className="px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="FORM home" className="rounded-sm">
          <Wordmark tone="paper" size="md" />
        </Link>
      </header>
      <main id="main" className="flex flex-1 flex-col justify-center px-5 pb-16 sm:px-8 lg:px-12">
        <p aria-hidden className="kicker text-night-muted">
          Error 404 · Off the grid
        </p>
        <p
          aria-hidden
          className="mt-4 text-[clamp(7rem,30vw,22rem)] leading-[0.8] font-black tracking-[-0.06em] tabular"
        >
          404<span className="text-signal">.</span>
        </p>
        <Ruler className="mt-10 max-w-3xl" />
        <h1 className="mt-10 text-3xl font-black tracking-[-0.035em] sm:text-4xl">This page isn&rsquo;t here.</h1>
        <p className="mt-3 max-w-md text-night-muted">
          The link may be old, or the address has a typo. Nothing on your account has changed.
        </p>
        <div className="mt-8">
          <ButtonLink href="/" size="lg">
            Go to FORM home
          </ButtonLink>
        </div>
      </main>
    </div>
  );
}

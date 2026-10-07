import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";

export function SiteFooter({ demo }: { demo: boolean }) {
  return (
    <footer className="on-dark border-t border-night-line bg-ink text-paper">
      <div className="mx-auto grid max-w-[1440px] gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1fr_auto] lg:px-12">
        <div>
          <Wordmark tone="paper" size="lg" />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-night-muted">
            FORM is a prototype. It doesn&rsquo;t diagnose or replace your clinician. If something hurts more than
            expected, stop and talk to your physio.
          </p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap items-start gap-x-8 gap-y-3 text-sm">
          {demo ? (
            <Link href="/demo" className="text-paper/85 underline-offset-4 hover:text-paper hover:underline">
              Try the demo
            </Link>
          ) : null}
          <Link href="/login" className="text-paper/85 underline-offset-4 hover:text-paper hover:underline">
            Sign in
          </Link>
          <Link href="/signup" className="text-paper/85 underline-offset-4 hover:text-paper hover:underline">
            Create a clinic account
          </Link>
        </nav>
      </div>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 border-t border-night-line px-5 py-5 sm:px-8 lg:px-12">
        <span className="kicker text-night-muted">Move better.</span>
        <span className="kicker text-night-muted">Rehab, reformed.</span>
      </div>
    </footer>
  );
}

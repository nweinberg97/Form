import type { ReactNode } from "react";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { cn } from "@/lib/cn";
import { MovementFigure } from "./movement-figure";
import { Ruler } from "./ruler";

/**
 * Split brand layout for sign-in, sign-up, invitations and the demo picker.
 * Left (large screens): a Form Black brand moment with huge type and a moving
 * figure. Right: a calm Off-White form.
 */
export function AuthShell({
  headline,
  figure = "sit-to-stand",
  figureIndex = "01",
  children,
  wide,
}: {
  /** Lines of the campaign headline; the last one gets the Signal full stop. */
  headline: string[];
  figure?: string;
  figureIndex?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Brand panel */}
      <aside className="on-dark form-grid relative hidden flex-col justify-between overflow-hidden bg-ink p-10 text-paper lg:flex xl:p-14">
        <div className="flex items-center justify-between">
          <Link href="/" aria-label="FORM home" className="rounded-sm">
            <Wordmark tone="paper" size="md" />
          </Link>
          <span aria-hidden className="kicker text-night-muted">
            Fig. {figureIndex}
          </span>
        </div>

        <div>
          <p
            aria-hidden
            className="text-[clamp(4rem,8.4vw,9rem)] leading-[0.84] font-black tracking-[-0.055em] uppercase"
          >
            {headline.map((line, i) => (
              <span key={line} className={cn("block animate-rise", i % 2 === 1 && "pl-[0.35em]")} style={{ animationDelay: `${i * 80}ms` }}>
                {line}
                {i === headline.length - 1 ? <span className="text-signal">.</span> : null}
              </span>
            ))}
          </p>
          <Ruler className="mt-10" />
        </div>

        <MovementFigure slug={figure} index={figureIndex} className="max-w-xl" />
      </aside>

      {/* Form panel */}
      <div className="flex min-h-dvh flex-col bg-paper">
        <header className="on-dark flex items-center justify-between bg-ink px-5 py-4 text-paper lg:hidden">
          <Link href="/" aria-label="FORM home" className="rounded-sm">
            <Wordmark tone="paper" size="sm" />
          </Link>
          <span aria-hidden className="kicker ml-4 min-w-0 truncate text-night-muted">
            {headline.join(" ")}.
          </span>
        </header>
        <main id="main" className="flex flex-1 items-center justify-center px-5 py-12 sm:px-8 sm:py-16">
          <div className={cn("w-full animate-fade", wide ? "max-w-2xl" : "max-w-[420px]")}>{children}</div>
        </main>
        <footer className="px-5 pb-6 sm:px-8">
          <p className="text-xs text-muted">FORM is a prototype. It doesn&rsquo;t diagnose or replace your clinician.</p>
        </footer>
      </div>
    </div>
  );
}

/** Title block for the form side. */
export function AuthHeading({ kicker, title, children }: { kicker?: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-8">
      {kicker ? <p className="kicker text-muted">{kicker}</p> : null}
      <h1 className="mt-2 text-[2.25rem] leading-[1] font-black tracking-[-0.04em] sm:text-[2.75rem]">{title}</h1>
      {children ? <div className="mt-3 text-[15px] leading-relaxed text-muted">{children}</div> : null}
    </div>
  );
}

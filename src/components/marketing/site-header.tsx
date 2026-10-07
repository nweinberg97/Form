import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { accountsEnabled } from "./demo-form";
import { ButtonLink } from "@/components/ui/button";
import type { CurrentUser } from "@/server/auth/session";

export function homeFor(user: Pick<CurrentUser, "role">) {
  return user.role === "patient" ? "/app" : "/clinic";
}

/** Top bar for brand pages (dark). */
export function SiteHeader({ user, demo }: { user: CurrentUser | null; demo: boolean }) {
  return (
    <header className="relative z-10 mx-auto flex w-full max-w-[1440px] items-center justify-between gap-4 px-5 py-5 sm:px-8 lg:px-12">
      <Link href="/" aria-label="FORM home" className="rounded-sm">
        <Wordmark tone="paper" size="md" />
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
        {user ? (
          <ButtonLink href={homeFor(user)} variant="light" size="sm">
            Open FORM
          </ButtonLink>
        ) : (
          <>
            {demo ? (
              <Link
                href="/demo"
                className="hidden h-9 items-center rounded-md px-3 text-sm font-semibold text-paper transition-colors hover:bg-night-line sm:inline-flex"
              >
                Demo
              </Link>
            ) : null}
            {accountsEnabled() ? (
            <Link
              href="/login"
              className="inline-flex h-9 items-center rounded-md px-3 text-sm font-semibold text-paper transition-colors hover:bg-night-line"
            >
              Sign in
            </Link>
            ) : null}
          </>
        )}
      </nav>
    </header>
  );
}

"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, LayoutTemplate, Library, LogOut, Menu, Settings, Users, X } from "lucide-react";
import { Wordmark } from "@/components/brand/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";
import { signOut } from "@/server/actions/auth";

const NAV = [
  { href: "/clinic", label: "Today", icon: CalendarCheck, exact: true },
  { href: "/clinic/patients", label: "Patients", icon: Users },
  { href: "/clinic/library", label: "Library", icon: Library },
  { href: "/clinic/templates", label: "Templates", icon: LayoutTemplate },
  { href: "/clinic/settings", label: "Settings", icon: Settings },
] as const;

function isActive(pathname: string, href: string, exact?: boolean) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

type ShellUser = { name: string; credentials: string | null; orgName: string; role: string };

function NavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, item.href, "exact" in item ? item.exact : false);
        const Icon = item.icon;
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-md px-3 text-[14px] font-medium transition-colors duration-150",
                active ? "bg-night-raised text-paper" : "text-night-muted hover:bg-night-raised/60 hover:text-paper",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute top-2 bottom-2 left-0 w-[3px] rounded-full bg-signal transition-opacity",
                  active ? "opacity-100" : "opacity-0",
                )}
              />
              <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Account({ user }: { user: ShellUser }) {
  return (
    <div className="border-t border-night-line pt-4">
      <div className="flex items-center gap-3 px-1">
        <Avatar name={user.name} size="sm" tone="light" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-paper">
            {user.name}
            {user.credentials ? <span className="font-normal text-night-muted">, {user.credentials}</span> : null}
          </p>
          <p className="kicker truncate text-night-muted">{user.role === "admin" ? "Clinic admin" : "Clinician"}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            aria-label="Sign out"
            title="Sign out"
            className="inline-flex size-9 items-center justify-center rounded-md text-night-muted transition-colors hover:bg-night-raised hover:text-paper"
          >
            <LogOut aria-hidden className="size-4" />
          </button>
        </form>
      </div>
    </div>
  );
}

export function ClinicianShell({ user, demoBar, children }: { user: ShellUser; demoBar?: ReactNode; children: ReactNode }) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);
  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {demoBar}
      <div className="flex min-h-0 flex-1">
        {/* Desktop sidebar */}
        <aside className="on-dark sticky top-0 hidden h-dvh w-60 shrink-0 flex-col bg-night px-3 py-5 lg:flex">
          <div className="px-3">
            <Link href="/clinic" aria-label="FORM — Today" className="inline-block">
              <Wordmark tone="paper" size="sm" />
            </Link>
            <p className="kicker mt-3 truncate text-night-muted" title={user.orgName}>
              {user.orgName}
            </p>
          </div>
          <nav aria-label="Clinic" className="mt-8 flex-1">
            <NavList pathname={pathname} />
          </nav>
          <Account user={user} />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Mobile top bar */}
          <header className="on-dark sticky top-0 z-[var(--z-nav)] flex h-14 items-center justify-between bg-night px-4 lg:hidden">
            <Link href="/clinic" aria-label="FORM — Today">
              <Wordmark tone="paper" size="sm" />
            </Link>
            <button
              type="button"
              onClick={() => setDrawer(true)}
              aria-expanded={drawer}
              aria-controls="clinic-drawer"
              aria-label="Open navigation"
              className="inline-flex size-10 items-center justify-center rounded-md text-paper hover:bg-night-raised"
            >
              <Menu aria-hidden className="size-5" />
            </button>
          </header>

          {drawer ? (
            <div className="fixed inset-0 z-[var(--z-sheet)] lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
              <button
                type="button"
                aria-label="Close navigation"
                className="absolute inset-0 animate-fade bg-ink/45"
                onClick={() => setDrawer(false)}
              />
              <div
                id="clinic-drawer"
                className="on-dark absolute inset-y-0 left-0 flex w-72 max-w-[85vw] animate-slide-in flex-col bg-night px-3 py-4"
              >
                <div className="flex items-center justify-between px-3">
                  <div className="min-w-0">
                    <Wordmark tone="paper" size="sm" />
                    <p className="kicker mt-2 truncate text-night-muted">{user.orgName}</p>
                  </div>
                  <button
                    type="button"
                    autoFocus
                    onClick={() => setDrawer(false)}
                    aria-label="Close navigation"
                    className="inline-flex size-10 items-center justify-center rounded-md text-paper hover:bg-night-raised"
                  >
                    <X aria-hidden className="size-5" />
                  </button>
                </div>
                <nav aria-label="Clinic" className="mt-6 flex-1">
                  <NavList pathname={pathname} onNavigate={() => setDrawer(false)} />
                </nav>
                <Account user={user} />
              </div>
            </div>
          ) : null}

          <main id="main" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

/** Standard page frame for clinic workspace pages. */
export function PageFrame({ children, className, wide }: { children: ReactNode; className?: string; wide?: boolean }) {
  return (
    <div className={cn("mx-auto w-full px-4 py-6 sm:px-6 lg:px-10 lg:py-9", wide ? "max-w-[1440px]" : "max-w-[1180px]", className)}>
      {children}
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  description,
  actions,
}: {
  kicker?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {kicker ? <p className="kicker mb-2 text-muted">{kicker}</p> : null}
        <h1 className="text-[28px] leading-[1.05] font-black tracking-[-0.04em] sm:text-[34px]">{title}</h1>
        {description ? <p className="mt-2 max-w-prose text-[15px] text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

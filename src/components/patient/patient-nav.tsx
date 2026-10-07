"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarCheck, ChartNoAxesColumn, ClipboardList, MessageCircle, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";

type NavItem = { href: string; label: string; icon: LucideIcon };

const ITEMS: NavItem[] = [
  { href: "/app", label: "Today", icon: CalendarCheck },
  { href: "/app/progress", label: "Progress", icon: ChartNoAxesColumn },
  { href: "/app/program", label: "Program", icon: ClipboardList },
  { href: "/app/messages", label: "Messages", icon: MessageCircle },
];

function isActive(pathname: string, href: string) {
  if (href === "/app") return pathname === "/app";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function UnreadLabel({ count }: { count: number }) {
  if (count <= 0) return null;
  return <span className="sr-only">, {count === 1 ? "1 unread message" : `${count} unread messages`}</span>;
}

/** Inline top navigation for tablet and desktop. */
export function PatientTopNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="hidden md:block">
      <ul className="flex items-center gap-1">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative inline-flex h-11 items-center gap-2 rounded-md px-3 text-[15px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:bg-sunken hover:text-ink",
                )}
              >
                {item.label}
                {item.href === "/app/messages" && unread > 0 ? (
                  <span aria-hidden className="size-2 rounded-full bg-signal" />
                ) : null}
                {item.href === "/app/messages" ? <UnreadLabel count={unread} /> : null}
                {active ? (
                  <span aria-hidden className="absolute inset-x-3 -bottom-[10px] h-[3px] rounded-full bg-signal" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Fixed bottom tab bar on phones. Thumb-reachable, 56px targets, safe-area aware. */
export function PatientTabBar({ unread }: { unread: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-[var(--z-nav)] border-t border-line bg-paper/95 safe-bottom md:hidden"
    >
      <ul className="mx-auto grid max-w-[640px] grid-cols-4">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-16 flex-col items-center justify-center gap-1 text-[12px] font-medium transition-colors",
                  active ? "text-ink" : "text-muted hover:text-ink",
                )}
              >
                {active ? (
                  <span aria-hidden className="absolute top-0 left-1/2 h-[3px] w-8 -translate-x-1/2 rounded-b-full bg-signal" />
                ) : null}
                <span className="relative">
                  <Icon aria-hidden className="size-[22px]" strokeWidth={active ? 2.25 : 1.75} />
                  {item.href === "/app/messages" && unread > 0 ? (
                    <span aria-hidden className="absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-paper bg-signal" />
                  ) : null}
                </span>
                <span>
                  {item.label}
                  {item.href === "/app/messages" ? <UnreadLabel count={unread} /> : null}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

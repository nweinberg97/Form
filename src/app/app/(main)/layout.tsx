import Link from "next/link";
import { requirePatientPage } from "@/server/auth/guards";
import { Wordmark } from "@/components/brand/wordmark";
import { Avatar } from "@/components/ui/avatar";
import { PatientTabBar, PatientTopNav } from "@/components/patient/patient-nav";
import { getTodayCached } from "../_lib/today";

export default async function PatientShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatientPage();
  const view = await getTodayCached(user);
  const unread = view.unreadMessages;

  return (
    <>
      <header className="sticky top-0 z-[var(--z-nav)] border-b border-line bg-paper/95">
        <div className="mx-auto flex h-16 max-w-[960px] items-center justify-between gap-4 px-5">
          <Link href="/app" className="-ml-1 inline-flex h-11 items-center rounded-md px-1" aria-label="FORM — Today">
            <Wordmark size="sm" />
          </Link>
          <PatientTopNav unread={unread} />
          <Link
            href="/app/profile"
            className="-mr-1 inline-flex size-11 items-center justify-center rounded-full"
            aria-label={`Profile and settings for ${user.name}`}
          >
            <Avatar name={user.name} size="md" />
          </Link>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-[640px] flex-1 px-5 pt-6 pb-[calc(7rem+env(safe-area-inset-bottom))] md:pt-10 md:pb-16">
        {children}
      </main>
      <PatientTabBar unread={unread} />
    </>
  );
}

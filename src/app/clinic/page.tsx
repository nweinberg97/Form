import type { Metadata } from "next";
import { Plus, UserPlus, ListPlus } from "lucide-react";
import { requireClinicianPage } from "@/server/auth/guards";
import { getDashboard } from "@/server/services/clinician";
import { greeting, hourIn } from "@/lib/dates";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/clinician/shell";
import { AttentionList, UnreadThreads } from "@/components/clinician/dashboard";
import { PatientTable } from "@/components/clinician/patient-table";

export const metadata: Metadata = { title: "Today" };

export default async function ClinicTodayPage({ searchParams }: { searchParams: Promise<{ welcome?: string }> }) {
  const user = await requireClinicianPage();
  const [{ welcome }, data] = await Promise.all([searchParams, getDashboard(user)]);
  const showWelcome = welcome === "1" || data.patients.length === 0;
  const current = data.patients.filter((p) => !p.discharged);
  const firstWithoutProgram = current.find((p) => !p.hasProgram);

  return (
    <PageFrame>
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="kicker mb-2 text-muted">{data.todayLabel}</p>
          <h1 className="text-[30px] leading-[1.02] font-black tracking-[-0.045em] sm:text-[40px]">
            {greeting(hourIn(user.timezone))}, {data.firstName}
          </h1>
        </div>
        <ButtonLink href="/clinic/patients/new" icon={<Plus aria-hidden className="size-4" />}>
          Add patient
        </ButtonLink>
      </header>

      {showWelcome ? (
        <section aria-labelledby="welcome-title" className="on-dark mb-10 overflow-hidden rounded-[20px] bg-night text-paper">
          <div className="form-grid px-6 py-7 sm:px-8 sm:py-8">
            <p className="kicker text-night-muted">{user.orgName}</p>
            <h2 id="welcome-title" className="mt-2 text-2xl font-black tracking-[-0.04em] sm:text-3xl">
              Your clinic is set up
            </h2>
            <p className="mt-2 max-w-prose text-[15px] text-night-muted">Two steps to your first patient doing their rehab at home.</p>
            <ol className="mt-6 grid gap-3 sm:grid-cols-2">
              <li className="flex items-start gap-4 rounded-[14px] border border-night-line bg-night-raised p-4">
                <span className="kicker mt-1 text-signal">01</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Add a patient</p>
                  <p className="mt-0.5 text-sm text-night-muted">Name and, optionally, email. You get an invite link to send.</p>
                  <ButtonLink
                    href="/clinic/patients/new"
                    size="sm"
                    className="mt-3"
                    icon={<UserPlus aria-hidden className="size-4" />}
                  >
                    Add a patient
                  </ButtonLink>
                </div>
              </li>
              <li className="flex items-start gap-4 rounded-[14px] border border-night-line bg-night-raised p-4">
                <span className="kicker mt-1 text-night-muted">02</span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Build their program</p>
                  <p className="mt-0.5 text-sm text-night-muted">Search, add, set dosage. A four-exercise plan takes about two minutes.</p>
                  {firstWithoutProgram ? (
                    <ButtonLink
                      href={`/clinic/patients/${firstWithoutProgram.id}/program`}
                      size="sm"
                      variant="light"
                      className="mt-3"
                      icon={<ListPlus aria-hidden className="size-4" />}
                    >
                      Build {firstWithoutProgram.firstName}&rsquo;s program
                    </ButtonLink>
                  ) : (
                    <p className="mt-3 text-sm text-night-muted">Available once you&rsquo;ve added a patient.</p>
                  )}
                </div>
              </li>
            </ol>
          </div>
        </section>
      ) : null}

      <section aria-labelledby="attention-title" className="mb-10">
        <div className="mb-3 flex items-baseline gap-3">
          <h2 id="attention-title" className="text-lg font-semibold tracking-[-0.015em]">
            Needs your attention
          </h2>
          <span className="tabular text-sm text-muted">
            {data.attention.length} {data.attention.length === 1 ? "patient" : "patients"}
          </span>
        </div>
        <AttentionList groups={data.attention} />
      </section>

      {data.unreadThreads.length ? (
        <section aria-labelledby="unread-title" className="mb-10">
          <div className="mb-3 flex items-baseline gap-3">
            <h2 id="unread-title" className="text-lg font-semibold tracking-[-0.015em]">
              Unread messages
            </h2>
            <span className="tabular text-sm text-muted">
              {data.unreadThreads.reduce((n, t) => n + t.unreadMessages, 0)}
            </span>
          </div>
          <UnreadThreads threads={data.unreadThreads} />
        </section>
      ) : null}

      <section aria-labelledby="patients-title">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="patients-title" className="text-lg font-semibold tracking-[-0.015em]">
            My patients
          </h2>
          <dl className="flex gap-5 text-sm text-muted">
            <div className="flex gap-1.5">
              <dt>Active</dt>
              <dd className="tabular font-semibold text-ink">{data.stats.active}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>No program</dt>
              <dd className="tabular font-semibold text-ink">{data.stats.noProgram}</dd>
            </div>
            <div className="flex gap-1.5">
              <dt>Invite pending</dt>
              <dd className="tabular font-semibold text-ink">{data.stats.invitePending}</dd>
            </div>
          </dl>
        </div>
        <PatientTable
          rows={current}
          caption="My patients"
          emptyTitle="No patients yet"
          emptyDescription="Add your first patient to start building their program."
        />
      </section>
    </PageFrame>
  );
}

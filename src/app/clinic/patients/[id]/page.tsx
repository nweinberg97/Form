import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ListPlus } from "lucide-react";
import { canAccessPatient, requireClinicianPage } from "@/server/auth/guards";
import { getPatientDetail, listClinicians } from "@/server/services/clinician";
import { getThread } from "@/server/services/patient";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import { PageFrame } from "@/components/clinician/shell";
import { PatientHeader } from "@/components/clinician/patient/header";
import { AttentionItems, InviteCard, RecentFeedback } from "@/components/clinician/patient/overview";
import { ProgramCard } from "@/components/clinician/patient/program-card";
import { ActivityGrid } from "@/components/clinician/patient/activity";
import { MessageThread } from "@/components/clinician/patient/messages";
import { ClinicianNotes } from "@/components/clinician/patient/notes";

const TABS = ["overview", "messages", "notes", "history"] as const;
type Tab = (typeof TABS)[number];
const TAB_LABEL: Record<Tab, string> = { overview: "Overview", messages: "Messages", notes: "Notes", history: "History" };

type Params = { params: Promise<{ id: string }>; searchParams: Promise<{ tab?: string }> };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const user = await requireClinicianPage();
  const { id } = await params;
  if (!UUID.test(id)) return { title: "Patient" };
  const patient = await canAccessPatient(user, id);
  return { title: patient?.name ?? "Patient" };
}

export default async function PatientPage({ params, searchParams }: Params) {
  const user = await requireClinicianPage();
  const [{ id }, { tab: rawTab }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const access = await canAccessPatient(user, id);
  if (!access) notFound();
  const tab: Tab = TABS.includes(rawTab as Tab) ? (rawTab as Tab) : "overview";

  const [detail, clinicians, thread] = await Promise.all([
    getPatientDetail(user, id),
    listClinicians(user.orgId),
    tab === "messages" ? getThread(id) : Promise.resolve(null),
  ]);
  if (!detail) notFound();
  const { patient, status } = detail;

  return (
    <PageFrame>
      <Link href="/clinic/patients" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Patients
      </Link>

      <PatientHeader
        patient={patient}
        programs={detail.programs.map((p) => ({ id: p.id, title: p.title }))}
        team={detail.team}
        clinicians={clinicians}
      />

      <dl className="mt-6 grid grid-cols-2 overflow-hidden rounded-[14px] border border-line bg-surface md:grid-cols-4">
        {[
          { label: "Last session", value: status.lastSession ?? "None yet" },
          { label: "This week", value: status.weekScheduled ? `${status.weekDone} / ${status.weekScheduled}` : "—" },
          { label: "Pain reports · 14d", value: String(status.painReports), danger: status.painReports > 0 },
          { label: "Last clinician interaction", value: status.lastTouch ?? "—" },
        ].map((stat, i) => (
          <div
            key={stat.label}
            className={cn("px-5 py-4", i % 2 === 1 && "border-l border-line", i >= 2 && "border-t border-line md:border-t-0", i === 2 && "md:border-l")}
          >
            <dt className="kicker text-muted">{stat.label}</dt>
            <dd className={cn("mt-1.5 text-xl font-semibold tracking-[-0.02em] tabular", stat.danger && "text-danger")}>
              {stat.value}
            </dd>
          </div>
        ))}
      </dl>

      <nav aria-label="Patient sections" className="mt-8 -mx-4 overflow-x-auto px-4 no-scrollbar">
        <ul className="flex gap-1 border-b border-line">
          {TABS.map((t) => {
            const current = t === tab;
            return (
              <li key={t}>
                <Link
                  href={t === "overview" ? `/clinic/patients/${id}` : `/clinic/patients/${id}?tab=${t}`}
                  aria-current={current ? "page" : undefined}
                  scroll={false}
                  className={cn(
                    "relative inline-flex h-11 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    current ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {TAB_LABEL[t]}
                  {t === "messages" && detail.unreadMessages > 0 ? (
                    <span className="inline-flex items-center gap-1 text-xs">
                      <span aria-hidden className="size-1.5 rounded-full bg-signal" />
                      {detail.unreadMessages}
                      <span className="sr-only"> unread</span>
                    </span>
                  ) : null}
                  {t === "notes" && detail.notes.length ? <span className="text-xs text-muted tabular">{detail.notes.length}</span> : null}
                  {current ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-[2px] bg-ink" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-6">
        {tab === "overview" ? (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
            <div className="flex min-w-0 flex-col gap-6">
              <AttentionItems patientId={id} items={detail.attention} />
              {detail.programs.length ? (
                detail.programs.map((program) => <ProgramCard key={program.id} program={program} patientId={id} />)
              ) : patient.discharged ? (
                <EmptyState title="No active program" description={`${patient.firstName} has been discharged. Reactivate them to prescribe again.`} />
              ) : (
                <EmptyState
                  title={`${patient.firstName} doesn't have a program yet`}
                  description="Search the library, add exercises and assign. A four-exercise plan takes about two minutes."
                  action={
                    <ButtonLink href={`/clinic/patients/${id}/program`} icon={<ListPlus aria-hidden className="size-4" />}>
                      Build program
                    </ButtonLink>
                  }
                />
              )}
              <RecentFeedback patientId={id} firstName={patient.firstName} entries={detail.feedback} />
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              {patient.invitePending ? (
                <InviteCard patientId={id} firstName={patient.firstName} expiresAt={detail.pendingInvite?.expiresAt ?? null} />
              ) : null}
              <ActivityGrid weeks={detail.activity} />
            </div>
          </div>
        ) : null}

        {tab === "messages" && thread ? (
          <div className="max-w-3xl">
            <MessageThread
              patientId={id}
              firstName={patient.firstName}
              viewerId={user.id}
              messages={thread}
              hasUnread={detail.unreadMessages > 0}
            />
          </div>
        ) : null}

        {tab === "notes" ? (
          <div className="max-w-3xl">
            <ClinicianNotes patientId={id} firstName={patient.firstName} notes={detail.notes} />
          </div>
        ) : null}

        {tab === "history" ? (
          <div className="flex max-w-3xl flex-col gap-8">
            {detail.programs.length === 0 && detail.pastPrograms.length === 0 ? (
              <EmptyState title="No history yet" description="Every program change is saved as a version with a summary of what changed." />
            ) : null}
            {detail.programs.map((program) => (
              <section key={program.id} aria-labelledby={`history-${program.id}`}>
                <h2 id={`history-${program.id}`} className="mb-3 text-[15px] font-semibold">
                  {program.title} <span className="font-normal text-muted">· version history</span>
                </h2>
                <ol className="relative flex flex-col gap-0 border-l border-line pl-6">
                  {program.versions.map((v, i) => (
                    <li key={v.id} className="relative pb-6 last:pb-0">
                      <span
                        aria-hidden
                        className={cn(
                          "absolute top-1.5 -left-[29px] size-2.5 rounded-full border-2 border-paper",
                          i === 0 ? "bg-ink" : "bg-line-strong",
                        )}
                      />
                      <p className="text-sm">
                        <span className="font-semibold tabular">v{v.version}</span>
                        <span className="text-muted">
                          {" "}
                          · {v.dateLabel} · by {v.createdByName.split(" ")[0]}
                        </span>
                        {i === 0 ? <span className="kicker ml-2 text-muted">Current</span> : null}
                      </p>
                      {v.changeSummary.length ? (
                        <ul className="mt-1.5 flex flex-col gap-0.5">
                          {v.changeSummary.map((change, j) => (
                            <li key={j} className="flex gap-2 text-[15px] text-ink">
                              <span aria-hidden className="text-faint">
                                •
                              </span>
                              {change}
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </li>
                  ))}
                </ol>
              </section>
            ))}
            {detail.pastPrograms.length ? (
              <section aria-labelledby="past-programs">
                <h2 id="past-programs" className="mb-3 text-[15px] font-semibold">
                  Past programs
                </h2>
                <ul className="divide-y divide-line rounded-[14px] border border-line bg-surface">
                  {detail.pastPrograms.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-2 px-5 py-3">
                      <span className="font-medium">{p.title}</span>
                      <span className="text-sm text-muted tabular">
                        {p.startLabel} – {p.endLabel ?? "replaced"}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </PageFrame>
  );
}

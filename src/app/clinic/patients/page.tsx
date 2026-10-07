import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireClinicianPage } from "@/server/auth/guards";
import { listPatients, type PatientRow } from "@/server/services/clinician";
import { ButtonLink } from "@/components/ui/button";
import { PageFrame, PageHeader } from "@/components/clinician/shell";
import { PatientTable } from "@/components/clinician/patient-table";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Patients" };

const FILTERS = [
  { key: "all", label: "All", test: (p: PatientRow) => !p.discharged, empty: "No current patients." },
  { key: "attention", label: "Needs attention", test: (p: PatientRow) => !p.discharged && p.attention.length > 0, empty: "No one needs your attention right now." },
  { key: "no-program", label: "No program", test: (p: PatientRow) => !p.discharged && !p.hasProgram, empty: "Every current patient has a program." },
  { key: "invite", label: "Invite pending", test: (p: PatientRow) => !p.discharged && p.invitePending, empty: "Everyone has set up their account." },
  { key: "discharged", label: "Discharged", test: (p: PatientRow) => p.discharged, empty: "No discharged patients." },
] as const;

export default async function PatientsPage({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const user = await requireClinicianPage();
  const [{ filter }, rows] = await Promise.all([searchParams, listPatients(user)]);
  const active = FILTERS.find((f) => f.key === filter) ?? FILTERS[0];
  const shown = rows.filter(active.test);

  return (
    <PageFrame>
      <PageHeader
        kicker={user.role === "admin" ? "Whole clinic" : "Assigned to you"}
        title="Patients"
        actions={
          <ButtonLink href="/clinic/patients/new" icon={<Plus aria-hidden className="size-4" />}>
            Add patient
          </ButtonLink>
        }
      />
      <nav aria-label="Filter patients" className="mb-5 -mx-4 overflow-x-auto px-4 no-scrollbar">
        <ul className="flex gap-1 border-b border-line">
          {FILTERS.map((f) => {
            const count = rows.filter(f.test).length;
            const current = f.key === active.key;
            return (
              <li key={f.key}>
                <Link
                  href={f.key === "all" ? "/clinic/patients" : `/clinic/patients?filter=${f.key}`}
                  aria-current={current ? "page" : undefined}
                  className={cn(
                    "relative inline-flex h-11 items-center gap-2 px-3 text-sm font-medium whitespace-nowrap transition-colors",
                    current ? "text-ink" : "text-muted hover:text-ink",
                  )}
                >
                  {f.label}
                  <span className="tabular text-xs text-muted">{count}</span>
                  {current ? <span aria-hidden className="absolute inset-x-2 -bottom-px h-[2px] bg-ink" /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <PatientTable key={active.key} rows={shown} caption={`Patients — ${active.label}`} emptyTitle={active.empty} />
    </PageFrame>
  );
}

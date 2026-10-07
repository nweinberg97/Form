import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { canAccessPatient, requireClinicianPage } from "@/server/auth/guards";
import { getClinicianPreferences, getLibrary, getProgramForBuilder, listTemplates } from "@/server/services/clinician";
import { firstName } from "@/server/services/patient";
import { todayIn } from "@/lib/dates";
import { ProgramBuilder } from "@/components/clinician/builder/program-builder";

export const metadata: Metadata = { title: "Program builder" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ProgramBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ programId?: string }>;
}) {
  const user = await requireClinicianPage();
  const [{ id }, { programId }] = await Promise.all([params, searchParams]);
  if (!UUID.test(id)) notFound();
  const patient = await canAccessPatient(user, id);
  if (!patient) notFound();
  if (patient.dischargedAt) redirect(`/clinic/patients/${id}`);

  const wantedProgram = programId && UUID.test(programId) ? programId : null;
  const [library, templates, preferences, existing] = await Promise.all([
    getLibrary(user.orgId),
    listTemplates(user.orgId),
    getClinicianPreferences(user.id),
    getProgramForBuilder(user, id, wantedProgram),
  ]);
  // A stale or foreign programId: start over cleanly rather than editing the wrong plan.
  if (wantedProgram && !existing) redirect(`/clinic/patients/${id}/program`);

  return (
    <ProgramBuilder
      mode="program"
      patient={{ id: patient.id, name: patient.name, firstName: firstName(patient.name) }}
      today={todayIn(user.timezone)}
      existing={existing}
      library={library}
      templates={templates}
      defaultDays={preferences.defaultDays}
      clinicianFirstName={firstName(user.name)}
    />
  );
}

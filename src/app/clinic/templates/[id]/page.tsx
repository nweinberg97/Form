import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireClinicianPage } from "@/server/auth/guards";
import { getClinicianPreferences, getLibrary, listTemplates } from "@/server/services/clinician";
import { firstName } from "@/server/services/patient";
import { ProgramBuilder } from "@/components/clinician/builder/program-builder";

export const metadata: Metadata = { title: "Edit template" };

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireClinicianPage();
  const { id } = await params;
  const [library, templates, preferences] = await Promise.all([
    getLibrary(user.orgId),
    listTemplates(user.orgId),
    getClinicianPreferences(user.id),
  ]);
  const template = templates.find((t) => t.id === id);
  if (!template) notFound();

  return (
    <ProgramBuilder
      mode="template"
      template={{
        id: template.id,
        name: template.name,
        description: template.description,
        draft: {
          title: template.name,
          days: template.days,
          note: null,
          items: template.items.map((i) => ({
            lineageId: null,
            exerciseId: i.exerciseId,
            sets: i.sets,
            reps: i.durationSec ? null : i.reps ?? 10,
            durationSec: i.durationSec,
            perSide: i.perSide,
            side: i.side,
            days: i.days && i.days.length ? i.days : null,
            note: i.note,
          })),
        },
      }}
      library={library}
      templates={templates.filter((t) => t.id !== id)}
      defaultDays={preferences.defaultDays}
      clinicianFirstName={firstName(user.name)}
    />
  );
}

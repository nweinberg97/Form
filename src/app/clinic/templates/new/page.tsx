import type { Metadata } from "next";
import { requireClinicianPage } from "@/server/auth/guards";
import { getClinicianPreferences, getLibrary, listTemplates } from "@/server/services/clinician";
import { firstName } from "@/server/services/patient";
import { ProgramBuilder } from "@/components/clinician/builder/program-builder";

export const metadata: Metadata = { title: "New template" };

export default async function NewTemplatePage() {
  const user = await requireClinicianPage();
  const [library, templates, preferences] = await Promise.all([
    getLibrary(user.orgId),
    listTemplates(user.orgId),
    getClinicianPreferences(user.id),
  ]);
  return (
    <ProgramBuilder
      mode="template"
      template={null}
      library={library}
      templates={templates}
      defaultDays={preferences.defaultDays}
      clinicianFirstName={firstName(user.name)}
    />
  );
}

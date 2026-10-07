import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePatientPage } from "@/server/auth/guards";
import { getCareTeam } from "@/server/services/patient";
import { OnboardingFlow } from "@/components/patient/onboarding/onboarding-flow";

export const metadata: Metadata = { title: "Welcome" };

export default async function OnboardingPage() {
  const user = await requirePatientPage();
  if (user.onboardedAt) redirect("/app");
  const team = await getCareTeam(user.id);
  const clinician = team[0] ?? null;

  return (
    <OnboardingFlow
      initialName={user.name}
      clinicianName={clinician ? `${clinician.name}${clinician.credentials ? `, ${clinician.credentials}` : ""}` : null}
      orgName={user.orgName}
    />
  );
}

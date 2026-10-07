import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requirePatientPage } from "@/server/auth/guards";
import { getToday } from "@/server/services/patient";
import { SessionFlow } from "@/components/patient/session/session-flow";
import type { FlowItem } from "@/components/patient/session/types";

export const metadata: Metadata = { title: "Today's session" };

export default async function SessionPage() {
  const user = await requirePatientPage();
  if (!user.onboardedAt) redirect("/app/onboarding");
  const view = await getToday(user);

  if (!view.sessionId || !["in_progress", "complete", "partial"].includes(view.state) || view.items.length === 0) {
    redirect("/app");
  }

  const items: FlowItem[] = view.items.map((item) => ({
    programExerciseId: item.programExerciseId,
    programTitle: item.programTitle,
    sets: item.sets,
    reps: item.reps,
    durationSec: item.durationSec,
    perSide: item.perSide,
    side: item.side,
    note: item.note,
    exercise: item.exercise,
    done: item.done,
    completionId: item.completionId,
  }));

  return (
    <SessionFlow
      key={view.sessionId}
      sessionId={view.sessionId}
      items={items}
      clinicianFirstName={view.clinician?.firstName ?? null}
      multiplePrograms={view.multiplePrograms}
      estimatedMinutes={view.minutes}
      serverDurationSec={view.durationSec}
    />
  );
}

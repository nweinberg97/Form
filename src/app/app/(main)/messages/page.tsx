import type { Metadata } from "next";
import { requirePatientPage } from "@/server/auth/guards";
import { firstName, getCareTeam, getThread } from "@/server/services/patient";
import { MessageThread, type ThreadEntry } from "@/components/patient/messages/thread";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage() {
  const user = await requirePatientPage();
  const [thread, team] = await Promise.all([getThread(user.id), getCareTeam(user.id)]);
  const primary = team[0] ?? null;
  const clinicianFirstName = primary ? firstName(primary.name) : null;

  const entries: ThreadEntry[] = thread.map((m) => ({
    id: m.id,
    body: m.body,
    createdAt: new Date(m.createdAt).toISOString(),
    mine: m.senderId === user.id,
    senderName: m.senderName,
    senderCredentials: m.senderCredentials,
    exerciseName: m.exerciseName,
    rating: m.rating,
    painLocation: m.painLocation,
  }));

  return (
    <div className="flex flex-col">
      <header className="mb-6">
        <h1 className="text-[2.5rem] leading-[0.95] font-black tracking-[-0.045em]">Messages</h1>
        <p className="mt-2 text-[15px] text-muted">
          {team.length
            ? `Your care team: ${team.map((c) => `${c.name}${c.credentials ? `, ${c.credentials}` : ""}`).join(" · ")}`
            : "Your care team at your clinic."}
        </p>
      </header>
      <MessageThread
        messages={entries}
        clinicianFirstName={clinicianFirstName}
        timeZone={user.timezone}
        canSend={!user.dischargedAt}
      />
      <div aria-hidden className="h-20 md:hidden" />
    </div>
  );
}

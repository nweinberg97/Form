import type { Metadata } from "next";
import { LogOut } from "lucide-react";
import { requirePatientPage } from "@/server/auth/guards";
import { getCareTeam } from "@/server/services/patient";
import { signOut } from "@/server/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AccountForm, NotificationForm } from "@/components/patient/profile/profile-forms";
import { getPatientPreferences } from "../../_lib/preferences";

export const metadata: Metadata = { title: "Profile" };

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-lg font-semibold tracking-[-0.015em]">
        {title}
      </h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default async function ProfilePage() {
  const user = await requirePatientPage();
  const [team, prefs] = await Promise.all([getCareTeam(user.id), getPatientPreferences(user.id)]);
  const editable = !user.dischargedAt;

  return (
    <div className="flex flex-col gap-10">
      <header className="flex items-center gap-4">
        <Avatar name={user.name} size="lg" tone="dark" />
        <div className="min-w-0">
          <h1 className="truncate text-[2rem] leading-none font-black tracking-[-0.04em]">{user.name}</h1>
          <p className="mt-1 text-[15px] text-muted">{user.orgName}</p>
        </div>
      </header>

      <Section id="account-title" title="Account">
        {editable ? (
          <AccountForm name={user.name} email={user.email} timezone={user.timezone} />
        ) : (
          <dl className="flex flex-col gap-3 text-[15px]">
            <div>
              <dt className="text-muted">Email</dt>
              <dd>{user.email}</dd>
            </div>
            <div>
              <dt className="text-muted">Time zone</dt>
              <dd>{user.timezone.replace(/_/g, " ")}</dd>
            </div>
          </dl>
        )}
      </Section>

      {editable ? (
        <Section id="notifications-title" title="Notifications">
          <NotificationForm {...prefs} />
        </Section>
      ) : null}

      <Section id="team-title" title="Care team">
        {team.length === 0 ? (
          <p className="text-[15px] text-muted">Your clinic hasn&apos;t assigned a physiotherapist yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {team.map((member) => (
              <li key={member.id} className="flex items-center gap-3">
                <Avatar name={member.name} />
                <div className="min-w-0">
                  <p className="text-[15px] font-semibold">
                    {member.name}
                    {member.credentials ? `, ${member.credentials}` : ""}
                  </p>
                  <p className="text-[13px] text-muted">{member.isPrimary ? "Your physiotherapist" : "Care team"}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section id="privacy-title" title="Privacy">
        <ul className="flex flex-col gap-3 text-[15px] leading-relaxed">
          <li>
            <span className="font-semibold">Who can see your data:</span> the care team at {user.orgName}. They see your
            plan, the sessions you complete, how exercises felt, and your messages.
          </li>
          <li>
            <span className="font-semibold">What FORM does with it:</span> uses it to run your plan. FORM doesn&apos;t sell
            your data or use it for advertising.
          </li>
          <li>
            <span className="font-semibold">Videos:</span> exercise videos only load from YouTube when you tap play.
          </li>
          {user.isDemo ? (
            <li>
              <span className="font-semibold">This is a demo:</span> everything here is sample data and is deleted
              automatically after 24 hours.
            </li>
          ) : (
            <li>
              To get a copy of your data or ask for it to be deleted, ask your clinic.
            </li>
          )}
        </ul>
      </Section>

      <section className="border-t border-line pt-8">
        <form action={signOut}>
          <Button type="submit" variant="secondary" size="lg" icon={<LogOut aria-hidden className="size-4" />}>
            Sign out
          </Button>
        </form>
      </section>
    </div>
  );
}

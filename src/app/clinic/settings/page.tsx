import type { Metadata } from "next";
import { requireClinicianPage } from "@/server/auth/guards";
import { listClinicians } from "@/server/services/clinician";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { PageFrame, PageHeader } from "@/components/clinician/shell";
import { AddClinician } from "@/components/clinician/settings/add-clinician";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const user = await requireClinicianPage();
  const team = await listClinicians(user.orgId);
  const isAdmin = user.role === "admin";

  return (
    <PageFrame>
      <PageHeader kicker="Settings" title={user.orgName} />

      <div className="flex max-w-3xl flex-col gap-10">
        <section aria-labelledby="account-title">
          <h2 id="account-title" className="mb-3 text-lg font-semibold tracking-[-0.015em]">
            Your account
          </h2>
          <dl className="divide-y divide-line rounded-[14px] border border-line bg-surface">
            {[
              ["Name", `${user.name}${user.credentials ? `, ${user.credentials}` : ""}`],
              ["Email", user.email],
              ["Role", isAdmin ? "Clinic admin" : "Clinician"],
              ["Time zone", user.timezone],
            ].map(([label, value]) => (
              <div key={label} className="flex flex-col gap-0.5 px-5 py-3 sm:flex-row sm:items-baseline sm:gap-6">
                <dt className="kicker w-32 shrink-0 text-muted">{label}</dt>
                <dd className="min-w-0 text-[15px] break-words">{value}</dd>
              </div>
            ))}
          </dl>
          {user.isDemo ? (
            <p className="mt-2 text-sm text-muted">This is a private demo clinic. It and everything in it are removed after 24 hours.</p>
          ) : null}
        </section>

        <section aria-labelledby="team-title">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 id="team-title" className="text-lg font-semibold tracking-[-0.015em]">
                Team
              </h2>
              <p className="text-sm text-muted">
                {isAdmin
                  ? "Clinicians see the patients they're assigned to. Admins see the whole clinic."
                  : "Ask a clinic admin to add or change team members."}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
            <table className="w-full min-w-[520px] text-left">
              <caption className="sr-only">Clinicians in {user.orgName}</caption>
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="kicker px-5 py-3 font-medium text-muted">
                    Name
                  </th>
                  <th scope="col" className="kicker px-5 py-3 font-medium text-muted">
                    Email
                  </th>
                  <th scope="col" className="kicker px-5 py-3 font-medium text-muted">
                    Role
                  </th>
                </tr>
              </thead>
              <tbody>
                {team.map((member) => (
                  <tr key={member.id} className="border-b border-line last:border-b-0">
                    <th scope="row" className="px-5 py-3 font-normal">
                      <span className="flex items-center gap-3">
                        <Avatar name={member.name} size="sm" />
                        <span className="font-semibold">
                          {member.name}
                          {member.credentials ? <span className="font-normal text-muted">, {member.credentials}</span> : null}
                          {member.id === user.id ? <span className="ml-1.5 font-normal text-muted">(you)</span> : null}
                        </span>
                      </span>
                    </th>
                    <td className="px-5 py-3 text-sm text-muted">{member.email}</td>
                    <td className="px-5 py-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <Badge tone={member.role === "admin" ? "dark" : "neutral"}>{member.role === "admin" ? "Admin" : "Clinician"}</Badge>
                        {!member.active ? <Badge tone="outline">Invite pending</Badge> : null}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {isAdmin ? (
            <div className="mt-4">
              <AddClinician />
            </div>
          ) : null}
        </section>
      </div>
    </PageFrame>
  );
}

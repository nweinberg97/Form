import type { Metadata } from "next";
import Link from "next/link";
import { lookupInvite } from "@/server/services/invites";
import { AuthHeading, AuthShell } from "@/components/marketing/auth-shell";
import { InviteForm } from "@/components/marketing/invite-form";

export const metadata: Metadata = { title: "Your invitation", robots: { index: false, follow: false } };

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await lookupInvite(code);

  if (!invite) {
    return (
      <AuthShell headline={["Back", "in form"]} figure="calf-raise" figureIndex="03">
        <AuthHeading kicker="Invitation" title="This link has run its course.">
          This invite link has expired or was already used. Ask your clinic for a new one.
        </AuthHeading>
        <div className="flex flex-col gap-2 border-t border-line pt-6 text-[15px]">
          <p>
            Already set up your account?{" "}
            <Link href="/login" className="font-semibold text-ink underline underline-offset-4 hover:text-ink-soft">
              Sign in
            </Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  const isPatient = invite.role === "patient";
  const firstName = invite.name.trim().split(/\s+/)[0];
  const lead = firstName ? `Hi ${firstName} — set` : "Set";

  return (
    <AuthShell headline={["Back", "in form"]} figure="calf-raise" figureIndex="03">
      <AuthHeading
        kicker={invite.orgName}
        title={invite.invitedBy ? `${invite.invitedBy} invited you to FORM` : `You're invited to FORM`}
      >
        {isPatient ? (
          <>
            <span className="font-medium text-ink">Your exercises, made simple.</span>{" "}
            {lead} a password and you&rsquo;ll see today&rsquo;s plan from {invite.orgName}.
          </>
        ) : (
          <>
            {lead} a password to join {invite.orgName} on FORM.
          </>
        )}
      </AuthHeading>
      <InviteForm code={code} email={invite.email} isPatient={isPatient} />
    </AuthShell>
  );
}

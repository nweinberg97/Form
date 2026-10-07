import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";
import { AuthHeading, AuthShell } from "@/components/marketing/auth-shell";
import { LoginForm } from "@/components/marketing/login-form";
import { demoEnabled } from "@/components/marketing/demo-form";
import { homeFor } from "@/components/marketing/site-header";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeFor(user));
  return (
    <AuthShell headline={["Get back", "to it"]} figure="sit-to-stand" figureIndex="01">
      <AuthHeading kicker="Sign in" title="Welcome back.">
        Clinicians and patients both sign in here.
      </AuthHeading>
      <LoginForm demo={demoEnabled()} />
    </AuthShell>
  );
}

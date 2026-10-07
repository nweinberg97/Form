import type { Metadata } from "next";
import { AuthHeading, AuthShell } from "@/components/marketing/auth-shell";
import { SignupForm } from "@/components/marketing/signup-form";

export const metadata: Metadata = { title: "Create a clinic account" };

export default function SignupPage() {
  return (
    <AuthShell headline={["Rehab,", "reformed"]} figure="glute-bridge" figureIndex="02">
      <AuthHeading kicker="For clinics" title="Set up your clinic in a minute.">
        Prescribe, follow and adapt home programs — without the admin.
      </AuthHeading>
      <SignupForm />
    </AuthShell>
  );
}

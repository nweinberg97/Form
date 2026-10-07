import type { Metadata } from "next";
import { requirePatientPage } from "@/server/auth/guards";
import { DemoBar } from "@/components/brand/demo-bar";

export const metadata: Metadata = {
  title: { default: "Today", template: "%s · FORM" },
  robots: { index: false, follow: false },
};

export default async function PatientRootLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePatientPage();
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      {user.isDemo ? <DemoBar role="patient" /> : null}
      {children}
    </div>
  );
}

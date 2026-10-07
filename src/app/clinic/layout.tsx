import type { Metadata } from "next";
import { requireClinicianPage } from "@/server/auth/guards";
import { DemoBar } from "@/components/brand/demo-bar";
import { ClinicianShell } from "@/components/clinician/shell";

export const metadata: Metadata = {
  title: { default: "Clinic", template: "%s · FORM Clinic" },
  robots: { index: false, follow: false },
};

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const user = await requireClinicianPage();
  return (
    <ClinicianShell
      user={{ name: user.name, credentials: user.credentials, orgName: user.orgName, role: user.role }}
      demoBar={user.isDemo ? <DemoBar role={user.role} /> : null}
    >
      {children}
    </ClinicianShell>
  );
}

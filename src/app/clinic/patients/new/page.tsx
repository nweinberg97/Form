import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireClinicianPage } from "@/server/auth/guards";
import { PageFrame } from "@/components/clinician/shell";
import { NewPatientForm } from "@/components/clinician/new-patient-form";

export const metadata: Metadata = { title: "Add patient" };

export default async function NewPatientPage() {
  await requireClinicianPage();
  return (
    <PageFrame>
      <Link href="/clinic/patients" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink">
        <ArrowLeft aria-hidden className="size-4" />
        Patients
      </Link>
      <div className="mt-6 max-w-lg">
        <p className="kicker mb-2 text-muted">New patient</p>
        <h1 className="mb-8 text-[30px] leading-[1.05] font-black tracking-[-0.04em]">Add a patient</h1>
        <NewPatientForm />
      </div>
    </PageFrame>
  );
}

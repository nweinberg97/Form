import { ButtonLink } from "@/components/ui/button";
import { PageFrame } from "@/components/clinician/shell";

export default function ClinicNotFound() {
  return (
    <PageFrame>
      <div className="max-w-lg py-10">
        <p className="kicker text-muted">Not found</p>
        <h1 className="mt-2 text-[28px] leading-tight font-black tracking-[-0.04em]">We couldn&rsquo;t find that.</h1>
        <p className="mt-3 text-[15px] text-muted">
          It may have been removed, or it belongs to a patient who isn&rsquo;t assigned to you. Ask a clinic admin to share them with you.
        </p>
        <div className="mt-6 flex gap-2">
          <ButtonLink href="/clinic/patients" variant="dark">
            All patients
          </ButtonLink>
          <ButtonLink href="/clinic" variant="ghost">
            Today
          </ButtonLink>
        </div>
      </div>
    </PageFrame>
  );
}

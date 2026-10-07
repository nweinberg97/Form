import { Skeleton } from "@/components/ui/feedback";
import { PageFrame } from "@/components/clinician/shell";

export default function ClinicLoading() {
  return (
    <PageFrame>
      <div role="status" aria-label="Loading">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-10 w-80 max-w-full" />
        <Skeleton className="mt-10 h-5 w-48" />
        <div className="mt-3 flex flex-col gap-px overflow-hidden rounded-[14px] border border-line">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[76px] rounded-none" />
          ))}
        </div>
        <Skeleton className="mt-10 h-5 w-32" />
        <Skeleton className="mt-3 h-11 w-80 max-w-full" />
        <div className="mt-3 flex flex-col gap-px overflow-hidden rounded-[14px] border border-line">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-14 rounded-none" />
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </PageFrame>
  );
}

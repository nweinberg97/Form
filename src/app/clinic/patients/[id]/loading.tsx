import { Skeleton } from "@/components/ui/feedback";
import { PageFrame } from "@/components/clinician/shell";

export default function PatientLoading() {
  return (
    <PageFrame>
      <div role="status" aria-label="Loading patient">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="mt-6 h-3 w-48" />
        <Skeleton className="mt-3 h-10 w-72 max-w-full" />
        <Skeleton className="mt-2 h-4 w-56" />
        <Skeleton className="mt-6 h-[82px] w-full rounded-[14px]" />
        <Skeleton className="mt-8 h-11 w-80 max-w-full" />
        <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col gap-6">
            <Skeleton className="h-72 rounded-[14px]" />
            <Skeleton className="h-48 rounded-[14px]" />
          </div>
          <Skeleton className="h-64 rounded-[14px]" />
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </PageFrame>
  );
}

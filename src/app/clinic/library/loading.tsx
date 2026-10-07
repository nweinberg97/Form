import { Skeleton } from "@/components/ui/feedback";
import { PageFrame } from "@/components/clinician/shell";

export default function LibraryLoading() {
  return (
    <PageFrame wide>
      <div role="status" aria-label="Loading library">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-3 h-10 w-72" />
        <Skeleton className="mt-8 h-11 w-full max-w-md" />
        <div className="mt-6 grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-56 rounded-[14px]" />
          ))}
        </div>
        <span className="sr-only">Loading…</span>
      </div>
    </PageFrame>
  );
}

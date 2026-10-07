import { Skeleton } from "@/components/ui/feedback";

export default function ProgressLoading() {
  return (
    <div role="status" aria-label="Loading your progress" className="flex flex-col">
      <Skeleton className="h-3 w-32" />
      <Skeleton className="mt-4 h-20 w-28" />
      <Skeleton className="mt-3 h-6 w-48" />
      <div className="mt-8 grid grid-cols-2 gap-3">
        <Skeleton className="h-24 rounded-[14px]" />
        <Skeleton className="h-24 rounded-[14px]" />
      </div>
      <Skeleton className="mt-12 h-6 w-28" />
      <div className="mt-5 grid grid-cols-7 gap-1">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="mx-auto size-9 rounded-full" />
        ))}
      </div>
      <Skeleton className="mt-12 h-44 w-full rounded-[14px]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

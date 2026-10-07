import { Skeleton } from "@/components/ui/feedback";

export default function TodayLoading() {
  return (
    <div role="status" aria-label="Loading today's plan" className="flex flex-col">
      <Skeleton className="h-4 w-40" />
      <Skeleton className="mt-4 h-11 w-4/5" />
      <Skeleton className="mt-2 h-11 w-3/5" />
      <Skeleton className="mt-4 h-5 w-48" />
      <div className="mt-7 divide-y divide-line border-y border-line">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="h-4 w-6" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-20" />
            </div>
            <Skeleton className="h-[45px] w-[72px] rounded-[10px]" />
          </div>
        ))}
      </div>
      <Skeleton className="mt-8 h-16 w-full rounded-[10px]" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}

import { Skeleton } from "@/components/ui/feedback";

export default function ProgramLoading() {
  return (
    <div role="status" aria-label="Loading your program" className="flex flex-col">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-11 w-4/5" />
      <Skeleton className="mt-4 h-5 w-64" />
      <Skeleton className="mt-6 h-12 w-full rounded-[12px]" />
      <div className="mt-10 grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }, (_, i) => (
          <Skeleton key={i} className="h-16 rounded-[10px]" />
        ))}
      </div>
      <div className="mt-10 divide-y divide-line border-y border-line">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-4 py-4">
            <Skeleton className="h-[40px] w-16 rounded-[10px]" />
            <div className="flex-1">
              <Skeleton className="h-5 w-40" />
              <Skeleton className="mt-2 h-4 w-24" />
            </div>
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

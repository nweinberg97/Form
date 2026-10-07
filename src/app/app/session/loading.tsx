import { Skeleton } from "@/components/ui/feedback";

export default function SessionLoading() {
  return (
    <div role="status" aria-label="Loading your session" className="flex min-h-dvh flex-col bg-paper">
      <div className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-[640px] items-center gap-3 px-3">
          <Skeleton className="size-11" />
          <div className="flex flex-1 gap-1">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-1 flex-1 rounded-full" />
            ))}
          </div>
          <Skeleton className="size-11" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] px-5 pt-6">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="mt-3 h-11 w-3/4" />
        <Skeleton className="mt-4 h-6 w-44" />
        <Skeleton className="mt-6 aspect-[16/10] w-full rounded-[14px]" />
        <Skeleton className="mt-7 h-4 w-28" />
        <Skeleton className="mt-3 h-5 w-full" />
        <Skeleton className="mt-2 h-5 w-5/6" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

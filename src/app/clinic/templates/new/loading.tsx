import { Skeleton } from "@/components/ui/feedback";

export default function BuilderLoading() {
  return (
    <div role="status" aria-label="Loading program builder" className="flex min-h-dvh flex-col">
      <div className="flex h-14 items-center gap-3 border-b border-line px-5">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="ml-auto h-9 w-36" />
      </div>
      <div className="grid flex-1 lg:grid-cols-[360px_minmax(0,1fr)_360px]">
        <div className="hidden flex-col gap-3 border-r border-line bg-surface p-4 lg:flex">
          <Skeleton className="h-11" />
          <Skeleton className="h-8" />
          {Array.from({ length: 7 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
        <div className="mx-auto w-full max-w-2xl px-6 py-8">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-8 w-72 max-w-full" />
          <Skeleton className="mt-6 h-10" />
          <Skeleton className="mt-8 h-40 rounded-[14px]" />
        </div>
        <div className="hidden border-l border-line bg-surface p-5 lg:block">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-6 h-11" />
          <Skeleton className="mt-4 h-11" />
        </div>
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

import { Skeleton } from "@/components/ui/feedback";

export default function ProfileLoading() {
  return (
    <div role="status" aria-label="Loading your profile" className="flex flex-col gap-10">
      <div className="flex items-center gap-4">
        <Skeleton className="size-14 rounded-full" />
        <div>
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-2 h-4 w-28" />
        </div>
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-t border-line pt-8">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="mt-5 h-12 w-full" />
          <Skeleton className="mt-3 h-12 w-full" />
        </div>
      ))}
      <span className="sr-only">Loading…</span>
    </div>
  );
}

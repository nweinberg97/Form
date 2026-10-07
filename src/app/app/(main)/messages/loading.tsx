import { Skeleton } from "@/components/ui/feedback";

export default function MessagesLoading() {
  return (
    <div role="status" aria-label="Loading messages" className="flex flex-col">
      <Skeleton className="h-11 w-48" />
      <Skeleton className="mt-3 h-4 w-64" />
      <div className="mt-8 flex flex-col gap-4">
        <Skeleton className="h-16 w-3/4 self-start rounded-[16px]" />
        <Skeleton className="h-12 w-2/3 self-end rounded-[16px]" />
        <Skeleton className="h-20 w-4/5 self-start rounded-[16px]" />
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}

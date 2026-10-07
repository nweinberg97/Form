import Link from "next/link";
import { MessageSquareText } from "lucide-react";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { formatDays } from "@/lib/dates";
import { formatDosage, SIDE_LABEL } from "@/lib/dosage";
import { RATING_LABEL, type RatingKey } from "@/lib/labels";
import type { PatientDetail } from "@/server/services/clinician";

const RATING_MARK: Record<RatingKey, string> = {
  easy: "bg-line-strong",
  good: "bg-success",
  hard: "bg-warning",
  painful: "bg-danger",
};

/** Last few ratings as tiny labeled marks: oldest → newest. */
function RatingMarks({ ratings }: { ratings: { rating: string; date: Date }[] }) {
  if (!ratings.length) return <span className="text-xs text-faint">No ratings yet</span>;
  const ordered = [...ratings].reverse();
  const counts = ordered.reduce<Record<string, number>>((acc, r) => ({ ...acc, [r.rating]: (acc[r.rating] ?? 0) + 1 }), {});
  const summary = Object.entries(counts)
    .map(([k, n]) => `${n} ${RATING_LABEL[k as RatingKey] ?? k}`)
    .join(", ");
  return (
    <span className="inline-flex items-center gap-1.5">
      <span aria-hidden className="inline-flex items-end gap-[3px]">
        {ordered.map((r, i) => (
          <span
            key={i}
            title={RATING_LABEL[r.rating as RatingKey]}
            className={cn("block h-3 w-1.5 rounded-[2px]", RATING_MARK[r.rating as RatingKey] ?? "bg-line-strong")}
          />
        ))}
      </span>
      <span className="text-xs text-muted">
        <span className="sr-only">Recent ratings: </span>
        {summary}
      </span>
    </span>
  );
}

export function ProgramCard({ program, patientId }: { program: PatientDetail["programs"][number]; patientId: string }) {
  return (
    <section aria-labelledby={`program-${program.id}`} className="rounded-[14px] border border-line bg-surface">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div className="min-w-0">
          <p className="kicker text-muted">
            v{program.version}
            {program.updatedAgo ? ` · updated ${program.updatedAgo}` : ""}
          </p>
          <h2 id={`program-${program.id}`} className="mt-1 text-lg font-semibold tracking-[-0.015em]">
            {program.title}
          </h2>
          <p className="mt-0.5 text-sm text-muted">
            {formatDays(program.days)} · ~{program.minutes} min · {program.items.length}{" "}
            {program.items.length === 1 ? "exercise" : "exercises"} · since {program.startLabel}
          </p>
        </div>
        <Link
          href={`/clinic/patients/${patientId}/program?programId=${program.id}`}
          className="inline-flex h-9 items-center rounded-md border border-line-strong px-3 text-sm font-semibold transition-colors hover:border-ink"
        >
          Edit<span className="sr-only"> {program.title}</span>
        </Link>
      </div>
      {program.note ? (
        <p className="border-b border-line bg-paper/60 px-5 py-3 text-sm text-ink">
          <span className="kicker mr-2 text-muted">Note</span>
          {program.note}
        </p>
      ) : null}
      <ol className="divide-y divide-line">
        {program.items.map((item, index) => (
          <li key={item.programExerciseId} className="flex items-center gap-4 px-5 py-3">
            <span className="kicker w-5 shrink-0 text-muted tabular">{String(index + 1).padStart(2, "0")}</span>
            <span className="hidden w-16 shrink-0 sm:block"><DemoThumb demo={item.exercise.demo} label={`${item.exercise.name} movement guide`} className="w-full" /></span>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2">
                <span className="font-semibold tracking-[-0.01em]">{item.exercise.name}</span>
                {item.note ? (
                  <span title={item.note} className="inline-flex items-center gap-1 text-xs text-muted">
                    <MessageSquareText aria-hidden className="size-3.5" />
                    <span className="sr-only">Has a note: {item.note}</span>
                    <span aria-hidden>Note</span>
                  </span>
                ) : null}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted">
                <span className="tabular text-ink">{formatDosage(item)}</span>
                {item.side !== "both" ? <span>· {SIDE_LABEL[item.side]}</span> : null}
                {item.days?.length ? (
                  <Badge tone="outline" className="!h-5 !text-[11px]">
                    {formatDays(item.days)} only
                  </Badge>
                ) : null}
              </p>
            </div>
            <div className="hidden shrink-0 md:block">
              <RatingMarks ratings={item.recentRatings} />
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

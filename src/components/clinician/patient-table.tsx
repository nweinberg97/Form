"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { SearchInput } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { cn } from "@/lib/cn";
import type { PatientRow } from "@/server/services/clinician";
import { ATTENTION_LABEL, ATTENTION_TONE, asKind, sortSignals } from "./attention";
import { useSlashFocus } from "./hooks";

export function WeekDots({ done, scheduled }: { done: number; scheduled: number }) {
  if (scheduled === 0) return <span className="text-sm text-muted">—</span>;
  const shown = Math.min(scheduled, 7);
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="inline-flex gap-[3px]">
        {Array.from({ length: shown }, (_, i) => (
          <span
            key={i}
            className={cn("size-[7px] rounded-full", i < done ? "bg-ink" : "border border-line-strong bg-transparent")}
          />
        ))}
      </span>
      <span className="tabular text-sm text-ink">
        {done}
        <span className="text-muted"> / {scheduled}</span>
        <span className="sr-only"> sessions done this week</span>
      </span>
    </span>
  );
}

export function PatientStatus({ row }: { row: PatientRow }) {
  if (row.discharged) return <Badge tone="outline">Discharged</Badge>;
  if (row.attention.length) {
    const top = sortSignals(row.attention)[0];
    const kind = asKind(top.kind);
    return (
      <Badge tone={ATTENTION_TONE[kind]}>
        {ATTENTION_LABEL[kind]}
        {row.attention.length > 1 ? <span className="font-normal opacity-80">+{row.attention.length - 1}</span> : null}
      </Badge>
    );
  }
  if (!row.hasProgram) return <Badge tone="neutral">No program</Badge>;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <span aria-hidden className="size-1.5 rounded-full bg-success" />
      On track
    </span>
  );
}

export function PatientTable({
  rows,
  searchable = true,
  emptyTitle = "No patients here",
  emptyDescription,
  caption = "Patients",
}: {
  rows: PatientRow[];
  searchable?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  caption?: string;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useSlashFocus(inputRef, searchable);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.programTitle ?? "").toLowerCase().includes(q) ||
        (r.email ?? "").toLowerCase().includes(q),
    );
  }, [rows, query]);

  return (
    <div className="flex flex-col gap-3">
      {searchable ? (
        <div className="flex items-center gap-3">
          <SearchInput
            ref={inputRef}
            label="Search patients by name or program"
            shortcut="/"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                setQuery("");
                e.currentTarget.blur();
              }
            }}
            className="w-full max-w-sm"
          />
          <p aria-live="polite" className="text-sm text-muted tabular">
            {query ? `${filtered.length} of ${rows.length}` : `${rows.length} ${rows.length === 1 ? "patient" : "patients"}`}
          </p>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <EmptyState
          title={query ? `No patients match “${query}”` : emptyTitle}
          description={query ? "Try a first name or a program title." : emptyDescription}
        />
      ) : (
        <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
          <table className="w-full min-w-[760px] border-collapse text-left">
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr className="border-b border-line">
                {["Patient", "Program", "Last session", "This week", "Status"].map((h) => (
                  <th key={h} scope="col" className="kicker px-4 py-3 font-medium text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    "relative border-b border-line transition-colors last:border-b-0 hover:bg-sunken/60 focus-within:bg-sunken/60",
                    row.discharged && "text-muted",
                  )}
                >
                  <th scope="row" className="px-4 py-3 align-middle font-normal">
                    <Link
                      href={`/clinic/patients/${row.id}`}
                      className="block font-semibold tracking-[-0.01em] text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-offset-[-2px]"
                    >
                      {row.name}
                      {row.unreadMessages > 0 ? (
                        <span className="ml-2 inline-flex items-center gap-1 align-middle text-xs font-medium text-ink">
                          <span aria-hidden className="size-1.5 rounded-full bg-signal" />
                          {row.unreadMessages} new {row.unreadMessages === 1 ? "message" : "messages"}
                        </span>
                      ) : null}
                    </Link>
                    <span className="mt-0.5 block text-[13px] text-muted">
                      {row.invitePending ? (
                        <Badge tone="outline" className="!h-5 !text-[11px]">
                          Invite pending
                        </Badge>
                      ) : (
                        row.email
                      )}
                    </span>
                  </th>
                  <td className="max-w-[260px] px-4 py-3 align-middle text-sm">
                    {row.programTitle ? (
                      <span className="line-clamp-2">{row.programTitle}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-middle text-sm whitespace-nowrap">
                    {row.lastSession ? row.lastSession.label : <span className="text-muted">None yet</span>}
                  </td>
                  <td className="px-4 py-3 align-middle whitespace-nowrap">
                    {row.discharged ? <span className="text-sm text-muted">—</span> : <WeekDots {...row.week} />}
                  </td>
                  <td className="px-4 py-3 align-middle">
                    <PatientStatus row={row} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

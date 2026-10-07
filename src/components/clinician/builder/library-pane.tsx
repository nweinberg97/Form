"use client";

import { forwardRef, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowLeft, Check, Plus } from "lucide-react";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { Button } from "@/components/ui/button";
import { SearchInput, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { BODY_AREAS, EQUIPMENT } from "@/content/types";
import type { LibraryExercise } from "@/server/services/clinician";
import { areaLabel, buildIndex, equipmentLabel, searchLibrary } from "./model";
import { defaultDosageLabel, exerciseMeta, ExercisePreview } from "./exercise-preview";

export type LibraryPaneHandle = { focusSearch: () => void };

type Props = {
  library: LibraryExercise[];
  byId: Map<string, LibraryExercise>;
  /** exerciseId → how many times it's in the plan */
  inPlan: Map<string, number>;
  onAdd: (exercise: LibraryExercise, how: "click" | "enter") => void;
  previewId: string | null;
  onPreview: (id: string | null) => void;
  searchRef: React.RefObject<HTMLInputElement | null>;
  className?: string;
};

export function LibraryPane({ library, byId, inPlan, onAdd, previewId, onPreview, searchRef, className }: Props) {
  const index = useMemo(() => buildIndex(library), [library]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState<string | null>(null);
  const [equipment, setEquipment] = useState<string | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => searchLibrary(index, query, { area, equipment }), [index, query, area, equipment]);
  const areas = useMemo(() => BODY_AREAS.filter((a) => library.some((e) => e.bodyAreas.includes(a))), [library]);
  const equipments = useMemo(() => EQUIPMENT.filter((q) => q !== "none" && library.some((e) => e.equipment.includes(q))), [library]);
  const preview = previewId ? byId.get(previewId) : null;

  const focusResult = (i: number) => {
    const buttons = listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result]");
    if (!buttons?.length) return;
    buttons[Math.max(0, Math.min(buttons.length - 1, i))]?.focus();
  };

  const onSearchKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      if (query) {
        e.preventDefault();
        setQuery("");
      } else e.currentTarget.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusResult(0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[0] && query.trim()) {
        onAdd(results[0], "enter");
        setQuery("");
      }
    }
  };

  return (
    <div className={cn("flex min-h-0 flex-col", className)}>
      {preview ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-line px-4 py-2.5">
            <Button
              variant="ghost"
              size="sm"
              autoFocus
              icon={<ArrowLeft aria-hidden className="size-4" />}
              onClick={() => onPreview(null)}
              onKeyDown={(e) => e.key === "Escape" && onPreview(null)}
            >
              Results
            </Button>
          </div>
          <div
            className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                onPreview(null);
              }
            }}
          >
            <ExercisePreview
              exercise={preview}
              byId={byId}
              onSelectRelated={(id) => onPreview(id)}
              headingLevel="h3"
              actions={
                <div className="flex flex-col gap-2">
                  <Button block icon={<Plus aria-hidden className="size-4" />} onClick={() => onAdd(preview, "click")}>
                    {inPlan.get(preview.id) ? "Add again" : "Add to program"}
                  </Button>
                  {inPlan.get(preview.id) ? (
                    <p className="inline-flex items-center gap-1.5 text-sm text-muted">
                      <Check aria-hidden className="size-4" /> Already in this plan
                    </p>
                  ) : null}
                </div>
              }
            />
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-3 border-b border-line px-4 pt-4 pb-3">
            <SearchInput
              ref={searchRef}
              label="Search exercises"
              shortcut="/"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKey}
              aria-describedby="library-hint"
              aria-controls="library-results"
            />
            <div className="-mx-4 flex gap-1.5 overflow-x-auto px-4 no-scrollbar" role="group" aria-label="Filter by body area">
              {areas.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-pressed={area === a}
                  onClick={() => setArea(area === a ? null : a)}
                  className={cn(
                    "inline-flex h-8 shrink-0 items-center rounded-full border px-3 text-[13px] font-medium transition-colors",
                    area === a ? "border-ink bg-ink text-paper" : "border-line-strong text-ink hover:border-ink",
                  )}
                >
                  {areaLabel(a)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="library-equipment" className="sr-only">
                Equipment
              </label>
              <Select
                id="library-equipment"
                value={equipment ?? ""}
                onChange={(e) => setEquipment(e.target.value || null)}
                className="!h-9 flex-1 !text-sm"
              >
                <option value="">Any equipment</option>
                {equipments.map((q) => (
                  <option key={q} value={q}>
                    {equipmentLabel(q)}
                  </option>
                ))}
              </Select>
              <p id="library-hint" aria-live="polite" className="shrink-0 text-xs text-muted tabular">
                {results.length} {results.length === 1 ? "result" : "results"}
                {query.trim() && results.length ? <span className="hidden xl:inline"> · ↵ adds top</span> : null}
              </p>
            </div>
          </div>
          <ul
            ref={listRef}
            id="library-results"
            aria-label="Exercise results"
            className="min-h-0 flex-1 overflow-y-auto py-1"
            onKeyDown={(e) => {
              const buttons = [...(listRef.current?.querySelectorAll<HTMLButtonElement>("[data-result]") ?? [])];
              const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
              if (e.key === "ArrowDown") {
                e.preventDefault();
                focusResult(i + 1);
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                if (i <= 0) searchRef.current?.focus();
                else focusResult(i - 1);
              } else if (e.key === "Escape") {
                searchRef.current?.focus();
              }
            }}
          >
            {results.length === 0 ? (
              <li className="px-4 py-8 text-sm text-muted">
                No exercises match{query ? ` “${query}”` : ""}. Try a body area, a movement like “rotation”, or equipment like “band”.
              </li>
            ) : (
              results.map((exercise) => (
                <ResultRow
                  key={exercise.id}
                  exercise={exercise}
                  count={inPlan.get(exercise.id) ?? 0}
                  onPreview={() => onPreview(exercise.id)}
                  onAdd={() => onAdd(exercise, "click")}
                />
              ))
            )}
          </ul>
        </>
      )}
    </div>
  );
}

const ResultRow = forwardRef<
  HTMLLIElement,
  { exercise: LibraryExercise; count: number; onPreview: () => void; onAdd: () => void }
>(function ResultRow({ exercise, count, onPreview, onAdd }, ref) {
  return (
    <li ref={ref} className="group flex items-center gap-1 px-2">
      <button
        type="button"
        data-result
        onClick={onPreview}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-sunken focus-visible:bg-sunken"
      >
        <DemoThumb demo={exercise.demo} label={`${exercise.name} movement guide`} className="w-16 shrink-0" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-semibold tracking-[-0.01em]">{exercise.name}</span>
            {count ? (
              <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-muted">
                <Check aria-hidden className="size-3" />
                {count > 1 ? `×${count}` : null}
                <span className="sr-only">in plan</span>
              </span>
            ) : null}
          </span>
          <span className="block truncate text-xs text-muted">{exerciseMeta(exercise)}</span>
          <span className="block text-xs text-ink/70 tabular">{defaultDosageLabel(exercise)}</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onAdd}
        aria-label={`Add ${exercise.name} to program`}
        title="Add to program"
        className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-line-strong text-ink transition-colors hover:border-ink hover:bg-ink hover:text-paper"
      >
        <Plus aria-hidden className="size-4" />
      </button>
    </li>
  );
});

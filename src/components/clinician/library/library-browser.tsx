"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Video } from "lucide-react";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { Button } from "@/components/ui/button";
import { Field, Input, SearchInput, Select } from "@/components/ui/field";
import { EmptyState } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { BODY_AREAS, CATEGORIES, EQUIPMENT } from "@/content/types";
import { youTubeWatchUrl } from "@/lib/youtube";
import { setExerciseVideo } from "@/server/actions/clinician";
import type { LibraryExercise } from "@/server/services/clinician";
import { areaLabel, buildIndex, categoryLabel, DIFFICULTY_WORD, equipmentLabel, searchLibrary } from "../builder/model";
import { ExercisePreview } from "../builder/exercise-preview";
import { useSlashFocus } from "../hooks";

export function LibraryBrowser({ library }: { library: LibraryExercise[] }) {
  const index = useMemo(() => buildIndex(library), [library]);
  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const [query, setQuery] = useState("");
  const [area, setArea] = useState("");
  const [equipment, setEquipment] = useState("");
  const [category, setCategory] = useState("");
  const [source, setSource] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  useSlashFocus(searchRef);

  const results = useMemo(
    () => searchLibrary(index, query, { area: area || null, equipment: equipment || null, category: category || null, source: source || null }),
    [index, query, area, equipment, category, source],
  );
  const open = openId ? byId.get(openId) : null;
  const filtered = Boolean(query || area || equipment || category || source);

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <SearchInput
          ref={searchRef}
          label="Search by name, body area, movement, equipment or tag"
          shortcut="/"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setQuery("");
              e.currentTarget.blur();
            }
          }}
          className="w-full lg:max-w-md"
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
          <FilterSelect id="f-source" label="Library" value={source} onChange={setSource} any="All libraries">
            <option value="form">FORM rehab library</option>
            <option value="open">Open library (photos)</option>
          </FilterSelect>
          <FilterSelect id="f-area" label="Body area" value={area} onChange={setArea} any="Any area">
            {BODY_AREAS.map((a) => (
              <option key={a} value={a}>
                {areaLabel(a)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect id="f-equipment" label="Equipment" value={equipment} onChange={setEquipment} any="Any equipment">
            {EQUIPMENT.map((q) => (
              <option key={q} value={q}>
                {equipmentLabel(q)}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect id="f-category" label="Category" value={category} onChange={setCategory} any="Any category">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </FilterSelect>
        </div>
        <p aria-live="polite" className="text-sm text-muted tabular lg:ml-auto">
          {results.length} of {library.length}
          {filtered ? (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setArea("");
                setEquipment("");
                setCategory("");
                setSource("");
              }}
              className="ml-3 font-medium text-ink underline underline-offset-2"
            >
              Clear
            </button>
          ) : null}
        </p>
      </div>

      {results.length === 0 ? (
        <EmptyState title="No exercises match" description="Try fewer filters, or search a movement like “rotation” or “bridge”." />
      ) : (
        <ul className="grid grid-cols-1 gap-3 xs:grid-cols-2 md:grid-cols-3 xl:grid-cols-4">
          {results.map((e) => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setOpenId(e.id)}
                className="group flex h-full w-full flex-col overflow-hidden rounded-[14px] border border-line bg-surface text-left transition-colors hover:border-ink"
              >
                <span className="block p-1.5 pb-0">
                  <DemoThumb demo={e.demo} images={e.images} label={`${e.name} movement guide`} className="w-full" />
                </span>
                <span className="flex flex-1 flex-col gap-1 p-3.5">
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-semibold tracking-[-0.01em]">{e.name}</span>
                    {e.video?.clinicChoice ? (
                      <span title="Your clinic's video" className="mt-0.5 shrink-0 text-muted">
                        <Video aria-hidden className="size-4" />
                        <span className="sr-only">Has your clinic&rsquo;s video</span>
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[13px] text-muted">{e.bodyAreas.map(areaLabel).join(", ")}</span>
                  <span className="mt-auto flex flex-wrap gap-x-2 pt-1 text-xs text-muted">
                    <span>{e.equipment.filter((q) => q !== "none").map(equipmentLabel).join(", ") || "No equipment"}</span>
                    <span aria-hidden>·</span>
                    <span>{DIFFICULTY_WORD[e.difficulty]}</span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {open ? (
        <Sheet open onClose={() => setOpenId(null)} side="right" size="md" title={open.name} hideTitle>
          <ExercisePreview exercise={open} byId={byId} onSelectRelated={setOpenId} headingLevel="h3">
            <ClinicVideo key={open.id} exercise={open} />
          </ExercisePreview>
        </Sheet>
      ) : null}
    </>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  any,
  children,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  any: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Select id={id} value={value} onChange={(e) => onChange(e.target.value)} className="!h-11 !text-sm lg:w-44">
        <option value="">{any}</option>
        {children}
      </Select>
    </div>
  );
}

function ClinicVideo({ exercise }: { exercise: LibraryExercise }) {
  const router = useRouter();
  const toast = useToast();
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const video = exercise.video;
  const clinic = Boolean(video?.clinicChoice);

  const save = (next: string | null) =>
    start(async () => {
      setError(null);
      const result = await setExerciseVideo({ exerciseId: exercise.id, url: next });
      if (result.ok) {
        setUrl("");
        toast(next ? "Your clinic's video is now shown to patients" : "Using FORM's default", "success");
        router.refresh();
      } else setError(result.error);
    });

  return (
    <section aria-labelledby="clinic-video" className="rounded-[14px] border border-line bg-surface p-4">
      <h3 id="clinic-video" className="text-[15px] font-semibold">
        Clinic video
      </h3>
      <p className="mt-1 text-sm text-muted">
        {clinic
          ? "Chosen by your clinic. Patients see this video for every program that includes this exercise."
          : video
            ? `Patients see FORM's default video${video.source ? ` (${video.source})` : ""}.`
            : "Patients see FORM's movement guide. Add a YouTube video to show your own demonstration."}
      </p>
      {video?.provider === "youtube" ? (
        <p className="mt-2 text-sm">
          <span className="kicker mr-2 text-muted">{clinic ? "Chosen by your clinic" : "FORM default"}</span>
          <a href={youTubeWatchUrl(video.id)} target="_blank" rel="noreferrer noopener" className="font-medium underline underline-offset-2">
            Open on YouTube<span className="sr-only"> (opens in a new tab)</span>
          </a>
        </p>
      ) : null}
      <form
        className="mt-4 flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!url.trim()) return setError("Paste a YouTube link first.");
          save(url.trim());
        }}
      >
        <Field label="YouTube link" htmlFor={`video-${exercise.id}`} error={error}>
          <Input
            id={`video-${exercise.id}`}
            type="url"
            inputMode="url"
            placeholder="https://www.youtube.com/watch?v=…"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            aria-invalid={error ? true : undefined}
            className="!h-11"
          />
        </Field>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" variant="dark" loading={pending}>
            {clinic ? "Replace video" : "Use this video"}
          </Button>
          {clinic ? (
            <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => save(null)}>
              Use FORM&rsquo;s default
            </Button>
          ) : null}
        </div>
      </form>
    </section>
  );
}

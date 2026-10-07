"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BookmarkPlus, LayoutTemplate, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { Sheet } from "@/components/ui/sheet";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { formatDays, formatDay, addDays } from "@/lib/dates";
import { formatDosage } from "@/lib/dosage";
import { saveProgram, saveTemplate } from "@/server/actions/clinician";
import type { LibraryExercise, TemplateSummary } from "@/server/services/clinician";
import { useMediaQuery } from "../hooks";
import { LibraryPane } from "./library-pane";
import { ProgramCanvas } from "./canvas";
import { ConfigPane } from "./config-pane";
import {
  hasErrors,
  itemFromExercise,
  itemsFromTemplate,
  minutesFor,
  newKey,
  snapshot,
  suggestTitle,
  toDraft,
  validate,
  type BuilderItem,
  type BuilderState,
  type DraftInput,
  type Errors,
} from "./model";

type Common = {
  library: LibraryExercise[];
  templates: TemplateSummary[];
  defaultDays: number[];
  clinicianFirstName: string;
};

export type ProgramBuilderProps = Common &
  (
    | {
        mode: "program";
        patient: { id: string; name: string; firstName: string };
        today: string;
        /** Present when editing an existing program. */
        existing: { programId: string; version: number; draft: DraftInput } | null;
      }
    | {
        mode: "template";
        template: { id: string; name: string; description: string | null; draft: DraftInput } | null;
      }
  );

function initialState(props: ProgramBuilderProps): BuilderState {
  const fromDraft = (draft: DraftInput, title: string): BuilderState => ({
    title,
    titleTouched: true,
    days: draft.days.length ? draft.days : props.defaultDays,
    note: draft.note ?? "",
    // Deterministic keys for the first render (server and client must match).
    items: draft.items.map((item, i) => ({ ...item, key: `init-${i}` })),
  });
  if (props.mode === "program" && props.existing) return fromDraft(props.existing.draft, props.existing.draft.title);
  if (props.mode === "template" && props.template) return fromDraft(props.template.draft, props.template.name);
  return { title: "", titleTouched: false, days: props.defaultDays, note: "", items: [] };
}

export function ProgramBuilder(props: ProgramBuilderProps) {
  const { library, templates, mode } = props;
  const router = useRouter();
  const toast = useToast();
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  const byId = useMemo(() => new Map(library.map((e) => [e.id, e])), [library]);
  const [state, setState] = useState<BuilderState>(() => initialState(props));
  const [description, setDescription] = useState(props.mode === "template" ? props.template?.description ?? "" : "");
  const initialSnap = useRef<string>(snapshot(initialState(props)) + (props.mode === "template" ? props.template?.description ?? "" : ""));
  const [selectedKey, setSelectedKey] = useState<string | null>(state.items[0]?.key ?? null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Errors | null>(null);
  const [announce, setAnnounce] = useState("");
  const [sheet, setSheet] = useState<null | "library" | "config" | "templates" | "saveTemplate" | "review">(null);
  const saved = useRef(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);
  const configFirstRef = useRef<HTMLInputElement>(null);
  const pendingFocus = useRef<"config" | null>(null);

  const dirty = snapshot(state) + description !== initialSnap.current;
  const minutes = minutesFor(state.items, byId);
  const inPlan = useMemo(() => {
    const m = new Map<string, number>();
    for (const i of state.items) m.set(i.exerciseId, (m.get(i.exerciseId) ?? 0) + 1);
    return m;
  }, [state.items]);
  const selectedIndex = state.items.findIndex((i) => i.key === selectedKey);
  const selected = selectedIndex >= 0 ? state.items[selectedIndex] : null;

  /* ---------- Unsaved changes ---------- */
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saved.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  // Client-side navigation (sidebar, back link) doesn't fire beforeunload: ask on link clicks too.
  useEffect(() => {
    if (!dirty) return;
    const onClick = (e: MouseEvent) => {
      if (saved.current || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const anchor = (e.target as HTMLElement | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.origin !== window.location.origin) return;
      if (anchor.pathname === window.location.pathname) return;
      if (!window.confirm("Leave without saving? Your changes to this plan will be lost.")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  /* ---------- Keyboard: "/" → search ---------- */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement;
      const numeric = t.tagName === "INPUT" && t.getAttribute("inputmode") === "numeric";
      if ((!numeric && (["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName) || t.isContentEditable)) || document.querySelector("dialog[open]")) return;
      e.preventDefault();
      if (!isDesktop) return setSheet("library");
      setPreviewId(null);
      window.setTimeout(() => {
        searchRef.current?.focus();
        searchRef.current?.select();
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isDesktop]);

  /* ---------- Focus management after adding ---------- */
  useEffect(() => {
    if (pendingFocus.current === "config" && isDesktop) {
      pendingFocus.current = null;
      configFirstRef.current?.focus();
      configFirstRef.current?.select();
    }
  });

  /* ---------- Mutations ---------- */
  const update = useCallback(
    (fn: (s: BuilderState) => BuilderState) =>
      setState((s) => {
        const next = fn(s);
        if (!next.titleTouched && mode === "program" && next.items !== s.items) {
          return { ...next, title: suggestTitle(next.items, byId) };
        }
        return next;
      }),
    [byId, mode],
  );

  useEffect(() => {
    if (errors) setErrors(validate(state, mode));
    // Re-validate live once the clinician has tried to submit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const addExercise = (exercise: LibraryExercise, how: "click" | "enter") => {
    const item = itemFromExercise(exercise);
    update((s) => ({ ...s, items: [...s.items, item] }));
    setSelectedKey(item.key);
    setAnnounce(`Added ${exercise.name}, ${formatDosage(item)}. ${state.items.length + 1} in plan.`);
    if (how === "click") {
      setPreviewId(null);
      if (isDesktop) pendingFocus.current = "config";
      else setSheet("config");
    }
    window.setTimeout(() => {
      document.querySelector(`[data-item="${item.key}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }, 40);
  };

  const patchItem = (key: string, patch: Partial<BuilderItem>) =>
    update((s) => ({ ...s, items: s.items.map((i) => (i.key === key ? { ...i, ...patch } : i)) }));

  const removeItem = (key: string) => {
    const index = state.items.findIndex((i) => i.key === key);
    const item = state.items[index];
    const remaining = state.items.filter((i) => i.key !== key);
    update((s) => ({ ...s, items: s.items.filter((i) => i.key !== key) }));
    if (selectedKey === key) setSelectedKey(remaining[Math.min(index, remaining.length - 1)]?.key ?? null);
    const name = byId.get(item.exerciseId)?.name ?? "Exercise";
    setAnnounce(`Removed ${name}.`);
    toast(`Removed ${name}`);
  };

  const duplicateItem = (key: string) => {
    const index = state.items.findIndex((i) => i.key === key);
    if (index < 0) return;
    const copy = { ...state.items[index], key: newKey(), lineageId: null };
    update((s) => {
      const items = [...s.items];
      items.splice(index + 1, 0, copy);
      return { ...s, items };
    });
    setSelectedKey(copy.key);
    setAnnounce(`Duplicated ${byId.get(copy.exerciseId)?.name ?? "exercise"}.`);
  };

  const applyTemplate = (template: TemplateSummary, how: "replace" | "append") => {
    const known = new Set<string>(byId.keys());
    const items = itemsFromTemplate(template, known);
    setState((s) => ({
      ...s,
      title: s.titleTouched ? s.title : template.name,
      titleTouched: true,
      days: how === "replace" || s.items.length === 0 ? template.days : s.days,
      items: how === "replace" ? items : [...s.items, ...items],
    }));
    setSelectedKey(items[0]?.key ?? null);
    setSheet(null);
    const skipped = template.items.length - items.length;
    toast(
      `${how === "replace" ? "Started from" : "Added"} “${template.name}”${skipped ? ` · ${skipped} unavailable exercise${skipped === 1 ? "" : "s"} skipped` : ""}`,
      "success",
    );
  };

  /* ---------- Submit ---------- */
  const [pending, start] = useTransition();
  const [submitError, setSubmitError] = useState<string | null>(null);

  const check = () => {
    const e = validate(state, mode);
    if (hasErrors(e)) {
      setErrors(e);
      setSheet(null);
      const firstBad = Object.keys(e.byItem)[0];
      if (e.title) titleRef.current?.focus();
      else if (firstBad) setSelectedKey(firstBad);
      setAnnounce(e.title ?? e.days ?? e.items ?? e.byItem[firstBad] ?? "Please check the plan.");
      return false;
    }
    setErrors(null);
    return true;
  };

  const openReview = () => {
    if (!check()) return;
    setSubmitError(null);
    setSheet("review");
  };

  const submitProgram = (startDate: string | null) => {
    if (props.mode !== "program") return;
    const patient = props.patient;
    start(async () => {
      const result = await saveProgram({
        patientId: patient.id,
        programId: props.existing?.programId ?? null,
        draft: toDraft(state),
        startDate,
      });
      if (!result.ok) {
        setSubmitError(result.error);
        return;
      }
      saved.current = true;
      if (!props.existing) toast(`Assigned to ${patient.firstName}`, "success");
      else if (!result.data.changed) toast("No changes to save");
      else {
        const summary = result.data.changeSummary;
        toast(
          <span>
            Saved v{props.existing.version + 1}
            {summary.length ? <span className="text-night-muted"> · {summary.slice(0, 2).join(" · ")}{summary.length > 2 ? ` +${summary.length - 2}` : ""}</span> : null}
          </span>,
          "success",
        );
      }
      router.push(`/clinic/patients/${patient.id}`);
    });
  };

  const submitTemplate = () => {
    if (props.mode !== "template" || !check()) return;
    const { title: _t, ...draft } = toDraft(state);
    start(async () => {
      const result = await saveTemplate({
        templateId: props.template?.id ?? null,
        name: state.title.trim(),
        description: description.trim() || null,
        draft,
      });
      if (!result.ok) {
        toast(result.error, "error");
        setSubmitError(result.error);
        return;
      }
      saved.current = true;
      toast(props.template ? "Template saved" : "Template created", "success");
      router.push("/clinic/templates");
    });
  };

  /* ---------- Render ---------- */
  const backHref = props.mode === "program" ? `/clinic/patients/${props.patient.id}` : "/clinic/templates";
  const backLabel = props.mode === "program" ? props.patient.name : "Templates";
  const primaryLabel =
    props.mode === "template" ? "Save template" : props.existing ? "Review changes" : "Review & assign";

  const library_ = (
    <LibraryPane
      library={library}
      byId={byId}
      inPlan={inPlan}
      onAdd={addExercise}
      previewId={previewId}
      onPreview={setPreviewId}
      searchRef={searchRef}
      className="h-full"
    />
  );

  const config_ = (
    <ConfigPane
      item={selected}
      exercise={selected ? byId.get(selected.exerciseId) : undefined}
      programDays={state.days}
      patientFirstName={props.mode === "program" ? props.patient.firstName : null}
      clinicianFirstName={props.clinicianFirstName}
      index={selectedIndex}
      error={selected ? errors?.byItem[selected.key] : undefined}
      firstFieldRef={configFirstRef}
      onChange={(patch) => selected && patchItem(selected.key, patch)}
      onApplyDaysToAll={(days) => {
        update((s) => ({ ...s, items: s.items.map((i) => ({ ...i, days })) }));
        toast(days ? `All exercises: ${formatDays(days)} only` : "All exercises: every program day", "success");
      }}
      onPreview={(id) => {
        setPreviewId(id);
        if (!isDesktop) setSheet("library");
      }}
    />
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>

      {/* Top bar */}
      <div className="sticky top-14 z-[var(--z-nav)] flex h-14 items-center gap-3 border-b border-line bg-paper px-4 lg:top-0 lg:px-5">
        <Link
          href={backHref}
          className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-md pr-2 text-sm text-muted transition-colors hover:text-ink"
        >
          <ArrowLeft aria-hidden className="size-4 shrink-0" />
          <span className="truncate">{backLabel}</span>
        </Link>
        <span aria-hidden className="hidden h-5 w-px bg-line sm:block" />
        <h1 className="kicker sr-only min-w-0 truncate text-muted sm:not-sr-only">
          {props.mode === "template"
            ? props.template
              ? "Edit template"
              : "New template"
            : props.existing
              ? `Editing v${props.existing.version}`
              : "New program"}
          {dirty ? <span className="ml-2 text-ink">· Unsaved</span> : null}
        </h1>
        <div className="ml-auto flex items-center gap-1.5">
          {templates.length ? (
            <Button variant="ghost" size="sm" onClick={() => setSheet("templates")} icon={<LayoutTemplate aria-hidden className="size-4" />}>
              <span className="hidden md:inline">Start from template</span>
              <span className="md:hidden">Template</span>
            </Button>
          ) : null}
          {props.mode === "program" ? (
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => {
                if (!check()) return;
                setSubmitError(null);
                setSheet("saveTemplate");
              }}
              icon={<BookmarkPlus aria-hidden className="size-4" />}
            >
              <span className="hidden xl:inline">Save as template</span>
              <span className="xl:hidden">Save template</span>
            </Button>
          ) : null}
          <Button size="sm" onClick={props.mode === "template" ? submitTemplate : openReview} loading={props.mode === "template" && pending}>
            {primaryLabel}
          </Button>
        </div>
      </div>

      {submitError && props.mode === "template" ? (
        <Alert tone="danger" className="mx-4 mt-3">
          {submitError}
        </Alert>
      ) : null}

      {/* Panes */}
      <div className="grid flex-1 lg:grid-cols-[minmax(250px,290px)_minmax(0,1fr)_minmax(260px,300px)] 2xl:grid-cols-[340px_minmax(0,1fr)_360px]">
        {isDesktop ? (
          <aside aria-label="Exercise library" className="sticky top-14 h-[calc(100dvh-3.5rem)] border-r border-line bg-surface">
            {library_}
          </aside>
        ) : null}

        <section aria-label="Program" className="min-w-0 px-4 py-6 sm:px-6 lg:px-6 lg:py-8 xl:px-10">
          <div className="mx-auto max-w-2xl">
            <ProgramCanvas
              state={state}
              byId={byId}
              selectedKey={selectedKey}
              errors={errors}
              minutes={minutes}
              mode={mode}
              titlePlaceholder={props.mode === "template" ? "Template name" : "Program title"}
              titleRef={titleRef}
              onTitle={(title) => setState((s) => ({ ...s, title, titleTouched: true }))}
              onDays={(days) => update((s) => ({ ...s, days }))}
              onNote={(note) => setState((s) => ({ ...s, note }))}
              description={description}
              onDescription={setDescription}
              onSelect={(key) => {
                setSelectedKey(key);
                if (!isDesktop) setSheet("config");
              }}
              onItems={(items, message) => {
                update((s) => ({ ...s, items }));
                if (message) setAnnounce(message);
              }}
              onRemove={removeItem}
              onDuplicate={duplicateItem}
              onBrowse={() => {
                if (!isDesktop) return setSheet("library");
                setPreviewId(null);
                window.setTimeout(() => searchRef.current?.focus(), 0);
              }}
            />
          </div>
        </section>

        {isDesktop ? (
          <aside aria-label="Exercise configuration" className="sticky top-14 h-[calc(100dvh-3.5rem)] overflow-y-auto border-l border-line bg-surface">
            {config_}
          </aside>
        ) : null}
      </div>

      {/* Mobile: floating add */}
      {!isDesktop ? (
        <div className="sticky bottom-0 z-[var(--z-nav)] border-t border-line bg-paper px-4 py-3 safe-bottom">
          <Button block size="lg" variant="dark" onClick={() => setSheet("library")} icon={<Search aria-hidden className="size-4" />}>
            Add exercise
          </Button>
        </div>
      ) : null}

      {/* Sheets (mounted only when open: Sheet uses a fixed heading id) */}
      {!isDesktop && sheet === "library" ? (
        <Sheet open onClose={() => setSheet(null)} side="right" size="md" title="Exercise library">
          <div className="-mx-6 -mt-4 h-[calc(100dvh-5.5rem)]">{library_}</div>
        </Sheet>
      ) : null}

      {!isDesktop && sheet === "config" && selected ? (
        <Sheet
          open
          onClose={() => setSheet(null)}
          title={byId.get(selected.exerciseId)?.name ?? "Configure"}
          hideTitle
          footer={
            <Button block variant="dark" onClick={() => setSheet(null)}>
              Done
            </Button>
          }
        >
          <div className="-mx-6 -mt-4">{config_}</div>
        </Sheet>
      ) : null}

      {sheet === "templates" ? (
        <TemplatesSheet
          templates={templates}
          hasItems={state.items.length > 0}
          onClose={() => setSheet(null)}
          onApply={applyTemplate}
        />
      ) : null}

      {sheet === "saveTemplate" ? (
        <SaveTemplateSheet
          defaultName={state.title}
          onClose={() => setSheet(null)}
          draft={toDraft(state)}
        />
      ) : null}

      {sheet === "review" && props.mode === "program" ? (
        <ReviewSheet
          patientName={props.patient.name}
          patientFirstName={props.patient.firstName}
          isEdit={Boolean(props.existing)}
          version={props.existing?.version ?? 0}
          title={state.title.trim()}
          count={state.items.length}
          days={state.days}
          minutes={minutes}
          today={props.today}
          pending={pending}
          error={submitError}
          onClose={() => setSheet(null)}
          onSubmit={submitProgram}
        />
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function TemplatesSheet({
  templates,
  hasItems,
  onClose,
  onApply,
}: {
  templates: TemplateSummary[];
  hasItems: boolean;
  onClose: () => void;
  onApply: (t: TemplateSummary, how: "replace" | "append") => void;
}) {
  return (
    <Sheet open onClose={onClose} side="right" size="md" title="Start from template" description="Templates are a starting point. Everything stays editable.">
      <ul className="flex flex-col gap-3">
        {templates.map((t) => (
          <li key={t.id} className="rounded-[14px] border border-line bg-surface p-4">
            <p className="font-semibold tracking-[-0.01em]">{t.name}</p>
            {t.description ? <p className="mt-0.5 text-sm text-muted">{t.description}</p> : null}
            <p className="kicker mt-2 text-muted">
              {t.count} {t.count === 1 ? "exercise" : "exercises"} · {formatDays(t.days)} · ~{t.minutes} min
            </p>
            <ol className="mt-2 flex flex-col gap-0.5 text-sm">
              {t.items.map((i, n) => (
                <li key={`${i.exerciseId}-${n}`} className="flex justify-between gap-3">
                  <span className="truncate">{i.name}</span>
                  <span className="shrink-0 text-muted tabular">{formatDosage(i)}</span>
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap gap-2">
              {hasItems ? (
                <>
                  <Button size="sm" variant="dark" onClick={() => onApply(t, "replace")}>
                    Replace plan
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => onApply(t, "append")} icon={<Plus aria-hidden className="size-4" />}>
                    Add to plan
                  </Button>
                </>
              ) : (
                <Button size="sm" variant="dark" onClick={() => onApply(t, "replace")}>
                  Use template
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

function SaveTemplateSheet({ defaultName, draft, onClose }: { defaultName: string; draft: DraftInput; onClose: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(defaultName);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <Sheet
      open
      onClose={onClose}
      side="center"
      size="sm"
      title="Save as template"
      description={`${draft.items.length} exercises · ${formatDays(draft.days)}. Patient-specific notes are kept; edit them later in Templates.`}
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return setError("Name the template.");
          const { title: _t, ...rest } = draft;
          start(async () => {
            const result = await saveTemplate({ templateId: null, name: name.trim(), description: description.trim() || null, draft: rest });
            if (result.ok) {
              toast(`Saved “${name.trim()}” to templates`, "success");
              onClose();
            } else setError(result.error);
          });
        }}
      >
        {error ? <Alert tone="danger">{error}</Alert> : null}
        <Field label="Name" htmlFor="tpl-name">
          <Input id="tpl-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Description" htmlFor="tpl-desc" optional>
          <Textarea id="tpl-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} />
        </Field>
        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="dark" loading={pending}>
            Save template
          </Button>
        </div>
      </form>
    </Sheet>
  );
}

function ReviewSheet({
  patientName,
  patientFirstName,
  isEdit,
  version,
  title,
  count,
  days,
  minutes,
  today,
  pending,
  error,
  onClose,
  onSubmit,
}: {
  patientName: string;
  patientFirstName: string;
  isEdit: boolean;
  version: number;
  title: string;
  count: number;
  days: number[];
  minutes: number;
  today: string;
  pending: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (startDate: string | null) => void;
}) {
  const [later, setLater] = useState(false);
  const [date, setDate] = useState(addDays(today, 1));
  const dateValid = !later || (date > today && /^\d{4}-\d{2}-\d{2}$/.test(date));

  return (
    <Sheet
      open
      onClose={onClose}
      side="center"
      size="sm"
      title={isEdit ? "Save changes?" : "Ready to assign?"}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Keep editing
          </Button>
          <Button onClick={() => onSubmit(isEdit ? null : later ? date : null)} loading={pending} disabled={!dateValid}>
            {isEdit ? "Save changes" : "Assign program"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="rounded-[14px] border border-line bg-surface p-5">
          <p className="kicker text-muted">{patientName}</p>
          <p className="mt-1.5 text-xl font-black tracking-[-0.035em]">{title}</p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="kicker text-muted">Exercises</dt>
              <dd className="mt-1 font-semibold tabular">{count}</dd>
            </div>
            <div>
              <dt className="kicker text-muted">Schedule</dt>
              <dd className="mt-1 font-semibold">{formatDays(days)}</dd>
            </div>
            <div>
              <dt className="kicker text-muted">Session</dt>
              <dd className="mt-1 font-semibold tabular">~{minutes} min</dd>
            </div>
          </dl>
        </div>

        {isEdit ? (
          <p className="text-[15px] text-ink/80">
            Saving creates version {version + 1}. {patientFirstName}&rsquo;s session in progress today keeps its current version.
          </p>
        ) : (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-sm font-medium">Starts</legend>
            <label className="flex cursor-pointer items-center gap-3 text-[15px]">
              <input type="radio" name="starts" checked={!later} onChange={() => setLater(false)} className="size-4 accent-[var(--color-ink)]" />
              Today <span className="text-muted">· {formatDay(today, { weekday: "short", month: "short", day: "numeric" })}</span>
            </label>
            <label className="flex cursor-pointer items-center gap-3 text-[15px]">
              <input type="radio" name="starts" checked={later} onChange={() => setLater(true)} className="size-4 accent-[var(--color-ink)]" />
              Later
            </label>
            {later ? (
              <div className="pl-7">
                <label htmlFor="start-date" className="sr-only">
                  Start date
                </label>
                <Input
                  id="start-date"
                  type="date"
                  min={addDays(today, 1)}
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  aria-invalid={!dateValid || undefined}
                  className="!h-11 max-w-[220px]"
                />
                {!dateValid ? <p className="mt-1 text-sm text-danger">Choose a date after today.</p> : null}
              </div>
            ) : null}
            <p className={cn("mt-1 text-sm text-muted")}>
              {patientFirstName} gets a notification and sees the plan in FORM.
            </p>
          </fieldset>
        )}
        {error ? <Alert tone="danger">{error}</Alert> : null}
      </div>
    </Sheet>
  );
}

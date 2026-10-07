"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type Announcements,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, Copy, GripVertical, MessageSquareText, Trash2 } from "lucide-react";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { formatDays } from "@/lib/dates";
import { formatDosage, SIDE_LABEL } from "@/lib/dosage";
import type { LibraryExercise } from "@/server/services/clinician";
import { DayToggles } from "./controls";
import { LIMITS, subsetDays, type BuilderItem, type BuilderState, type Errors } from "./model";

type Props = {
  state: BuilderState;
  byId: Map<string, LibraryExercise>;
  selectedKey: string | null;
  errors: Errors | null;
  minutes: number;
  mode: "program" | "template";
  titlePlaceholder: string;
  titleRef: React.RefObject<HTMLInputElement | null>;
  onTitle: (title: string) => void;
  onDays: (days: number[]) => void;
  onNote: (note: string) => void;
  /** Template mode only. */
  description?: string;
  onDescription?: (description: string) => void;
  onSelect: (key: string) => void;
  onItems: (items: BuilderItem[], announce?: string) => void;
  onRemove: (key: string) => void;
  onDuplicate: (key: string) => void;
  onBrowse: () => void;
};

export function ProgramCanvas(props: Props) {
  const { state, byId, selectedKey, errors, minutes, mode } = props;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const nameOf = (key: string | number) => {
    const item = state.items.find((i) => i.key === key);
    return item ? byId.get(item.exerciseId)?.name ?? "Exercise" : "Exercise";
  };
  const position = (key: string | number) => state.items.findIndex((i) => i.key === key) + 1;
  const announcements: Announcements = {
    onDragStart: ({ active }) => `Picked up ${nameOf(active.id)}, position ${position(active.id)} of ${state.items.length}.`,
    onDragOver: ({ active, over }) => (over ? `${nameOf(active.id)} is over position ${position(over.id)}.` : `${nameOf(active.id)} is no longer over a position.`),
    onDragEnd: ({ active, over }) => (over ? `${nameOf(active.id)} dropped at position ${position(over.id)}.` : `${nameOf(active.id)} dropped.`),
    onDragCancel: ({ active }) => `Moving ${nameOf(active.id)} cancelled.`,
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const from = state.items.findIndex((i) => i.key === active.id);
    const to = state.items.findIndex((i) => i.key === over.id);
    if (from < 0 || to < 0) return;
    props.onItems(arrayMove(state.items, from, to));
  };

  const move = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= state.items.length) return;
    const item = state.items[index];
    props.onItems(arrayMove(state.items, index, to), `${nameOf(item.key)} moved to position ${to + 1} of ${state.items.length}.`);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="program-title" className="kicker mb-1.5 block text-muted">
            {mode === "template" ? "Template name" : "Program title"}
          </label>
          <input
            ref={props.titleRef}
            id="program-title"
            value={state.title}
            onChange={(e) => props.onTitle(e.target.value)}
            placeholder={props.titlePlaceholder}
            maxLength={LIMITS.title}
            aria-invalid={errors?.title ? true : undefined}
            aria-describedby={errors?.title ? "title-error" : undefined}
            className="w-full rounded-md border border-transparent bg-transparent px-2 py-1 -mx-2 text-[26px] leading-tight font-black tracking-[-0.04em] text-ink placeholder:text-faint hover:border-line focus:border-ink focus:bg-white focus:outline-none aria-[invalid=true]:border-danger"
          />
          {errors?.title ? (
            <p id="title-error" role="alert" className="mt-1 text-sm text-danger">
              {errors.title}
            </p>
          ) : null}
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span id="schedule-label" className="kicker text-muted">
              Schedule
            </span>
            <span className="text-xs text-muted tabular">
              {state.days.length ? formatDays(state.days) : "No days"}
              {state.items.length ? ` · ${state.items.length} ${state.items.length === 1 ? "exercise" : "exercises"} · ~${minutes} min` : ""}
            </span>
          </div>
          <DayToggles label="Program days" value={state.days} onChange={props.onDays} />
          {errors?.days ? (
            <p role="alert" className="mt-1.5 text-sm text-danger">
              {errors.days}
            </p>
          ) : null}
        </div>
      </div>

      <div>
        {state.items.length === 0 ? (
          <div className="flex flex-col items-start gap-3 rounded-[14px] border border-dashed border-line-strong px-6 py-10">
            <p className="text-[17px] font-semibold tracking-[-0.015em]">Your plan is ready for exercises.</p>
            <p className="text-[15px] text-muted">Search the library to get started.</p>
            <button
              type="button"
              onClick={props.onBrowse}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-line-strong px-3 text-sm font-semibold hover:border-ink"
            >
              Search the library
              <kbd className="rounded border border-line px-1.5 font-mono text-[11px] text-muted">/</kbd>
            </button>
            {errors?.items ? (
              <p role="alert" className="text-sm text-danger">
                {errors.items}
              </p>
            ) : null}
          </div>
        ) : (
          <DndContext id="program-canvas" sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd} accessibility={{ announcements }}>
            <SortableContext items={state.items.map((i) => i.key)} strategy={verticalListSortingStrategy}>
              <ol aria-label="Exercises in this program" className="flex flex-col gap-1.5">
                {state.items.map((item, index) => (
                  <SortableRow
                    key={item.key}
                    item={item}
                    index={index}
                    total={state.items.length}
                    exercise={byId.get(item.exerciseId)}
                    programDays={state.days}
                    selected={item.key === selectedKey}
                    error={errors?.byItem[item.key]}
                    onSelect={() => props.onSelect(item.key)}
                    onUp={() => move(index, -1)}
                    onDown={() => move(index, 1)}
                    onDuplicate={() => props.onDuplicate(item.key)}
                    onRemove={() => props.onRemove(item.key)}
                  />
                ))}
              </ol>
            </SortableContext>
          </DndContext>
        )}
        {errors?.items && state.items.length ? (
          <p role="alert" className="mt-2 text-sm text-danger">
            {errors.items}
          </p>
        ) : null}
      </div>

      {mode === "program" ? (
      <div>
        <label htmlFor="program-note" className="kicker mb-1.5 flex items-baseline justify-between text-muted">
          <span>Program note</span>
          <span className="font-sans text-xs tracking-normal normal-case">Optional</span>
        </label>
        <Textarea
          id="program-note"
          rows={2}
          value={state.note}
          onChange={(e) => props.onNote(e.target.value)}
          maxLength={LIMITS.note}
          placeholder="A line for the whole plan — e.g. “Little and often. Stop if pain is sharp.”"
          className="text-[15px]"
        />
      </div>
      ) : (
        <div>
          <label htmlFor="template-description" className="kicker mb-1.5 flex items-baseline justify-between text-muted">
            <span>Description</span>
            <span className="font-sans text-xs tracking-normal normal-case">Optional</span>
          </label>
          <Textarea
            id="template-description"
            rows={2}
            value={props.description ?? ""}
            onChange={(e) => props.onDescription?.(e.target.value)}
            maxLength={300}
            placeholder="When to use it — e.g. “Early-stage mobility for desk-related neck stiffness.”"
            className="text-[15px]"
          />
        </div>
      )}
    </div>
  );
}

function SortableRow({ item, index, total, exercise, programDays, selected, error, onSelect, onUp, onDown, onDuplicate, onRemove }: {
    item: BuilderItem;
    index: number;
    total: number;
    exercise: LibraryExercise | undefined;
    programDays: number[];
    selected: boolean;
    error?: string;
    onSelect: () => void;
    onUp: () => void;
    onDown: () => void;
    onDuplicate: () => void;
    onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: item.key });
  const name = exercise?.name ?? "Exercise";
  const subset = subsetDays(item.days, programDays);

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      data-item={item.key}
      className={cn(
        "group relative flex items-center gap-2 rounded-[12px] border bg-surface pr-1.5 pl-1 transition-[border-color,box-shadow,background-color]",
        selected ? "border-ink shadow-[0_0_0_1px_var(--color-ink)]" : "border-line hover:border-line-strong",
        error && !selected && "border-danger",
        isDragging && "z-10 shadow-[var(--shadow-lift)]",
      )}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Reorder ${name}. Press space to pick up, arrow keys to move.`}
        aria-roledescription="sortable"
        className="inline-flex h-14 w-7 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-faint hover:text-ink active:cursor-grabbing"
      >
        <GripVertical aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        aria-label={`${String(index + 1).padStart(2, "0")} ${name}, ${formatDosage(item)}. Configure`}
        className="flex min-w-0 flex-1 items-center gap-3 py-2 text-left"
      >
        <span className="kicker w-5 shrink-0 text-muted tabular">{String(index + 1).padStart(2, "0")}</span>
        <span className="hidden w-14 shrink-0 sm:block"><DemoThumb demo={exercise?.demo ?? null} images={exercise?.images} label={name} className="w-full" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
            <span className="font-medium text-ink tabular">{formatDosage(item)}</span>
            {item.side !== "both" ? <span>{SIDE_LABEL[item.side]}</span> : null}
            {subset ? (
              <Badge tone="outline" className="!h-5 !text-[11px]">
                {formatDays(subset)} only
              </Badge>
            ) : null}
            {item.note?.trim() ? (
              <span className="inline-flex items-center gap-1">
                <MessageSquareText aria-hidden className="size-3.5" />
                Note
              </span>
            ) : null}
            {error ? <span className="text-danger">{error}</span> : null}
          </span>
        </span>
      </button>
      <div
        className={cn(
          "flex shrink-0 items-center gap-0.5 transition-opacity",
          selected ? "opacity-100" : "opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100",
        )}
      >
        <RowButton label={`Move ${name} up`} onClick={onUp} disabled={index === 0}>
          <ArrowUp aria-hidden className="size-4" />
        </RowButton>
        <RowButton label={`Move ${name} down`} onClick={onDown} disabled={index === total - 1}>
          <ArrowDown aria-hidden className="size-4" />
        </RowButton>
        <RowButton label={`Duplicate ${name}`} onClick={onDuplicate} className="hidden sm:inline-flex">
          <Copy aria-hidden className="size-4" />
        </RowButton>
        <RowButton label={`Remove ${name}`} onClick={onRemove} className="hover:text-danger">
          <Trash2 aria-hidden className="size-4" />
        </RowButton>
      </div>
    </li>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-sunken hover:text-ink disabled:opacity-30",
        className,
      )}
    >
      {children}
    </button>
  );
}

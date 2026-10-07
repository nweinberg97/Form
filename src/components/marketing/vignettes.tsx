import type { ReactNode } from "react";
import { DemoThumb } from "@/components/exercise/exercise-demo";
import { cn } from "@/lib/cn";
import { libraryExercise } from "./library";

/*
 * Product vignettes for the landing page: small, calm, static renderings of
 * the real FORM interface. They are illustrations, not working UI — nothing
 * here is focusable or clickable, and each one is announced as a single image
 * with a plain description.
 */

function Vignette({
  label,
  children,
  className,
  padded = true,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cn(
        "relative overflow-hidden rounded-[20px] bg-paper text-ink select-none",
        padded && "p-4 sm:p-5",
        className,
      )}
    >
      <div aria-hidden className="pointer-events-none">
        {children}
      </div>
    </div>
  );
}

/** A non-interactive stand-in for a button. */
function FauxButton({ children, variant = "primary", className }: { children: ReactNode; variant?: "primary" | "secondary"; className?: string }) {
  return (
    <span
      className={cn(
        "flex h-12 items-center justify-center rounded-[10px] text-[15px] font-semibold",
        variant === "primary" ? "bg-signal text-ink" : "border border-line-strong text-ink",
        className,
      )}
    >
      {children}
    </span>
  );
}

const TODAY_ITEMS = [
  { slug: "chin-tuck", name: "Chin Tuck", dose: "2 × 10" },
  { slug: "wall-angels", name: "Wall Angels", dose: "2 × 8" },
  { slug: "thoracic-rotation", name: "Thoracic Rotation", dose: "2 × 8 / side" },
  { slug: "upper-trapezius-stretch", name: "Upper Trapezius Stretch", dose: "2 × 30 sec / side" },
];

/** Beat 01 — Today. */
export function TodayVignette() {
  return (
    <Vignette label="Illustration of FORM's Today screen: today's rehabilitation, four exercises, about 12 minutes, with a Start session button.">
      <div className="flex items-center justify-between">
        <span className="kicker text-muted">Wednesday</span>
        <span className="flex size-7 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold">JL</span>
      </div>
      <p className="mt-4 text-[22px] leading-tight font-semibold tracking-[-0.025em]">Today&rsquo;s rehabilitation</p>
      <p className="mt-1 text-sm text-muted">4 exercises · about 12 min</p>
      <ol className="mt-4 divide-y divide-line rounded-[14px] border border-line bg-surface">
        {TODAY_ITEMS.map((item, i) => {
          const ex = libraryExercise(item.slug);
          return (
            <li key={item.slug} className="flex items-center gap-3 px-3 py-2.5">
              <span className="w-5 font-mono text-[11px] text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
              <DemoThumb demo={ex?.demo ?? null} label="" className="w-14 shrink-0 rounded-[7px]" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{ex?.name ?? item.name}</span>
                <span className="block text-xs text-muted tabular">{item.dose}</span>
              </span>
            </li>
          );
        })}
      </ol>
      <FauxButton className="mt-4">Start session</FauxButton>
    </Vignette>
  );
}

/** Beat 02 — Do it right. */
export function ExerciseVignette() {
  const ex = libraryExercise("wall-angels");
  const cues = ex?.formCues.slice(0, 2) ?? ["Keep your back against the wall.", "Move slowly, without shrugging."];
  return (
    <Vignette label="Illustration of an exercise screen: Wall Angels, exercise 2 of 4, a movement demonstration, two form cues, a note from the physio, and a Complete exercise button.">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full", i < 1 ? "bg-ink" : i === 1 ? "bg-signal" : "bg-line")} />
        ))}
      </div>
      <p className="kicker mt-4 text-muted">Exercise 2 of 4</p>
      <p className="mt-1 text-[22px] leading-tight font-semibold tracking-[-0.025em]">{ex?.name ?? "Wall Angels"}</p>
      <p className="mt-1 text-sm text-muted tabular">2 sets · 8 reps</p>
      <DemoThumb demo={ex?.demo ?? null} label="" className="mt-3 w-full rounded-[12px]" />
      <ul className="mt-3 space-y-1.5 text-sm">
        {cues.map((cue) => (
          <li key={cue} className="flex gap-2">
            <span className="mt-[7px] h-px w-3 shrink-0 bg-ink" />
            <span>{cue}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-[12px] bg-sunken px-3 py-2.5 text-sm">
        <span className="kicker block text-muted">From Marina</span>
        Stop at the height that stays comfortable.
      </div>
      <FauxButton className="mt-4">Complete exercise</FauxButton>
    </Vignette>
  );
}

/** Beat 03 — Tell your physio. */
export function FeedbackVignette() {
  const options = ["Easy", "Good", "Hard", "Painful"];
  return (
    <Vignette label="Illustration of the feedback step: How did Wall Angels feel? Four choices — Easy, Good, Hard, Painful — with Good selected, and an optional note for Marina.">
      <p className="kicker text-muted">Wall Angels · done</p>
      <p className="mt-2 text-[22px] leading-tight font-semibold tracking-[-0.025em]">How did that feel?</p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {options.map((option) => (
          <span
            key={option}
            className={cn(
              "flex h-14 items-center justify-center rounded-[12px] border text-[15px] font-semibold",
              option === "Good" ? "border-ink bg-ink text-paper" : "border-line-strong bg-surface",
            )}
          >
            {option}
          </span>
        ))}
      </div>
      <div className="mt-3 rounded-[12px] border border-line bg-white px-3 py-3 text-sm text-faint">
        Add a note for Marina <span className="text-muted">(optional)</span>
      </div>
      <p className="mt-4 flex items-center gap-2 text-sm text-muted">
        <span className="size-2 rounded-full bg-success" />
        Marina will see this with the exercise.
      </p>
    </Vignette>
  );
}

const ATTENTION = [
  { who: "Jordan Lee", what: "Wall Angels marked painful twice this week", when: "Wed", tone: "danger" as const, tag: "Pain" },
  { who: "Alex Thompson", what: "Missed 3 sessions in the last 7 days", when: "Today", tone: "warning" as const, tag: "Missed" },
  { who: "Maya Patel", what: "Sent a message about Step-Up", when: "2h", tone: "neutral" as const, tag: "Message" },
];

/** Clinician — the attention list. */
export function AttentionVignette() {
  return (
    <Vignette
      label="Illustration of the clinician dashboard: Needs your attention, three patients — Jordan Lee marked Wall Angels painful twice this week, Alex Thompson missed three sessions in seven days, Maya Patel sent a message."
      padded={false}
    >
      <div className="flex">
        <div className="hidden w-14 shrink-0 flex-col items-center gap-3 bg-ink py-4 sm:flex">
          <span className="text-[13px] font-black tracking-[-0.06em] text-paper">F</span>
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cn("h-1 w-5 rounded-full", i === 0 ? "bg-signal" : "bg-night-line")} />
          ))}
        </div>
        <div className="min-w-0 flex-1 p-4 sm:p-5">
          <p className="kicker text-muted">Today</p>
          <p className="mt-1 text-lg font-semibold tracking-[-0.02em]">Needs your attention</p>
          <ul className="mt-3 divide-y divide-line rounded-[14px] border border-line bg-surface">
            {ATTENTION.map((item) => (
              <li key={item.who} className="flex items-start gap-3 px-3 py-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-semibold">
                  {item.who
                    .split(" ")
                    .map((p) => p[0])
                    .join("")}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{item.who}</span>
                    <span className="font-mono text-[11px] text-muted">{item.when}</span>
                  </span>
                  <span className="mt-0.5 block text-[13px] text-ink/80">{item.what}</span>
                  <span
                    className={cn(
                      "mt-1.5 inline-flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-[11px] font-semibold",
                      item.tone === "danger" && "bg-danger-soft text-danger",
                      item.tone === "warning" && "bg-warning-soft text-warning-ink",
                      item.tone === "neutral" && "bg-sunken text-ink",
                    )}
                  >
                    {item.tag}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Vignette>
  );
}

const PROGRAM = [
  { slug: "glute-bridge", name: "Glute Bridge", dose: "3 × 10" },
  { slug: "clamshell", name: "Clamshell", dose: "2 × 12 / side" },
  { slug: "sit-to-stand", name: "Sit-to-Stand", dose: "3 × 8" },
  { slug: "calf-raise", name: "Calf Raise", dose: "2 × 15" },
];

/** Clinician — building a four-exercise program. */
export function ProgramVignette() {
  return (
    <Vignette label="Illustration of the program builder: four exercises with sets and reps, scheduled Monday, Wednesday and Friday, with an Assign program button.">
      <div className="flex items-center justify-between gap-3">
        <p className="text-lg font-semibold tracking-[-0.02em]">New program</p>
        <span className="font-mono text-[11px] text-muted tabular">4 exercises · ~11 min</span>
      </div>
      <div className="mt-3 rounded-[10px] border border-line-strong bg-white px-3 py-2.5 text-sm text-faint">Search exercises</div>
      <ol className="mt-3 space-y-2">
        {PROGRAM.map((item, i) => {
          const ex = libraryExercise(item.slug);
          return (
            <li key={item.slug} className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-2">
              <span className="w-5 font-mono text-[11px] text-muted tabular">{String(i + 1).padStart(2, "0")}</span>
              <span className="min-w-0 flex-1 truncate text-sm font-medium">{ex?.name ?? item.name}</span>
              <span className="rounded-[6px] bg-sunken px-2 py-1 font-mono text-[11px] tabular">{item.dose}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex items-center gap-1.5">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span
            key={i}
            className={cn(
              "flex size-8 items-center justify-center rounded-[8px] font-mono text-[11px]",
              i === 0 || i === 2 || i === 4 ? "bg-ink text-paper" : "bg-sunken text-muted",
            )}
          >
            {d}
          </span>
        ))}
      </div>
      <FauxButton className="mt-4">Assign program</FauxButton>
    </Vignette>
  );
}

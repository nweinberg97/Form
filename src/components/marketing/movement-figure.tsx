import { ExerciseDemo } from "@/components/exercise/exercise-demo";
import { cn } from "@/lib/cn";
import { libraryExercise } from "./library";

/**
 * FORM's own movement guides used as brand art: an animated figure from the
 * exercise library, set in a frame with corner coordinates. No photography,
 * no external media. Pauses automatically for reduced-motion visitors.
 */
export function MovementFigure({
  slug,
  index,
  className,
  caption = true,
}: {
  slug: string;
  /** Mono index shown in the frame, e.g. "01". */
  index?: string;
  className?: string;
  caption?: boolean;
}) {
  const exercise = libraryExercise(slug);
  return (
    <figure className={cn("relative", className)}>
      <div className="relative">
        {exercise ? (
          <ExerciseDemo bare tone="dark" name={exercise.name} demo={exercise.demo} />
        ) : (
          <div aria-hidden className="aspect-[16/10] rounded-[14px] bg-night-raised" />
        )}
        <FrameCorners />
      </div>
      {caption ? (
        <figcaption className="mt-3 flex items-baseline justify-between gap-4 text-night-muted">
          <span className="kicker">{index ? `${index} — ` : ""}{exercise?.name ?? "Movement guide"}</span>
          <span className="kicker hidden sm:inline">Movement guide</span>
        </figcaption>
      ) : null}
    </figure>
  );
}

/** Registration marks at the four corners of a frame. Decorative. */
export function FrameCorners({ tone = "dark" }: { tone?: "dark" | "light" }) {
  const color = tone === "dark" ? "border-paper/40" : "border-ink/30";
  const mark = cn("pointer-events-none absolute size-3", color);
  return (
    <span aria-hidden>
      <span className={cn(mark, "-top-1.5 -left-1.5 border-t border-l")} />
      <span className={cn(mark, "-top-1.5 -right-1.5 border-t border-r")} />
      <span className={cn(mark, "-bottom-1.5 -left-1.5 border-b border-l")} />
      <span className={cn(mark, "-right-1.5 -bottom-1.5 border-r border-b")} />
    </span>
  );
}

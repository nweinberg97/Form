import { EXERCISES } from "@/content/exercises";

const FALLBACK = ["Chin Tuck", "Wall Angels", "Sit-to-Stand", "Glute Bridge", "Bird Dog", "Calf Raise", "Step-Up", "Dead Bug"];

/**
 * A slow, continuous line of movement names: the library as typography.
 * Decorative (aria-hidden). Reduced-motion visitors see it still.
 */
export function Ticker() {
  const names = EXERCISES.length ? EXERCISES.map((e) => e.name) : FALLBACK;
  const run = (
    <span className="flex shrink-0 items-center">
      {names.map((name) => (
        <span key={name} className="flex items-center">
          <span className="px-6 text-2xl font-black tracking-[-0.03em] uppercase sm:text-3xl">{name}</span>
          <span className="h-[3px] w-6 bg-signal" />
        </span>
      ))}
    </span>
  );
  return (
    <div aria-hidden className="overflow-hidden border-y border-night-line bg-ink py-5 text-paper select-none">
      <style>{`@keyframes form-ticker{from{transform:translateX(0)}to{transform:translateX(-50%)}}`}</style>
      <div className="flex w-max animate-[form-ticker_90s_linear_infinite]">
        {run}
        {run}
      </div>
    </div>
  );
}

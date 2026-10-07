export type Dosage = {
  sets: number;
  reps?: number | null;
  durationSec?: number | null;
  perSide?: boolean | null;
};

export function formatDuration(seconds: number) {
  if (seconds < 60) return `${seconds} sec`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m}:${String(s).padStart(2, "0")} min` : `${m} min`;
}

/** "3 × 8", "2 × 10 / side", "3 × 30 sec" */
export function formatDosage(d: Dosage) {
  const amount = d.durationSec ? formatDuration(d.durationSec) : `${d.reps ?? 10}`;
  return `${d.sets} × ${amount}${d.perSide ? " / side" : ""}`;
}

/** Spoken-style dosage for the exercise screen: "8 reps", "30 sec hold". */
export function formatSetAmount(d: Dosage) {
  if (d.durationSec) return `${formatDuration(d.durationSec)} hold${d.perSide ? " each side" : ""}`;
  return `${d.reps ?? 10} reps${d.perSide ? " each side" : ""}`;
}

export const SIDE_LABEL = {
  both: "Both sides",
  left: "Left side",
  right: "Right side",
  alternating: "Alternating",
} as const;

export function estimateSeconds(items: (Dosage & { secondsPerSet: number })[]) {
  return items.reduce((sum, item) => {
    const perSet = item.durationSec ? item.durationSec + 15 : item.secondsPerSet;
    return sum + item.sets * perSet * (item.perSide ? 2 : 1);
  }, 0);
}

export function estimateMinutes(items: (Dosage & { secondsPerSet: number })[]) {
  return Math.max(1, Math.round(estimateSeconds(items) / 60));
}

export function formatMinutes(minutes: number) {
  return `about ${minutes} min`;
}

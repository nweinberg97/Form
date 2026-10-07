import type { Tone } from "@/components/ui/badge";

/**
 * Attention signals state what happened, never what it means.
 * Pain uses the clinical danger tone (never Signal Orange); everything else is quiet.
 */
export type AttentionKind = "pain" | "hard_repeat" | "missed_repeat" | "patient_note" | "skipped_symptoms" | "flag";

export const ATTENTION_LABEL: Record<AttentionKind, string> = {
  pain: "Pain reported",
  hard_repeat: "Repeated Hard",
  missed_repeat: "Missed sessions",
  patient_note: "Patient note",
  skipped_symptoms: "Skipped: symptoms",
  flag: "Flagged",
};

export const ATTENTION_TONE: Record<AttentionKind, Tone> = {
  pain: "danger",
  skipped_symptoms: "warning",
  hard_repeat: "warning",
  missed_repeat: "neutral",
  patient_note: "neutral",
  flag: "outline",
};

export const attentionSeverity = (kind: string) =>
  kind === "pain" ? 0 : kind === "skipped_symptoms" ? 1 : kind === "hard_repeat" ? 2 : kind === "patient_note" ? 3 : 4;

export function asKind(kind: string): AttentionKind {
  return (kind in ATTENTION_LABEL ? kind : "flag") as AttentionKind;
}

/** Most severe first, then newest. */
export function sortSignals<T extends { kind: string; createdAt: Date | string }>(items: T[]) {
  return [...items].sort(
    (a, b) =>
      attentionSeverity(a.kind) - attentionSeverity(b.kind) || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

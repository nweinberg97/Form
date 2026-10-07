export const SKIP_REASON_LABEL = {
  unwell: "Didn't feel well",
  no_time: "Didn't have time",
  symptoms: "Symptoms",
  forgot: "Forgot",
  other: "Other",
} as const;
export type SkipReasonKey = keyof typeof SKIP_REASON_LABEL;

export const RATING_LABEL = {
  easy: "Easy",
  good: "Good",
  hard: "Hard",
  painful: "Painful",
} as const;
export type RatingKey = keyof typeof RATING_LABEL;

/** Badge tone per rating. Pain is clinical red — never Signal Orange. */
export const RATING_TONE = {
  easy: "neutral",
  good: "success",
  hard: "warning",
  painful: "danger",
} as const;

export const PAIN_LOCATIONS = ["Neck", "Shoulder", "Upper back", "Lower back", "Hip", "Knee", "Ankle or foot", "Somewhere else"] as const;

/**
 * Curated video demonstrations for FORM's approved library.
 * Each entry is verified to exist and to come from a physiotherapy / clinical
 * source. Clinics can override any of these with their own video.
 */
export type ExerciseVideoSeed = {
  slug: string;
  youtubeId: string;
  title: string;
  /** Channel or organization credited on the player. */
  source: string;
};

export const EXERCISE_VIDEOS: ExerciseVideoSeed[] = [];

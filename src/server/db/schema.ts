import { relations, sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type { Demo } from "@/lib/rig";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/* ------------------------------------------------------------------ */
/* Enums                                                               */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("role", ["patient", "clinician", "admin"]);
export const sideEnum = pgEnum("side", ["both", "left", "right", "alternating"]);
export const programStatusEnum = pgEnum("program_status", ["active", "archived", "completed"]);
export const sessionStatusEnum = pgEnum("session_status", [
  "in_progress",
  "completed",
  "partially_completed",
  "skipped",
  "cancelled",
]);
export const ratingEnum = pgEnum("feedback_rating", ["easy", "good", "hard", "painful"]);
export const attentionKindEnum = pgEnum("attention_kind", [
  "pain",
  "hard_repeat",
  "missed_repeat",
  "patient_note",
  "skipped_symptoms",
  "flag",
]);
export const mediaTypeEnum = pgEnum("media_type", ["animation", "video", "image"]);

/* ------------------------------------------------------------------ */
/* Organization & people                                               */
/* ------------------------------------------------------------------ */

export const organizations = pgTable("organizations", {
  id: id(),
  name: text("name").notNull(),
  isDemo: boolean("is_demo").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    passwordHash: text("password_hash"),
    name: text("name").notNull(),
    role: roleEnum("role").notNull(),
    /** Professional suffix shown to patients, e.g. "PT". */
    credentials: text("credentials"),
    timezone: text("timezone").notNull().default("America/Vancouver"),
    /** Patient: ready to use the product (account set up). */
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    /** Patient: discharged from care — read-only history. */
    dischargedAt: timestamp("discharged_at", { withTimezone: true }),
    notifyReminders: boolean("notify_reminders").notNull().default(true),
    notifyMessages: boolean("notify_messages").notNull().default(true),
    reminderTime: text("reminder_time").default("08:00"),
    /** Clinician: remembered builder preferences (smart defaults). */
    preferences: jsonb("preferences").$type<ClinicianPreferences>(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_unique").on(sql`lower(${t.email})`), index("users_org_idx").on(t.orgId, t.role)],
);

export type ClinicianPreferences = {
  defaultDays?: number[];
};

export const authSessions = pgTable(
  "auth_sessions",
  {
    /** SHA-256 of the session token. The raw token only ever lives in the cookie. */
    id: text("id").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("auth_sessions_user_idx").on(t.userId)],
);

export const careRelationships = pgTable(
  "care_relationships",
  {
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clinicianId: uuid("clinician_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    isPrimary: boolean("is_primary").notNull().default(true),
    createdAt: createdAt(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.patientId, t.clinicianId] }), index("care_clinician_idx").on(t.clinicianId)],
);

export const invitations = pgTable(
  "invitations",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    /** The (not yet activated) user this invite activates. */
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    invitedById: uuid("invited_by_id").references(() => users.id, { onDelete: "set null" }),
    /** SHA-256 of the invite code. */
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("invitations_token_unique").on(t.tokenHash)],
);

/* ------------------------------------------------------------------ */
/* Exercise library                                                    */
/* ------------------------------------------------------------------ */

export const exercises = pgTable(
  "exercises",
  {
    id: id(),
    /** null = FORM's approved global library. */
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    summary: text("summary").notNull(),
    bodyAreas: text("body_areas").array().notNull(),
    movementPatterns: text("movement_patterns").array().notNull(),
    categories: text("categories").array().notNull(),
    equipment: text("equipment").array().notNull(),
    difficulty: smallint("difficulty").notNull(),
    lateralitySupported: boolean("laterality_supported").notNull().default(false),
    defaultSets: smallint("default_sets").notNull(),
    defaultReps: smallint("default_reps"),
    defaultDurationSec: smallint("default_duration_sec"),
    defaultPerSide: boolean("default_per_side").notNull().default(false),
    /** Rough seconds for one set, used to estimate session length. */
    secondsPerSet: smallint("seconds_per_set").notNull().default(45),
    instructions: text("instructions").array().notNull(),
    formCues: text("form_cues").array().notNull(),
    feel: text("feel").notNull(),
    commonMistakes: text("common_mistakes").array().notNull(),
    safetyNotes: text("safety_notes").notNull(),
    tags: text("tags").array().notNull(),
    /** "form" = FORM's curated rehab library; "open" = imported public-domain library. */
    source: text("source", { enum: ["form", "open"] }).notNull().default("form"),
    attribution: text("attribution"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("exercises_slug_unique").on(t.slug)],
);

export const exerciseMedia = pgTable(
  "exercise_media",
  {
    id: id(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    /** null = FORM's default media. Set = a clinic's own choice, which takes precedence for that clinic. */
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    type: mediaTypeEnum("type").notNull(),
    /** "youtube" (embedded via youtube-nocookie) or "file" (a hosted video file). */
    provider: text("provider", { enum: ["youtube", "file", "generated"] }).notNull().default("generated"),
    /** Provider id, e.g. the YouTube video id. */
    externalId: text("external_id"),
    /** Human title + source credit, e.g. "Chin tucks — Clinic Physio channel". */
    title: text("title"),
    source: text("source"),
    /** Video/image URL. Empty for generated animations. */
    url: text("url"),
    poster: text("poster"),
    durationSec: smallint("duration_sec"),
    captionsUrl: text("captions_url"),
    altText: text("alt_text").notNull(),
    /** Movement keyframes for generated demonstrations. */
    demo: jsonb("demo").$type<Demo>(),
    position: smallint("position").notNull().default(0),
  },
  (t) => [index("exercise_media_exercise_idx").on(t.exerciseId, t.orgId)],
);

export const exerciseRelations = pgTable(
  "exercise_relations",
  {
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    relatedId: uuid("related_id")
      .notNull()
      .references(() => exercises.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["progression", "regression"] }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.exerciseId, t.relatedId, t.kind] })],
);

/* ------------------------------------------------------------------ */
/* Programs (prescriptions) and their versions                         */
/* ------------------------------------------------------------------ */

export const programs = pgTable(
  "programs",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    clinicianId: uuid("clinician_id")
      .notNull()
      .references(() => users.id),
    title: text("title").notNull(),
    status: programStatusEnum("status").notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    currentVersionId: uuid("current_version_id"),
    createdAt: createdAt(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("programs_patient_idx").on(t.patientId, t.status), index("programs_org_idx").on(t.orgId)],
);

export const programVersions = pgTable(
  "program_versions",
  {
    id: id(),
    programId: uuid("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    /** Weekdays (0 = Sunday … 6 = Saturday) on which the program is scheduled. */
    days: smallint("days").array().notNull(),
    /** First date this version governs (in the patient's timezone). */
    effectiveFrom: date("effective_from").notNull(),
    title: text("title").notNull(),
    /** Optional note shown on the program as a whole. */
    note: text("note"),
    changeSummary: text("change_summary").array().notNull().default(sql`'{}'::text[]`),
    createdById: uuid("created_by_id")
      .notNull()
      .references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("program_versions_unique").on(t.programId, t.version)],
);

export const programExercises = pgTable(
  "program_exercises",
  {
    id: id(),
    versionId: uuid("version_id")
      .notNull()
      .references(() => programVersions.id, { onDelete: "cascade" }),
    /** Stable identity of "this exercise in this program" across versions. */
    lineageId: uuid("lineage_id").notNull(),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: smallint("position").notNull(),
    sets: smallint("sets").notNull(),
    reps: smallint("reps"),
    durationSec: smallint("duration_sec"),
    perSide: boolean("per_side").notNull().default(false),
    side: sideEnum("side").notNull().default("both"),
    /** null = every program day. Otherwise a subset of the version's days. */
    days: smallint("days").array(),
    note: text("note"),
  },
  (t) => [index("program_exercises_version_idx").on(t.versionId, t.position)],
);

/* ------------------------------------------------------------------ */
/* Templates                                                           */
/* ------------------------------------------------------------------ */

export const templates = pgTable("templates", {
  id: id(),
  orgId: uuid("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  days: smallint("days").array().notNull(),
  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const templateExercises = pgTable(
  "template_exercises",
  {
    id: id(),
    templateId: uuid("template_id")
      .notNull()
      .references(() => templates.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    position: smallint("position").notNull(),
    sets: smallint("sets").notNull(),
    reps: smallint("reps"),
    durationSec: smallint("duration_sec"),
    perSide: boolean("per_side").notNull().default(false),
    side: sideEnum("side").notNull().default("both"),
    days: smallint("days").array(),
    note: text("note"),
  },
  (t) => [index("template_exercises_template_idx").on(t.templateId, t.position)],
);

/* ------------------------------------------------------------------ */
/* Sessions (what actually happened)                                   */
/* ------------------------------------------------------------------ */

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** The calendar day this session belongs to, in the patient's timezone. */
    scheduledDate: date("scheduled_date").notNull(),
    status: sessionStatusEnum("status").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    durationSec: integer("duration_sec"),
    skipReason: text("skip_reason", {
      enum: ["unwell", "no_time", "symptoms", "forgot", "other"],
    }),
    skipNote: text("skip_note"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("sessions_patient_day_unique").on(t.patientId, t.scheduledDate)],
);

/** The plan a session was started with — frozen, so edits never alter a session in hand. */
export const sessionItems = pgTable(
  "session_items",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    programExerciseId: uuid("program_exercise_id")
      .notNull()
      .references(() => programExercises.id),
    position: smallint("position").notNull(),
  },
  (t) => [uniqueIndex("session_items_unique").on(t.sessionId, t.programExerciseId)],
);

export const exerciseCompletions = pgTable(
  "exercise_completions",
  {
    id: id(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    programExerciseId: uuid("program_exercise_id")
      .notNull()
      .references(() => programExercises.id),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    lineageId: uuid("lineage_id").notNull(),
    setsCompleted: smallint("sets_completed"),
    completedAt: timestamp("completed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // One completion per prescribed exercise per session: completing twice is a no-op.
  (t) => [uniqueIndex("completions_unique").on(t.sessionId, t.programExerciseId)],
);

export const feedback = pgTable(
  "feedback",
  {
    id: id(),
    completionId: uuid("completion_id")
      .notNull()
      .references(() => exerciseCompletions.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    exerciseId: uuid("exercise_id")
      .notNull()
      .references(() => exercises.id),
    lineageId: uuid("lineage_id").notNull(),
    rating: ratingEnum("rating").notNull(),
    painLocation: text("pain_location"),
    note: text("note"),
    createdAt: createdAt(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("feedback_completion_unique").on(t.completionId), index("feedback_patient_idx").on(t.patientId, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Communication                                                       */
/* ------------------------------------------------------------------ */

export const messages = pgTable(
  "messages",
  {
    id: id(),
    /** Every message belongs to one patient's care thread. */
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    /** Context: the exercise (and optional feedback) the message is about. */
    exerciseId: uuid("exercise_id").references(() => exercises.id),
    feedbackId: uuid("feedback_id").references(() => feedback.id, { onDelete: "set null" }),
    clientId: text("client_id"),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("messages_thread_idx").on(t.patientId, t.createdAt), uniqueIndex("messages_client_unique").on(t.senderId, t.clientId)],
);

/** Clinician-only notes on a patient. Never shown to the patient. */
export const clinicianNotes = pgTable(
  "clinician_notes",
  {
    id: id(),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    authorId: uuid("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("clinician_notes_patient_idx").on(t.patientId, t.createdAt)],
);

export const attentionItems = pgTable(
  "attention_items",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    patientId: uuid("patient_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: attentionKindEnum("kind").notNull(),
    /** Plain statement of what happened. Never an interpretation. */
    message: text("message").notNull(),
    exerciseId: uuid("exercise_id").references(() => exercises.id),
    /** Prevents duplicate derived signals (e.g. "missed:2026-W41"). */
    dedupeKey: text("dedupe_key"),
    createdAt: createdAt(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedById: uuid("resolved_by_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("attention_open_idx").on(t.orgId, t.resolvedAt),
    uniqueIndex("attention_dedupe_unique").on(t.patientId, t.dedupeKey),
  ],
);

export const notifications = pgTable(
  "notifications",
  {
    id: id(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["plan_updated", "message", "plan_assigned"] }).notNull(),
    body: text("body").notNull(),
    href: text("href"),
    createdAt: createdAt(),
    readAt: timestamp("read_at", { withTimezone: true }),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.readAt)],
);

/* ------------------------------------------------------------------ */
/* Audit & analytics                                                   */
/* ------------------------------------------------------------------ */

export const auditEvents = pgTable(
  "audit_events",
  {
    id: id(),
    orgId: uuid("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: uuid("entity_id"),
    patientId: uuid("patient_id"),
    data: jsonb("data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("audit_org_idx").on(t.orgId, t.createdAt), index("audit_patient_idx").on(t.patientId, t.createdAt)],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    props: jsonb("props").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("analytics_name_idx").on(t.name, t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Relations (for the relational query API)                            */
/* ------------------------------------------------------------------ */

export const usersRelations = relations(users, ({ one }) => ({
  org: one(organizations, { fields: [users.orgId], references: [organizations.id] }),
}));

export const exercisesRelations = relations(exercises, ({ many }) => ({
  media: many(exerciseMedia),
}));

export const exerciseMediaRelations = relations(exerciseMedia, ({ one }) => ({
  exercise: one(exercises, { fields: [exerciseMedia.exerciseId], references: [exercises.id] }),
}));

export const programsRelations = relations(programs, ({ many, one }) => ({
  versions: many(programVersions),
  patient: one(users, { fields: [programs.patientId], references: [users.id] }),
  clinician: one(users, { fields: [programs.clinicianId], references: [users.id] }),
}));

export const programVersionsRelations = relations(programVersions, ({ one, many }) => ({
  program: one(programs, { fields: [programVersions.programId], references: [programs.id] }),
  exercises: many(programExercises),
  createdBy: one(users, { fields: [programVersions.createdById], references: [users.id] }),
}));

export const programExercisesRelations = relations(programExercises, ({ one }) => ({
  version: one(programVersions, { fields: [programExercises.versionId], references: [programVersions.id] }),
  exercise: one(exercises, { fields: [programExercises.exerciseId], references: [exercises.id] }),
}));

export const templatesRelations = relations(templates, ({ many }) => ({
  exercises: many(templateExercises),
}));

export const templateExercisesRelations = relations(templateExercises, ({ one }) => ({
  template: one(templates, { fields: [templateExercises.templateId], references: [templates.id] }),
  exercise: one(exercises, { fields: [templateExercises.exerciseId], references: [exercises.id] }),
}));

export type User = typeof users.$inferSelect;
export type Exercise = typeof exercises.$inferSelect;
export type Program = typeof programs.$inferSelect;
export type ProgramVersion = typeof programVersions.$inferSelect;
export type ProgramExercise = typeof programExercises.$inferSelect;
export type Session = typeof sessions.$inferSelect;
export type Rating = (typeof ratingEnum.enumValues)[number];
export type Side = (typeof sideEnum.enumValues)[number];
export type SkipReason = NonNullable<Session["skipReason"]>;

import { and, desc, eq } from "drizzle-orm";
import type { Queryable } from "../db";
import {
  attentionItems,
  careRelationships,
  clinicianNotes,
  exerciseCompletions,
  exercises,
  feedback,
  messages,
  notifications,
  organizations,
  programVersions,
  programs,
  sessionItems,
  sessions,
  templateExercises,
  templates,
  users,
} from "../db/schema";
import { addDays, todayIn, weekday, zonedTime, type ISODate } from "@/lib/dates";
import { itemsForDate, loadPatientPlan } from "../services/plan";
import { writeProgramVersion, type Draft, type DraftItem } from "../services/programs";
import { checkRepeat, refreshDerivedAttention } from "../services/attention";

/**
 * A believable clinic, generated fresh for each demo visitor.
 * All people are fictional. Dates are relative to "today" in the visitor's
 * timezone so the demo always feels current.
 */

export const demoEmail = (orgId: string, who: string) => `${who}.${orgId.slice(0, 8)}@demo.form.local`;

type Rating = "easy" | "good" | "hard" | "painful";
type DayPlan = "completed" | "partial" | "skipped" | "missed" | "in_progress";

/** Deterministic pseudo-random numbers so every demo tells the same story. */
function prng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}


type ItemSpec = {
  slug: string;
  sets: number;
  reps?: number | null;
  durationSec?: number | null;
  note?: string;
  perSide?: boolean;
  side?: DraftItem["side"];
};

export async function seedDemoClinic(db: Queryable, opts: { timezone: string }) {
  const tz = opts.timezone;
  const today = todayIn(tz);
  const at = (date: ISODate, hour: number, minute = 0) => zonedTime(date, hour, minute, tz);
  const w = weekday(today);

  const exerciseRows = await db.select({ id: exercises.id, slug: exercises.slug }).from(exercises);
  const ex = new Map(exerciseRows.map((r) => [r.slug, r.id]));
  const need = (slug: string) => {
    const id = ex.get(slug);
    if (!id) throw new Error(`Demo seed: exercise "${slug}" is missing from the library`);
    return id;
  };

  const toDraft = (title: string, days: number[], items: ItemSpec[], note: string | null = null, lineages?: Map<string, string>): Draft => ({
    title,
    days,
    note,
    items: items.map((item) => ({
      lineageId: lineages?.get(item.slug) ?? null,
      exerciseId: need(item.slug),
      sets: item.sets,
      reps: item.durationSec ? null : item.reps ?? null,
      durationSec: item.durationSec ?? null,
      perSide: item.perSide ?? false,
      side: item.side ?? "both",
      days: null,
      note: item.note ?? null,
    })),
  });

  return db.transaction(async (tx) => {
    const [org] = await tx
      .insert(organizations)
      .values({ name: "Northside Physio", isDemo: true, expiresAt: new Date(Date.now() + 24 * 3600_000) })
      .returning({ id: organizations.id });
    const orgId = org.id;

    const person = async (who: string, name: string, role: "patient" | "clinician" | "admin", extra: Partial<typeof users.$inferInsert> = {}) => {
      const [row] = await tx
        .insert(users)
        .values({
          orgId,
          email: demoEmail(orgId, who),
          name,
          role,
          timezone: tz,
          onboardedAt: new Date(),
          credentials: role === "patient" ? null : "PT",
          ...extra,
        })
        .returning({ id: users.id });
      return row.id;
    };

    const marina = await person("marina", "Marina Chen", "admin", { preferences: { defaultDays: [1, 3, 5] } });
    const priya = await person("priya", "Priya Shah", "clinician");

    const jordan = await person("jordan", "Jordan Lee", "patient", { createdAt: at(addDays(today, -26), 9) });
    const maya = await person("maya", "Maya Patel", "patient", { createdAt: at(addDays(today, -40), 9) });
    const alex = await person("alex", "Alex Thompson", "patient", { createdAt: at(addDays(today, -20), 9) });
    const sam = await person("sam", "Sam Rivera", "patient", { createdAt: at(addDays(today, -30), 9) });
    const noah = await person("noah", "Noah Williams", "patient", { onboardedAt: null, passwordHash: null, createdAt: at(addDays(today, -1), 9) });
    const claire = await person("claire", "Claire Wong", "patient", { createdAt: at(today, 8) });
    const lena = await person("lena", "Lena Fischer", "patient", { createdAt: at(addDays(today, -18), 9) });

    await tx.insert(careRelationships).values([
      { patientId: jordan, clinicianId: marina },
      { patientId: maya, clinicianId: marina },
      { patientId: alex, clinicianId: marina },
      { patientId: sam, clinicianId: marina },
      { patientId: noah, clinicianId: marina },
      { patientId: claire, clinicianId: marina },
      { patientId: lena, clinicianId: priya },
      { patientId: sam, clinicianId: priya, isPrimary: false },
    ]);

    /* ---------------- Program helper ---------------- */

    async function program(args: {
      patientId: string;
      clinicianId: string;
      versions: { daysAgo: number; draft: Draft }[];
    }) {
      let programId: string | null = null;
      const lineages = new Map<string, string>();
      for (const v of args.versions) {
        const date = addDays(today, -v.daysAgo);
        // Carry lineage forward by exercise so history stays continuous.
        const draft: Draft = {
          ...v.draft,
          items: v.draft.items.map((item) => ({ ...item, lineageId: lineages.get(item.exerciseId) ?? null })),
        };
        const written = await writeProgramVersion(tx, {
          orgId,
          patientId: args.patientId,
          clinicianId: args.clinicianId,
          programId,
          draft,
          effectiveFrom: date,
          startDate: date,
        });
        programId = written.programId;
        await tx.update(programVersions).set({ createdAt: at(date, 10, 15) }).where(eq(programVersions.id, written.versionId));
        const plan = await loadPatientPlan(tx, args.patientId);
        for (const item of plan.itemsByVersion.get(written.versionId) ?? []) lineages.set(item.exercise.id, item.lineageId);
      }
      const first = addDays(today, -args.versions[0].daysAgo);
      await tx.update(programs).set({ createdAt: at(first, 10) }).where(eq(programs.id, programId!));
      return programId!;
    }

    /* ---------------- Session simulation ---------------- */

    async function simulate(args: {
      patientId: string;
      from: ISODate;
      to: ISODate;
      seed: number;
      plan: (date: ISODate, index: number) => DayPlan;
      rating?: (slug: string, date: ISODate, rand: () => number) => Rating | null;
      notes?: Record<string, { slug: string; rating: Rating; note: string; painLocation?: string; reply?: { from: string; body: string; afterMinutes: number } }>;
    }) {
      const plan = await loadPatientPlan(tx, args.patientId);
      const rand = prng(args.seed);
      const slugById = new Map([...ex.entries()].map(([slug, id]) => [id, slug]));
      let index = 0;
      for (let date = args.from; date <= args.to; date = addDays(date, 1)) {
        const items = itemsForDate(plan, date);
        if (!items.length) continue;
        const kind = args.plan(date, index++);
        if (kind === "missed") continue;
        const start = at(date, 7 + Math.floor(rand() * 11), Math.floor(rand() * 50));
        if (kind === "skipped") {
          await tx.insert(sessions).values({
            patientId: args.patientId,
            scheduledDate: date,
            status: "skipped",
            skipReason: rand() > 0.5 ? "no_time" : "unwell",
            createdAt: start,
          });
          continue;
        }
        const doneCount = kind === "completed" ? items.length : Math.max(1, Math.floor(items.length / 2));
        const durationSec = Math.round(doneCount * (150 + rand() * 60));
        const [session] = await tx
          .insert(sessions)
          .values({
            patientId: args.patientId,
            scheduledDate: date,
            status: kind === "completed" ? "completed" : kind === "in_progress" ? "in_progress" : "partially_completed",
            startedAt: start,
            completedAt: kind === "in_progress" ? null : new Date(start.getTime() + durationSec * 1000),
            durationSec: kind === "in_progress" ? null : durationSec,
            createdAt: start,
          })
          .returning({ id: sessions.id });
        await tx.insert(sessionItems).values(items.map((item, i) => ({ sessionId: session.id, programExerciseId: item.programExerciseId, position: i })));
        for (let i = 0; i < doneCount; i++) {
          const item = items[i];
          const completedAt = new Date(start.getTime() + (i + 1) * (durationSec / doneCount) * 1000);
          const [completion] = await tx
            .insert(exerciseCompletions)
            .values({
              sessionId: session.id,
              programExerciseId: item.programExerciseId,
              exerciseId: item.exercise.id,
              lineageId: item.lineageId,
              setsCompleted: item.sets,
              completedAt,
            })
            .returning({ id: exerciseCompletions.id });
          const slug = slugById.get(item.exercise.id)!;
          const scripted = args.notes?.[`${date}:${slug}`];
          const rating = scripted?.rating ?? args.rating?.(slug, date, rand) ?? (rand() > 0.3 ? "good" : "easy");
          const [fb] = await tx
            .insert(feedback)
            .values({
              completionId: completion.id,
              patientId: args.patientId,
              exerciseId: item.exercise.id,
              lineageId: item.lineageId,
              rating,
              note: scripted?.note ?? null,
              painLocation: scripted?.painLocation ?? null,
              createdAt: completedAt,
              reviewedAt: scripted ? null : completedAt,
            })
            .returning({ id: feedback.id });
          if (scripted) {
            await tx.insert(messages).values({
              patientId: args.patientId,
              senderId: args.patientId,
              body: scripted.note,
              exerciseId: item.exercise.id,
              feedbackId: fb.id,
              clientId: `feedback:${fb.id}`,
              createdAt: completedAt,
              readAt: scripted.reply ? completedAt : null,
            });
            if (scripted.reply) {
              await tx.insert(messages).values({
                patientId: args.patientId,
                senderId: scripted.reply.from,
                body: scripted.reply.body,
                exerciseId: item.exercise.id,
                createdAt: new Date(completedAt.getTime() + scripted.reply.afterMinutes * 60_000),
                readAt: new Date(completedAt.getTime() + (scripted.reply.afterMinutes + 90) * 60_000),
              });
              await tx.update(feedback).set({ reviewedAt: completedAt }).where(eq(feedback.id, fb.id));
            } else if (rating === "painful") {
              await tx.insert(attentionItems).values({
                orgId,
                patientId: args.patientId,
                kind: "pain",
                exerciseId: item.exercise.id,
                message: `Reported pain during ${item.exercise.name}${scripted.painLocation ? ` — ${scripted.painLocation.toLowerCase()}` : ""}`,
                dedupeKey: `pain:${fb.id}`,
                createdAt: completedAt,
              });
            }
          }
        }
      }
    }

    /** Raises "marked painful/hard twice this week" exactly as live feedback would. */
    async function repeats(patientId: string, slug: string, rating: "hard" | "painful") {
      const [row] = await tx
        .select({ lineageId: feedback.lineageId, exerciseId: feedback.exerciseId })
        .from(feedback)
        .where(and(eq(feedback.patientId, patientId), eq(feedback.exerciseId, need(slug)), eq(feedback.rating, rating)))
        .orderBy(desc(feedback.createdAt))
        .limit(1);
      if (!row) return;
      const [exercise] = await tx.select({ name: exercises.name }).from(exercises).where(eq(exercises.id, row.exerciseId));
      await checkRepeat(tx, { rating, orgId, patientId, lineageId: row.lineageId, exerciseId: row.exerciseId, exerciseName: exercise.name, timezone: tz });
    }

    /* ---------------- Jordan: Neck & Shoulder Recovery ---------------- */
    // Three days a week, always including today so the demo patient has a session to do.
    const jordanDays = [w, (w + 2) % 7, (w + 4) % 7].sort();
    const jordanV1: ItemSpec[] = [
      { slug: "chin-tuck", sets: 2, reps: 10 },
      { slug: "wall-angels", sets: 2, reps: 8 },
      { slug: "thoracic-rotation", sets: 2, reps: 10, perSide: true },
      { slug: "upper-trapezius-stretch", sets: 3, reps: null, durationSec: 30, perSide: true },
      { slug: "levator-scapulae-stretch", sets: 2, reps: null, durationSec: 30, perSide: true },
    ];
    const wallAngelNote =
      "Don't push into the pinch. If your shoulder feels irritated today, keep the movement smaller — range will come back.";
    const jordanV2 = jordanV1.map((i) => (i.slug === "wall-angels" ? { ...i, sets: 3, note: wallAngelNote } : i));
    const jordanV3 = jordanV2.filter((i) => i.slug !== "levator-scapulae-stretch");
    await program({
      patientId: jordan,
      clinicianId: marina,
      versions: [
        { daysAgo: 24, draft: toDraft("Neck & Shoulder Recovery", jordanDays, jordanV1, "Move slowly and stay in a comfortable range. Little and often beats pushing through.") },
        { daysAgo: 13, draft: toDraft("Neck & Shoulder Recovery", jordanDays, jordanV2, "Move slowly and stay in a comfortable range. Little and often beats pushing through.") },
        { daysAgo: 5, draft: toDraft("Neck & Shoulder Recovery", jordanDays, jordanV3, "Move slowly and stay in a comfortable range. Little and often beats pushing through.") },
      ],
    });
    // Find the two most recent past session days for the pain story.
    const jordanPast: ISODate[] = [];
    for (let d = addDays(today, -1); jordanPast.length < 12 && d > addDays(today, -24); d = addDays(d, -1)) {
      if (jordanDays.includes(weekday(d))) jordanPast.push(d);
    }
    const [last1, last2, last3, , , last6] = jordanPast;
    await simulate({
      patientId: jordan,
      from: addDays(today, -24),
      to: addDays(today, -1),
      seed: 7,
      plan: (date) => (date === last6 ? "missed" : date === last3 ? "partial" : "completed"),
      rating: (slug, date, rand) => {
        if (slug === "wall-angels" && date >= addDays(today, -14) && date < last2) return rand() > 0.5 ? "hard" : "good";
        return rand() > 0.35 ? "good" : "easy";
      },
      notes: {
        ...(jordanPast[7] && {
          [`${jordanPast[7]}:thoracic-rotation`]: {
            slug: "thoracic-rotation",
            rating: "good" as Rating,
            note: "Left side feels a lot tighter than the right. Is that normal?",
            reply: {
              from: marina,
              body: "Totally normal early on — that side's been guarding. Keep the range comfortable and we'll check it on Thursday.",
              afterMinutes: 140,
            },
          },
        }),
        [`${last2}:wall-angels`]: {
          slug: "wall-angels",
          rating: "painful" as Rating,
          painLocation: "Shoulder",
          note: "Front of my left shoulder pinched on the last set.",
        },
        [`${last1}:wall-angels`]: {
          slug: "wall-angels",
          rating: "painful" as Rating,
          painLocation: "Shoulder",
          note: "Same pinch again, around halfway up. Stopped the last few reps.",
        },
      },
    });
    await repeats(jordan, "wall-angels", "painful");
    await tx.insert(clinicianNotes).values([
      {
        patientId: jordan,
        authorId: marina,
        body: "Desk worker, 8+ hrs/day. Symptoms worse late afternoon. Goal: back to bouldering by December.",
        createdAt: at(addDays(today, -24), 11),
      },
      {
        patientId: jordan,
        authorId: marina,
        body: "Reassessed: thoracic rotation much improved, L > R tightness persists. Dropped levator stretch, progressing Wall Angels volume.",
        createdAt: at(addDays(today, -5), 11),
      },
    ]);
    await tx.insert(notifications).values({
      userId: jordan,
      kind: "plan_updated",
      body: "Marina updated your plan",
      href: "/app/program",
      createdAt: at(addDays(today, -5), 10, 20),
    });

    /* ---------------- Maya: Knee Strength & Control ---------------- */
    const weekdays = [1, 2, 3, 4, 5];
    await program({
      patientId: maya,
      clinicianId: marina,
      versions: [
        {
          daysAgo: 38,
          draft: toDraft("Knee Strength & Control", weekdays, [
            { slug: "quad-set", sets: 3, reps: 10 },
            { slug: "straight-leg-raise", sets: 3, reps: 10 },
            { slug: "heel-slide", sets: 2, reps: 12 },
            { slug: "sit-to-stand", sets: 3, reps: 8 },
          ]),
        },
        {
          daysAgo: 16,
          draft: toDraft("Knee Strength & Control", weekdays, [
            { slug: "sit-to-stand", sets: 3, reps: 10 },
            { slug: "step-up", sets: 3, reps: 8, perSide: true, note: "Use the bottom stair and hold the rail if you need it." },
            { slug: "terminal-knee-extension", sets: 3, reps: 12 },
            { slug: "glute-bridge", sets: 3, reps: 12 },
            { slug: "single-leg-balance", sets: 3, reps: null, durationSec: 30, perSide: true },
          ]),
        },
      ],
    });
    await simulate({
      patientId: maya,
      from: addDays(today, -38),
      to: addDays(today, -1),
      seed: 11,
      plan: (_d, i) => (i % 11 === 6 ? "skipped" : "completed"),
      rating: (_slug, _d, rand) => (rand() > 0.55 ? "easy" : "good"),
    });
    await tx.insert(messages).values({
      patientId: maya,
      senderId: maya,
      body: "Did my first full flight of stairs without the rail today 🙌",
      createdAt: at(addDays(today, -2), 19),
    });

    /* ---------------- Alex: Low Back Mobility (missed recent sessions) ---------------- */
    const alexDays = [1, 3, 5];
    await program({
      patientId: alex,
      clinicianId: marina,
      versions: [
        {
          daysAgo: 19,
          draft: toDraft("Low Back Mobility", alexDays, [
            { slug: "pelvic-tilt", sets: 2, reps: 12 },
            { slug: "cat-cow", sets: 2, reps: 10 },
            { slug: "bird-dog", sets: 2, reps: 8, perSide: true },
            { slug: "glute-bridge", sets: 2, reps: 10 },
          ], "Gentle movement is the goal. Some stiffness is expected first thing in the morning."),
        },
      ],
    });
    const alexCutoff = addDays(today, -8);
    await simulate({
      patientId: alex,
      from: addDays(today, -19),
      to: addDays(today, -1),
      seed: 23,
      plan: (date) => (date > alexCutoff ? "missed" : "completed"),
    });

    /* ---------------- Sam: Ankle Return to Run ---------------- */
    const samDays = [1, 2, 4, 6];
    await program({
      patientId: sam,
      clinicianId: marina,
      versions: [
        {
          daysAgo: 28,
          draft: toDraft("Ankle Return to Run", samDays, [
            { slug: "seated-ankle-pump", sets: 2, reps: 20 },
            { slug: "towel-calf-stretch", sets: 3, reps: null, durationSec: 30 },
            { slug: "calf-raise", sets: 3, reps: 12 },
            { slug: "single-leg-balance", sets: 3, reps: null, durationSec: 30, perSide: true },
          ]),
        },
        {
          daysAgo: 14,
          draft: toDraft("Ankle Return to Run", samDays, [
            { slug: "ankle-dorsiflexion", sets: 2, reps: 12, perSide: true },
            { slug: "calf-raise", sets: 3, reps: 15 },
            { slug: "single-leg-balance", sets: 3, reps: null, durationSec: 45, perSide: true },
            { slug: "lateral-band-walk", sets: 3, reps: 10, perSide: true },
          ]),
        },
      ],
    });
    await simulate({
      patientId: sam,
      from: addDays(today, -28),
      to: addDays(today, -1),
      seed: 31,
      plan: (_d, i) => (i % 9 === 4 ? "partial" : "completed"),
      rating: (slug, date, rand) =>
        slug === "single-leg-balance" && date >= addDays(today, -6) ? "hard" : rand() > 0.4 ? "good" : "easy",
    });
    await repeats(sam, "single-leg-balance", "hard");
    await tx.insert(attentionItems).values({
      orgId,
      patientId: sam,
      kind: "flag",
      message: "Week 4 — program ready for review",
      dedupeKey: "demo:review-week-4",
      createdAt: at(addDays(today, -1), 8),
    });

    /* ---------------- Noah: invited, plan starts today ---------------- */
    await program({
      patientId: noah,
      clinicianId: marina,
      versions: [
        {
          daysAgo: 0,
          draft: toDraft("Hip Mobility — Getting Started", [1, 3, 5], [
            { slug: "clamshell", sets: 2, reps: 12, perSide: true },
            { slug: "hip-flexor-stretch", sets: 2, reps: null, durationSec: 30, perSide: true },
            { slug: "glute-bridge", sets: 2, reps: 10 },
          ]),
        },
      ],
    });

    /* ---------------- Lena (Priya's patient) ---------------- */
    await program({
      patientId: lena,
      clinicianId: priya,
      versions: [
        {
          daysAgo: 17,
          draft: toDraft("Shoulder Strength", [2, 4, 6], [
            { slug: "band-external-rotation", sets: 3, reps: 12 },
            { slug: "scapular-retraction", sets: 3, reps: 12 },
            { slug: "band-pull-apart", sets: 2, reps: 15 },
          ]),
        },
      ],
    });
    await simulate({ patientId: lena, from: addDays(today, -17), to: addDays(today, -1), seed: 41, plan: () => "completed" });

    /* ---------------- Templates ---------------- */
    const template = async (name: string, description: string, days: number[], items: ItemSpec[]) => {
      const [row] = await tx
        .insert(templates)
        .values({ orgId, name, description, days, createdById: marina })
        .returning({ id: templates.id });
      await tx.insert(templateExercises).values(
        items.map((item, position) => ({
          templateId: row.id,
          exerciseId: need(item.slug),
          position,
          sets: item.sets,
          reps: item.durationSec ? null : item.reps ?? null,
          durationSec: item.durationSec ?? null,
          perSide: item.perSide ?? false,
          side: item.side ?? "both",
          note: item.note ?? null,
        })),
      );
    };
    await template("Shoulder Mobility — Beginner", "Early-stage mobility for desk-related neck and shoulder stiffness.", [1, 3, 5], [
      { slug: "chin-tuck", sets: 2, reps: 10 },
      { slug: "wall-angels", sets: 2, reps: 8 },
      { slug: "thoracic-rotation", sets: 2, reps: 10, perSide: true },
      { slug: "doorway-pec-stretch", sets: 2, reps: null, durationSec: 30 },
    ]);
    await template("Knee — Early Strength", "Quads and hip strength for the first weeks after a knee flare-up.", [1, 2, 3, 4, 5], [
      { slug: "quad-set", sets: 3, reps: 10 },
      { slug: "straight-leg-raise", sets: 3, reps: 10 },
      { slug: "sit-to-stand", sets: 3, reps: 8 },
      { slug: "glute-bridge", sets: 3, reps: 10 },
    ]);
    await template("Low Back — Gentle Start", "Low-load movement for a sensitive lower back.", [1, 3, 5], [
      { slug: "pelvic-tilt", sets: 2, reps: 12 },
      { slug: "cat-cow", sets: 2, reps: 10 },
      { slug: "dead-bug", sets: 2, reps: 8, perSide: true },
    ]);
    await template("Ankle — Return to Run", "Calf capacity and balance before reintroducing running.", [1, 2, 4, 6], [
      { slug: "calf-raise", sets: 3, reps: 15 },
      { slug: "single-leg-balance", sets: 3, reps: null, durationSec: 45, perSide: true },
      { slug: "ankle-dorsiflexion", sets: 2, reps: 12, perSide: true },
    ]);

    await refreshDerivedAttention(tx, [jordan, maya, alex, sam, lena]);
    void claire; // A brand-new patient with no plan yet.

    return { orgId, clinicianId: marina, patientId: jordan };
  });
}

# FORM — product model

> Make the right rehabilitation action obvious.

This document is the working model behind the code: who it serves, how it is organized, what the data means, and the decisions taken where the original brief was ambiguous or could be improved.

## Two jobs

| Who | Job | The screen that does it |
| --- | --- | --- |
| Patient | Help me complete the right rehabilitation **today**. | `/app` — Today |
| Physiotherapist | Help me prescribe and adapt the right rehabilitation with minimal admin. | `/clinic` — Attention, then `/clinic/patients/:id` |

Everything else is subordinate.

## Core loop (and where it lives in code)

```
Clinician prescribes   → ProgramBuilder → assignProgram()        → new ProgramVersion
Patient understands    → Today          → getToday()             → occurrences from the version in force
Patient performs       → Session        → startSession()         → Session + frozen SessionItems
Patient reports        → Feedback       → completeExercise()     → ExerciseCompletion + Feedback (+ Message if a note)
Clinician learns       → Attention      → attention items        → explicit, dated, explainable events
Clinician adapts       → Edit program   → assignProgram()        → next ProgramVersion, diffed, audited
Patient gets new plan  → Today banner   → Notification           → "Marina updated your plan"
```

## Information architecture

**Patient (mobile first)** — four tabs, nothing more:

- **Today** — the default. Plan, start/continue, done state, rest day. Yesterday's missed session is offered as an optional, guilt-free "let Marina know" — never dumped into today.
- **Progress** — "Am I moving forward?" Sessions completed, this week, consistency over recent weeks, history.
- **Program** — the broader plan: schedule, every exercise (with demo), who prescribed it and when it last changed.
- **Messages** — one thread with the care team. Feedback notes arrive here with their exercise attached, so conversation stays contextual without a separate inbox per exercise.

Profile lives behind the avatar.

**Clinician (desktop first)** — dark sidebar, off-white workspace:

- **Today** (dashboard) — *Who needs my attention?* then my patients.
- **Patients** — searchable list; patient page with Overview / Program / Messages / Notes.
- **Library** — search, filter, preview.
- **Templates** — browse, create, duplicate, edit.

## Decisions and deliberate changes to the brief

1. **One session per patient per day, not per program.** Patients with two programs get one "Today's rehabilitation" (§91). Items carry their program for attribution.
2. **Sessions freeze their plan.** Starting a session snapshots its exercises into `session_items`. A clinician editing mid-session changes tomorrow, never the session in hand (§90).
3. **Occurrences are computed, sessions are stored.** A day is "scheduled" if the version in force that day prescribes something for that weekday. Rows are written only when something happens (start, skip, complete). "Missed" is derived for past days with no row. No cron, no backfill, no drift.
4. **Exercise lineage.** Each prescribed exercise has a `lineageId` that survives across versions, so "Wall Angels marked painful twice this week" holds even after the dosage changed in between, and version diffs read like a human wrote them ("Wall Angels 2 × 8 → 3 × 8").
5. **Feedback is four words, not ten numbers.** Easy / Good / Hard / Painful. Painful opens a small, optional sheet: where, a note, or just send. No triage, no interpretation.
6. **Attention is explicit and explainable.** Every item says what happened ("Wall Angels marked painful on Wed"), never what it means. Derived signals (2+ missed sessions in 7 days, Hard twice on one exercise) are recomputed idempotently with a dedupe key. Items resolve when reviewed or when the clinician changes the program.
7. **Demonstrations are data, not links.** Each exercise ships with an animated movement demonstration generated from keyframe poses (`src/lib/rig.ts`): embedded, captioned, replayable, speed-adjustable, never a dead media block, no external hosting. Real video (`exercise_media.type = 'video'`) slots into the same player when a clinic has it.
8. **Set tracking is optional.** The primary action is always *Complete exercise*. Tapping set markers is there for people who like it. For holds, a built-in timer.
9. **Missed is information.** Skipping records a reason (didn't feel well / no time / symptoms / forgot / other); the copy never says "failed", and the weekly view never paints a day red.
10. **Demo is a private sandbox.** "Try the demo" creates an isolated, freshly seeded clinic for that visitor (expires after 24 h) and lets them flip between Marina's clinician view and Jordan's patient view. Visitors never see each other's changes, and the loop (prescribe → perform → report → adapt) is demonstrable end to end.

## Permissions

| Action | Patient | Clinician | Clinic admin |
| --- | --- | --- | --- |
| View own plan, complete, give feedback, message care team | ✓ | | |
| View/edit patients they are assigned to | | ✓ | ✓ (whole clinic) |
| Create patients, prescribe, edit programs, reply | | ✓ | ✓ |
| Manage templates | | ✓ (own clinic) | ✓ |
| Manage clinicians | | | ✓ |

Every server action re-derives identity from the session cookie and checks role → organization → patient relationship. Client-supplied IDs are only ever *lookup keys*, never proof of access.

## State

**Session**: `in_progress → completed | partially_completed`, or `skipped` (with reason). `missed` is derived. `cancelled` is reserved for removed occurrences.

**Program**: `active → archived` (replaced) or `completed` (discharged). Each assignment or edit creates `ProgramVersion n+1` with a computed change summary and an audit event.

**Attention item**: `open → resolved` (by review, reply, or program edit).

## Product quality targets

- Open → start: two decisions (see plan, tap Start).
- Exercise feedback: one tap.
- Common four-exercise program: under two minutes (search-first, smart defaults, apply schedule once).
- "Does Jordan need me?": answered by the dashboard's first block.

## Not in scope

Billing, insurance, EMR, telehealth, diagnosis, AI treatment recommendations, motion capture, wearables, clinic scheduling, leaderboards, points, badges, streak mechanics.

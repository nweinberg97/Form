# FORM

**A modern movement brand for better rehabilitation.**

FORM removes the friction between what a physiotherapist recommends and what a patient actually does at home. Patients don't think in programs — they think in *today*. So FORM turns a home exercise program into one obvious thing to do today, shows each exercise properly inside the session, and captures how it felt in a single tap. Physiotherapists get a dashboard that answers "who needs me?" first, and a program builder fast enough to prescribe a four-exercise program in under two minutes. Performance outside. Clarity inside. Intelligence underneath.

> FORM is a prototype. It does not diagnose, and it does not replace a clinician.

## What's in the box

- **Patient app** (`/app`, mobile first) — Today, guided sessions with embedded demonstrations, one-tap feedback (Easy / Good / Hard / Painful), progress, the full program, and a single message thread with the care team.
- **Clinician app** (`/clinic`, desktop first) — an attention list of explicit, dated events, patient pages, a search-first program builder with versioning and diffs, the exercise library, and templates.
- **Demo mode** (`/demo`) — a private, pre-populated sample clinic per visitor. Flip between the clinician and patient views of the same live data.
- **Real auth** — clinic sign-up, email + password sign-in, patient and colleague invitations by link, server-side sessions.

## Tech stack

- Next.js 16 (App Router, React Server Components, Server Actions), React 19, TypeScript
- Tailwind CSS v4 with FORM's design tokens (`src/app/globals.css`)
- PostgreSQL with Drizzle ORM (`pg` driver) and drizzle-kit migrations
- zod for validation, lucide-react icons, dnd-kit for reordering, Geist Sans + Geist Mono

## Getting started

Requirements: Node.js 20.9+, Docker (or any PostgreSQL 14+).

```bash
docker compose up -d          # Postgres on localhost:5432 (user/password/db: form)
cp .env.example .env          # set DATABASE_URL if you're not using the compose database
npm install
npm run db:generate           # generate SQL migrations from the Drizzle schema
npm run db:migrate            # apply them
npm run dev                   # http://localhost:3000
```

Migrations are generated from the Drizzle schema in `src/server/db/schema.ts`. The server also applies any pending migrations and syncs the exercise library on boot (`src/instrumentation.ts` → `src/server/db/bootstrap.ts`), so a fresh database becomes usable on first start.

Other scripts: `npm run typecheck`, `npm run test`, `npm run db:studio`.

### Environment

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string. Required. |
| `FORM_DEMO_ENABLED` | `true` by default. Set to `false` to hide and disable the public demo. |

## Demo mode

"Try the demo" creates an isolated, freshly seeded clinic — Northside Physio — just for that visitor. Nothing to sign up for.

- Enter as **Jordan Lee** (a patient on a neck and shoulder program) or **Marina Chen, PT** (the clinician).
- Switch between Marina and Jordan at any time from the bar at the top of the app. Both views share the same live data, so the full loop works end to end: prescribe → perform → report → adapt.
- Visitors never see each other's changes. Demo sessions last 24 hours and expired demo clinics are deleted.
- Demo accounts can't be signed into with a password.
- Set `FORM_DEMO_ENABLED=false` to turn the demo off for a real deployment.

## Accounts

- **Clinic sign-up** (`/signup`) creates a new organization and makes the person signing up its **admin**.
- Clinicians add patients from the clinician app; each patient receives an **invitation link** (`/invite/<code>`). Opening it lets them set an email and password, then a short onboarding leads straight to Today.
- Everyone signs in at `/login`; FORM routes patients to `/app` and clinicians to `/clinic`.

## Exercise library and video

- The approved library is curated content in `src/content/exercises.ts`: plain-language summaries, steps, form cues, what it should feel like, common mistakes, a generic safety note, progressions and regressions.
- Every exercise ships with a **generated movement guide**: keyframe poses for a simple articulated figure (`src/lib/rig.ts`) rendered as an animated, captioned, replayable, speed-adjustable SVG. No external hosting, works offline.
- Where available, exercises also carry a **curated YouTube demonstration** from physiotherapy and clinical sources (`src/content/videos.ts`). Videos are embedded through `youtube-nocookie.com` with **click-to-load**: nothing is requested from YouTube until the viewer presses play. The movement guide is always one tap away and is the fallback when offline or if a video fails.
- **Clinics can override** the video for any exercise with their own YouTube link, which then takes precedence for their patients.
- The media model (`exercise_media`) is provider-agnostic, so a licensed exercise-video library could be plugged in without changing the player.

## Architecture

```
src/
  app/
    page.tsx              Landing page (brand layer)
    (auth)/               Sign in, clinic sign-up, invitations, demo picker
    app/                  Patient app
    clinic/               Clinician app
  components/
    ui/                   Design-system primitives (Button, Field, Card, Sheet, Toast…)
    brand/                Wordmark, demo bar
    exercise/             Exercise demonstration player and thumbnails
    patient/ clinician/   Feature components for each app
    marketing/            Landing and sign-in surfaces
  content/                Curated exercise library and video list
  lib/                    Pure helpers: dates, dosage, labels, movement rig, YouTube
  server/
    db/                   Drizzle schema, connection, boot-time migrate + library sync
    auth/                 Passwords, sessions, page/action guards
    services/             Read models (plan, patient, clinician, programs, attention, invites)
    actions/              Server actions — every mutation lives here
    seed/                 Library sync and demo clinic seeding
  proxy.ts                Edge gate: unauthenticated visitors to /app and /clinic go to /login
docs/PRODUCT.md           Product model and decisions
```

## Key product decisions

The working model — the two jobs, the core loop, information architecture, permissions, state machines and every deliberate change to the original brief — is documented in [`docs/PRODUCT.md`](docs/PRODUCT.md). Highlights: one session per patient per day; sessions freeze their plan; occurrences are computed and only events are stored; feedback is four words, not ten numbers; attention items say what happened, never what it means; missing a day is information, not failure; no points, streaks or badges.

## Security

- Passwords are hashed with **scrypt** and a per-user salt; verification is constant-time.
- Sessions use random tokens; only a **SHA-256 hash** of each token is stored. Cookies are `HttpOnly`, `SameSite=Lax`, and `Secure` in production.
- **Server-side authorization on every action and page**: identity is re-derived from the session cookie, then role → organization → care relationship is checked. Client-supplied IDs are lookup keys, never proof of access.
- **Organization isolation**: every query is scoped to the caller's organization.
- An **audit log** records sensitive changes: patients created and invited, program changes and discharges, clinical notes, template and permission changes, and exercise video overrides.
- Basic sign-in throttling, security headers, and no third-party requests until a viewer chooses to play a video.

### Privacy caveat

FORM is a prototype. It treats patient data as sensitive and is architected toward good practice (encrypted transport, least privilege, organization isolation, audit logging, minimal data collection), but it is **not certified or audited as compliant with HIPAA, PIPEDA, PHIPA, GDPR or any other health-privacy regime**. Do not use it with real patient data without your own legal, security and compliance review, appropriate hosting agreements, and the controls those regimes require.

## Deployment

FORM runs on any Node.js host with a PostgreSQL database — for example Vercel with Neon or Supabase Postgres.

1. Provision Postgres and set `DATABASE_URL` in the host's environment.
2. Set `FORM_DEMO_ENABLED=false` unless you want the public demo.
3. Commit the generated `drizzle/` migrations folder; pending migrations are applied and the exercise library is synced on server start. You can also run `npm run db:migrate` as a release step.
4. `npm run build && npm run start` (or let your platform build it).

Serve over HTTPS so session cookies are marked `Secure`.

import type { RouteDef } from "./router";

/* Route table: every entry points at the real page/layout files in src/app. */
const appLayout = () => import("../../src/app/app/layout");
const appMain = () => import("../../src/app/app/(main)/layout");
const clinicLayout = () => import("../../src/app/clinic/layout");
const appError = () => import("../../src/app/app/error");
const clinicError = () => import("../../src/app/clinic/error");
const clinicNotFound = () => import("../../src/app/clinic/not-found");

const patient = (page: RouteDef["page"], loading?: RouteDef["loading"], main = true): RouteDef => ({
  pattern: "",
  page,
  loading,
  layouts: main ? [appLayout, appMain] : [appLayout],
  error: appError,
});
const clinic = (page: RouteDef["page"], loading?: RouteDef["loading"]): RouteDef => ({
  pattern: "",
  page,
  loading: loading ?? (() => import("../../src/app/clinic/loading")),
  layouts: [clinicLayout],
  error: clinicError,
  notFound: clinicNotFound,
});
const at = (pattern: string, def: RouteDef): RouteDef => ({ ...def, pattern });

export const routes: RouteDef[] = [
  { pattern: "/", page: () => import("../../src/app/page") },
  { pattern: "/demo", page: () => import("../../src/app/(auth)/demo/page") },
  { pattern: "/login", page: () => import("./redirect-to-demo") },
  { pattern: "/signup", page: () => import("./redirect-to-demo") },
  { pattern: "/invite/:code", page: () => import("../../src/app/(auth)/invite/[code]/page") },

  at("/app", patient(() => import("../../src/app/app/(main)/page"), () => import("../../src/app/app/(main)/loading"))),
  at("/app/progress", patient(() => import("../../src/app/app/(main)/progress/page"), () => import("../../src/app/app/(main)/progress/loading"))),
  at("/app/program", patient(() => import("../../src/app/app/(main)/program/page"), () => import("../../src/app/app/(main)/program/loading"))),
  at("/app/messages", patient(() => import("../../src/app/app/(main)/messages/page"), () => import("../../src/app/app/(main)/messages/loading"))),
  at("/app/profile", patient(() => import("../../src/app/app/(main)/profile/page"), () => import("../../src/app/app/(main)/profile/loading"))),
  at("/app/session", patient(() => import("../../src/app/app/session/page"), () => import("../../src/app/app/session/loading"), false)),
  at("/app/onboarding", patient(() => import("../../src/app/app/onboarding/page"), () => import("../../src/app/app/onboarding/loading"), false)),

  at("/clinic", clinic(() => import("../../src/app/clinic/page"))),
  at("/clinic/patients", clinic(() => import("../../src/app/clinic/patients/page"))),
  at("/clinic/patients/new", clinic(() => import("../../src/app/clinic/patients/new/page"))),
  at("/clinic/patients/:id", clinic(() => import("../../src/app/clinic/patients/[id]/page"), () => import("../../src/app/clinic/patients/[id]/loading"))),
  at("/clinic/patients/:id/program", clinic(() => import("../../src/app/clinic/patients/[id]/program/page"), () => import("../../src/app/clinic/patients/[id]/program/loading"))),
  at("/clinic/library", clinic(() => import("../../src/app/clinic/library/page"), () => import("../../src/app/clinic/library/loading"))),
  at("/clinic/templates", clinic(() => import("../../src/app/clinic/templates/page"))),
  at("/clinic/templates/new", clinic(() => import("../../src/app/clinic/templates/new/page"), () => import("../../src/app/clinic/templates/new/loading"))),
  at("/clinic/templates/:id", clinic(() => import("../../src/app/clinic/templates/[id]/page"), () => import("../../src/app/clinic/templates/[id]/loading"))),
  at("/clinic/settings", clinic(() => import("../../src/app/clinic/settings/page"))),
];

export const notFound = () => import("../../src/app/not-found");
export const rootError = () => import("../../src/app/error");

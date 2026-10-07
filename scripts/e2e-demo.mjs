/**
 * End-to-end walkthrough of the browser demo (the same pages and logic as the full app).
 * Usage: node scripts/e2e-demo.mjs [baseUrl] [outDir]
 * Walks the core loop: patient does a session and reports pain → clinician sees it,
 * replies and edits the plan → patient sees the reply and the updated plan.
 */
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = (process.argv[2] ?? "http://localhost:4173/form/").replace(/\/?$/, "/");
const OUT = process.argv[3] ?? "ci-out/screens";
mkdirSync(OUT, { recursive: true });

const results = [];
const problems = [];
let shot = 0;

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 860 }, timezoneId: "America/Vancouver" });
const page = await context.newPage();
page.setDefaultTimeout(20000);
page.on("pageerror", (e) => problems.push(`pageerror: ${e.message}`));
page.on("console", (m) => {
  if (m.type() === "error") problems.push(`console: ${m.text().slice(0, 300)}`);
});

const go = (path) => page.goto(`${BASE}#${path}`);
async function snap(name, p = page) {
  shot += 1;
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${OUT}/${String(shot).padStart(2, "0")}-${name}.png`, fullPage: true });
}
async function step(name, fn) {
  const before = problems.length;
  try {
    await fn();
    results.push(`PASS  ${name}${problems.length > before ? `  (${problems.length - before} console errors)` : ""}`);
  } catch (error) {
    results.push(`FAIL  ${name}\n      ${String(error?.message ?? error).split("\n").slice(0, 4).join("\n      ")}`);
    await snap(`FAIL-${name.replace(/\W+/g, "-").slice(0, 40)}`).catch(() => {});
  }
}
const text = (t) => page.getByText(t, { exact: false }).first();

await step("landing page renders", async () => {
  await page.goto(BASE);
  await text("Getting the demo ready").waitFor({ state: "detached", timeout: 60000 }).catch(() => {});
  await page.getByRole("heading").first().waitFor();
  await snap("landing");
});

await step("demo chooser", async () => {
  await go("/demo");
  await page.getByRole("button", { name: /See the patient app/i }).waitFor();
  await snap("demo-chooser");
});

await step("start demo as patient → Today", async () => {
  await page.getByRole("button", { name: /See the patient app/i }).click();
  await page.waitForURL(/#\/app/, { timeout: 90000 });
  await text("Start today").waitFor({ timeout: 60000 });
  await snap("patient-today");
});

await step("start session", async () => {
  await page.getByRole("button", { name: /Start today/i }).first().click();
  await page.waitForURL(/#\/app\/session/);
  await page.getByRole("button", { name: /Complete exercise/i }).waitFor();
  await snap("session-exercise-1");
});

await step("complete exercise 1 and report pain with a note", async () => {
  await page.getByRole("button", { name: /Complete exercise/i }).click();
  await text("How did that feel?").waitFor();
  await snap("feedback");
  await page.getByRole("button", { name: /^Painful/ }).click();
  await text("a little more?").waitFor();
  await page.getByRole("button", { name: /^Shoulder$/ }).click().catch(() => {});
  await page.getByRole("textbox").first().fill("Pinched at the top of the movement on my left side.");
  await snap("pain-sheet");
  await page.getByRole("button", { name: /^Send$/ }).click();
  await page.waitForTimeout(800);
  await snap("after-pain");
});

await step("complete the remaining exercises", async () => {
  for (let i = 0; i < 8; i++) {
    if (await text("You're done").isVisible().catch(() => false)) break;
    const next = page.getByRole("button", { name: /^(Next exercise|Continue|Next)/i });
    if (await next.first().isVisible().catch(() => false)) {
      await next.first().click();
      await page.waitForTimeout(300);
      continue;
    }
    const complete = page.getByRole("button", { name: /Complete exercise/i });
    if (await complete.isVisible().catch(() => false)) {
      await complete.click();
      await text("How did that feel?").waitFor();
      await page.getByRole("button", { name: /^Good/ }).click();
      await page.waitForTimeout(700);
      continue;
    }
    await page.waitForTimeout(700);
  }
  await text("You're done").waitFor();
  await snap("session-complete");
});

await step("back to Today shows complete", async () => {
  await page.getByRole("button", { name: /^Done$/ }).or(page.getByRole("link", { name: /^Done$/ })).first().click();
  await page.waitForURL(/#\/app$/);
  await text("complete").waitFor();
  await snap("today-complete");
});

for (const [path, label] of [
  ["/app/progress", "progress"],
  ["/app/program", "program"],
  ["/app/messages", "messages"],
  ["/app/profile", "profile"],
]) {
  await step(`patient ${label} page`, async () => {
    await go(path);
    await page.locator("#main").first().waitFor();
    await page.waitForTimeout(600);
    await snap(`patient-${label}`);
  });
}

await step("switch to clinician view", async () => {
  await page.getByRole("button", { name: /Clinician view/i }).click();
  await page.waitForURL(/#\/clinic/);
  await text("Jordan Lee").waitFor();
  await snap("clinician-dashboard");
});

await step("clinician sees Jordan's pain report in context", async () => {
  await go("/clinic/patients");
  await page.getByRole("link", { name: /Jordan Lee/ }).first().click();
  await text("Pinched at the top").waitFor();
  await snap("clinician-patient");
});

await step("clinician replies to the feedback", async () => {
  await page.getByRole("button", { name: /^Reply/ }).first().click();
  await page.getByRole("textbox").last().fill("Thanks Jordan — keep Wall Angels below the pinch for now. We'll review Thursday.");
  await page.getByRole("button", { name: /^Send/ }).last().click();
  await page.waitForTimeout(1200);
  await snap("clinician-replied");
});

await step("clinician edits the program (adds Calf Raise) → new version", async () => {
  await page.getByRole("link", { name: /Edit program/i }).first().click();
  await page.waitForURL(/\/program/);
  await page.getByRole("searchbox").first().fill("calf raise");
  await page.waitForTimeout(400);
  await snap("builder-search");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(500);
  await snap("builder-added");
  await page.getByRole("button", { name: /Review changes|Review & assign/i }).first().click();
  await page.waitForTimeout(500);
  await snap("builder-review");
  await page.getByRole("button", { name: /Save changes|Assign program/i }).last().click();
  await page.waitForURL(/#\/clinic\/patients\/[^/]+$/, { timeout: 30000 });
  await go(`${new URL(page.url()).hash.slice(1)}?tab=history`);
  await text("Calf Raise").waitFor();
  await snap("version-history");
});

for (const [path, label] of [
  ["/clinic/library", "library"],
  ["/clinic/templates", "templates"],
  ["/clinic/settings", "settings"],
]) {
  await step(`clinician ${label} page`, async () => {
    await go(path);
    await page.locator("#main").first().waitFor();
    await page.waitForTimeout(800);
    await snap(`clinician-${label}`);
  });
}

await step("library: open-library exercise with photos", async () => {
  await go("/clinic/library");
  await page.getByRole("searchbox").first().fill("child's pose");
  await page.waitForTimeout(500);
  await page.getByText("Child's Pose").first().click();
  await page.waitForTimeout(1200);
  await snap("library-open-exercise");
  await page.keyboard.press("Escape");
});

await step("create a patient and get an invite link", async () => {
  await go("/clinic/patients/new");
  await page.getByLabel(/name/i).first().fill("Riley Morgan");
  await page.getByRole("button", { name: /Add patient|Create/i }).first().click();
  await text("/invite/").waitFor({ timeout: 15000 });
  await snap("patient-created");
});

await step("switch back to patient: sees reply and plan update", async () => {
  await go("/clinic");
  await page.getByRole("button", { name: /Patient view/i }).click();
  await page.waitForURL(/#\/app/);
  await text("updated your plan").waitFor();
  await snap("patient-plan-updated");
  await go("/app/messages");
  await text("below the pinch").waitFor();
  await snap("patient-reply");
});

await step("mobile: Today and a session screen", async () => {
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    timezoneId: "America/Vancouver",
    storageState: await context.storageState(),
  });
  const m = await mobile.newPage();
  m.on("pageerror", (e) => problems.push(`mobile pageerror: ${e.message}`));
  await m.goto(`${BASE}#/app`);
  await m.getByRole("heading").first().waitFor({ timeout: 60000 });
  await m.waitForTimeout(1500);
  await snap("mobile-today", m);
  await m.goto(`${BASE}#/app/program`);
  await m.waitForTimeout(1500);
  await snap("mobile-program", m);
  await m.goto(`${BASE}#/`);
  await m.waitForTimeout(1500);
  await snap("mobile-landing", m);
  await mobile.close();
});

await browser.close();

const report = [...results, "", `Console/page errors (${problems.length}):`, ...[...new Set(problems)].slice(0, 60)].join("\n");
writeFileSync(`${OUT}/../e2e-report.txt`, report);
console.log(report);
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);

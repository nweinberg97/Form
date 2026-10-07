/*
 * Writes one SVG per library exercise to .data/demos/<slug>.svg for content
 * review: the first keyframe, with the second keyframe as a faint ghost.
 * Usage: npm run demo:render
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { EXERCISES } from "../src/content/exercises";
import { renderSvg } from "../src/lib/rig";

const outDir = join(process.cwd(), ".data", "demos");
mkdirSync(outDir, { recursive: true });

for (const exercise of EXERCISES) {
  const [first, second] = exercise.demo.frames;
  const svg = renderSvg(exercise.demo, first.pose, { ghost: second?.pose });
  writeFileSync(join(outDir, `${exercise.slug}.svg`), svg);
}

console.log(`Wrote ${EXERCISES.length} demo previews to ${outDir}`);

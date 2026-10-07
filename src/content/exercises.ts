/**
 * FORM's approved exercise library.
 *
 * Each exercise is written the way a careful physiotherapist would explain it
 * to a patient: plain language, short steps, what it should feel like, and a
 * safety note that always defers to the treating clinician.
 *
 * Demonstrations are keyframe poses for the movement rig (src/lib/rig.ts).
 * Poses are built from contact points (a foot on the floor, a hand on a wall,
 * a knee on the mat) with a small two-link solver, so figures stay grounded
 * and joints bend the right way.
 */
import type { ExerciseSeed } from "./types";
import { RIG, STAND_Y, solve, standing, standingFront, type Demo, type Pose } from "../lib/rig";

/* ------------------------------------------------------------------ */
/* Authoring geometry                                                  */
/* ------------------------------------------------------------------ */

type XY = [number, number];
type View = Demo["view"];
type Sk = ReturnType<typeof solve>;

const DEG = 180 / Math.PI;
const F = RIG.floorY;
/** Ankle height when the foot is flat on the floor. */
const ANK = F - 3;
/** Knee or hand resting on the floor. */
const GROUND = F - 4;
/** Body centreline when lying on the floor. */
const LIE = F - 5;
/** Pelvis height when sitting on the chair prop. */
const SEAT = F - 54;
/** Head angle that keeps the head resting on the floor when lying head-left. */
const HEAD_DOWN_LEFT = -112;

const vec = (angle: number, length: number): XY => [Math.sin(angle / DEG) * length, Math.cos(angle / DEG) * length];
const add = (a: XY, b: XY): XY => [a[0] + b[0], a[1] + b[1]];
const sub = (a: XY, b: XY): XY => [a[0] - b[0], a[1] - b[1]];
const angleTo = (from: XY, to: XY) => Math.atan2(to[0] - from[0], to[1] - from[1]) * DEG;
const xy = (p: { x: number; y: number }): XY => [p.x, p.y];
const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Two-link solver: angles for a limb from `from` reaching `to`, with the
 * middle joint (elbow/knee) on the side of `bend`.
 */
function ik(from: XY, to: XY, l1: number, l2: number, bend: XY): [number, number] {
  const [dx, dy] = sub(to, from);
  const d = Math.min(Math.max(Math.hypot(dx, dy), Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.01);
  const base = Math.atan2(dx, dy) * DEG;
  const alpha = Math.acos((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d)) * DEG;
  const options = [base + alpha, base - alpha].map((a1) => {
    const joint = add(from, vec(a1, l1));
    return { a1, joint, score: (joint[0] - from[0]) * bend[0] + (joint[1] - from[1]) * bend[1] };
  });
  const best = options[0].score >= options[1].score ? options[0] : options[1];
  return [best.a1, angleTo(best.joint, to)];
}

type ArmSpec = [number, number] | { to: XY; bend: XY } | ((s: Sk) => [number, number]);
type LegSpec = [number, number, number] | { to: XY; bend: XY; foot?: number } | ((s: Sk) => [number, number, number]);

type FigSpec = {
  root: XY;
  torso?: number;
  head?: number;
  nearArm?: ArmSpec;
  farArm?: ArmSpec;
  nearLeg?: LegSpec;
  farLeg?: LegSpec;
};

/** Builds a pose; limbs can be fixed angles, a reach target, or a function of the skeleton. */
function fig(spec: FigSpec, view: View = "side"): Pose {
  const def = view === "front" ? standingFront(0) : standing(0);
  const torso = spec.torso ?? 180;
  const base: Pose = {
    root: spec.root,
    torso,
    head: spec.head ?? torso,
    nearArm: def.nearArm,
    farArm: def.farArm,
    nearLeg: def.nearLeg,
    farLeg: def.farLeg,
  };
  const s = solve(base, view);
  const arm = (a: ArmSpec | undefined, from: XY, fallback: [number, number]): [number, number] => {
    if (!a) return fallback;
    if (typeof a === "function") return a(s);
    if ("to" in a) return ik(from, a.to, RIG.upperArm, RIG.forearm, a.bend);
    return a;
  };
  const leg = (l: LegSpec | undefined, from: XY, fallback: [number, number, number]): [number, number, number] => {
    if (!l) return fallback;
    if (typeof l === "function") return l(s);
    if ("to" in l) return [...ik(from, l.to, RIG.thigh, RIG.shin, l.bend), l.foot ?? fallback[2]];
    return l;
  };
  const p: Pose = {
    ...base,
    nearArm: arm(spec.nearArm, xy(s.nearShoulder), def.nearArm),
    farArm: arm(spec.farArm, xy(s.farShoulder), def.farArm),
    nearLeg: leg(spec.nearLeg, xy(s.nearHip), def.nearLeg),
    farLeg: leg(spec.farLeg, xy(s.farHip), def.farLeg),
  };
  return {
    root: [r1(p.root[0]), r1(p.root[1])],
    torso: r1(p.torso),
    head: r1(p.head),
    nearArm: [r1(p.nearArm[0]), r1(p.nearArm[1])],
    farArm: [r1(p.farArm[0]), r1(p.farArm[1])],
    nearLeg: [r1(p.nearLeg[0]), r1(p.nearLeg[1]), r1(p.nearLeg[2])],
    farLeg: [r1(p.farLeg[0]), r1(p.farLeg[1]), r1(p.farLeg[2])],
  };
}

/** A point on the trunk: `along` the spine from the pelvis, `forward` toward the chest. */
function trunkPoint(root: XY, torso: number, along: number, forward = 0): XY {
  return add(add(root, vec(torso, along)), vec(torso - 90, forward));
}

/** Pelvis position for a straight leg standing on `ankle`. */
const overAnkle = (ankle: XY, dx = -1): XY => [ankle[0] + dx, ankle[1] - Math.sqrt((RIG.thigh + RIG.shin - 0.5) ** 2 - dx * dx)];

/* Side-view building blocks ---------------------------------------- */

/** Seated on a chair prop at `cx` (backrest on the left, facing right). */
function seated(cx: number, extra: Partial<FigSpec> & { lean?: number } = {}): FigSpec {
  const torso = extra.lean ?? 180;
  const root: XY = extra.root ?? [cx - 6, SEAT];
  return {
    root,
    torso,
    head: extra.head ?? torso,
    nearLeg: extra.nearLeg ?? { to: [cx + 36, ANK], bend: [0.3, -1] },
    farLeg: extra.farLeg ?? { to: [cx + 31, ANK], bend: [0.3, -1] },
    nearArm: extra.nearArm ?? { to: trunkPoint(root, torso, -2, 30), bend: [-1, 0.3] },
    farArm: extra.farArm ?? { to: trunkPoint(root, torso, -2, 26), bend: [-1, 0.3] },
  };
}

/** Hands and knees, facing right. Knees under hips, hands under shoulders. */
const QUAD_TORSO = 104;
function quadruped(knee: number, extra: Partial<FigSpec> = {}): FigSpec {
  const root: XY = extra.root ?? [knee, GROUND - RIG.thigh];
  const torso = extra.torso ?? QUAD_TORSO;
  // Hands stay planted under where the shoulders sit in a neutral position.
  const handX = trunkPoint([knee, GROUND - RIG.thigh], QUAD_TORSO, RIG.torso - 4)[0] + 2;
  return {
    root,
    torso,
    head: extra.head ?? 100,
    nearArm: extra.nearArm ?? { to: [handX, GROUND], bend: [-1, 0] },
    farArm: extra.farArm ?? { to: [handX + 2, GROUND], bend: [-1, 0] },
    nearLeg: extra.nearLeg ?? { to: [knee - RIG.shin, GROUND], bend: [0, 1], foot: -90 },
    farLeg: extra.farLeg ?? (() => [-2, -88, -90]),
  };
}

/** Lying on the back, head to the left. */
function supine(x: number, extra: Partial<FigSpec> = {}): FigSpec {
  const root: XY = extra.root ?? [x, LIE];
  const torso = extra.torso ?? -90;
  const shoulder = trunkPoint(root, torso, RIG.torso - 4);
  const hands: XY = [shoulder[0] + 57, GROUND];
  return {
    root,
    torso,
    head: extra.head ?? HEAD_DOWN_LEFT,
    nearArm: extra.nearArm ?? { to: hands, bend: [0, -1] },
    farArm: extra.farArm ?? { to: [hands[0] - 3, GROUND], bend: [0, -1] },
    nearLeg: extra.nearLeg ?? { to: [x + 50, ANK], bend: [0, -1], foot: 90 },
    farLeg: extra.farLeg ?? { to: [x + 46, ANK], bend: [0, -1], foot: 90 },
  };
}

/** Lying on one side, head to the left, resting on the lower arm. */
function sideLying(x: number, extra: Partial<FigSpec> = {}): FigSpec {
  const root: XY = [x, LIE];
  return {
    root,
    torso: -94,
    head: -104,
    // Head resting on the lower arm stretched overhead; top hand on the floor in front.
    nearArm: [-96, -91],
    farArm: { to: [x - 22, GROUND], bend: [0, -1] },
    ...extra,
  };
}

/** Sitting on the floor with legs out in front. */
function longSit(x: number, extra: Partial<FigSpec> = {}): FigSpec {
  const root: XY = [x, LIE];
  const torso = extra.torso ?? 188;
  return {
    root,
    torso,
    head: extra.head ?? 182,
    nearArm: { to: [x - 18, GROUND], bend: [-1, 0] },
    farArm: { to: [x - 15, GROUND], bend: [-1, 0] },
    nearLeg: [90, 90, 175],
    farLeg: [89, 90, 172],
    ...extra,
  };
}

/* ------------------------------------------------------------------ */
/* Demonstrations                                                      */
/* ------------------------------------------------------------------ */

function chinTuckDemo(): Demo {
  const cx = 140;
  return {
    view: "side",
    props: [{ type: "chair", x: cx }],
    tempo: 1.6,
    frames: [
      { pose: fig(seated(cx, { lean: 175, head: 158 })), cue: "Sit tall, eyes level", hold: 0.6 },
      { pose: fig(seated(cx, { lean: 181, head: 192 })), cue: "Tuck your chin straight back", hold: 2 },
    ],
  };
}

function cervicalRotationDemo(): Demo {
  // The rig has no face, so rotation is suggested by a small head turn plus the caption.
  const base = (head: number) => fig({ root: [160, STAND_Y], torso: 180, head }, "front");
  return {
    view: "front",
    tempo: 1.8,
    frames: [
      { pose: base(180), cue: "Stand tall, shoulders relaxed", hold: 0.6 },
      { pose: base(175), cue: "Turn slowly to one side", hold: 1.5 },
      { pose: base(185), cue: "Now turn to the other side", hold: 1.5 },
    ],
  };
}

function levatorDemo(): Demo {
  const cx = 140;
  const make = (head: number) => {
    const root: XY = [cx - 6, SEAT];
    const neck = trunkPoint(root, 180, RIG.torso);
    const headCentre = add(neck, vec(head, RIG.headOffset));
    const backOfHead = add(headCentre, vec(head + 70, 9));
    return fig(
      seated(cx, {
        head,
        nearArm: { to: backOfHead, bend: [0.4, -1] },
        farArm: { to: [root[0] + 4, F - 47], bend: [-1, 0] },
      }),
    );
  };
  return {
    view: "side",
    props: [{ type: "chair", x: cx }],
    tempo: 2,
    frames: [
      { pose: make(176), cue: "Hand on the back of head", hold: 0.6 },
      { pose: make(128), cue: "Nose toward opposite armpit", hold: 3 },
    ],
  };
}

function upperTrapDemo(): Demo {
  const make = (head: number) => {
    const root: XY = [160, STAND_Y];
    const neck = trunkPoint(root, 180, RIG.torso);
    const headCentre = add(neck, vec(head, RIG.headOffset));
    return fig(
      {
        root,
        torso: 180,
        head,
        farArm: { to: add(headCentre, [-5, -6]), bend: [1, -0.6] },
        nearArm: [-6, -3],
      },
      "front",
    );
  };
  return {
    view: "front",
    tempo: 2,
    frames: [
      { pose: make(180), cue: "Hand resting on your head", hold: 0.6 },
      { pose: make(146), cue: "Ear toward shoulder, hold", hold: 3 },
    ],
  };
}

function wallAngelsDemo(): Demo {
  const root: XY = [160, STAND_Y];
  return {
    view: "front",
    tempo: 2,
    frames: [
      { pose: fig({ root, torso: 180, nearArm: [-90, 180], farArm: [90, 180] }, "front"), cue: "Arms in a goalpost shape", hold: 0.6 },
      { pose: fig({ root, torso: 180, nearArm: [-116, -172], farArm: [116, 172] }, "front"), cue: "Slide up, keep contact", hold: 0.8 },
    ],
  };
}

function bandExternalRotationDemo(): Demo {
  const root: XY = [160, STAND_Y];
  return {
    view: "front",
    props: [{ type: "band", anchor: [270, 78], to: "nearHand" }],
    tempo: 1.6,
    frames: [
      { pose: fig({ root, torso: 180, nearArm: [-4, 88], farArm: [8, 4] }, "front"), cue: "Elbow tucked at your side", hold: 0.5 },
      { pose: fig({ root, torso: 180, nearArm: [-4, -74], farArm: [8, 4] }, "front"), cue: "Rotate out, elbow stays in", hold: 1 },
    ],
  };
}

function scapularRetractionDemo(): Demo {
  const root: XY = [128, STAND_Y];
  const shoulder = trunkPoint(root, 180, RIG.torso - 4);
  const make = (hand: XY) =>
    fig({
      root,
      torso: 180,
      nearArm: { to: hand, bend: [-1, 0.4] },
      farArm: { to: add(hand, [-2, 1]), bend: [-1, 0.4] },
    });
  return {
    view: "side",
    props: [{ type: "band", anchor: [292, shoulder[1] + 14], to: "bothHands" }],
    tempo: 1.6,
    frames: [
      { pose: make([shoulder[0] + 57, shoulder[1] + 12]), cue: "Arms long, band taut", hold: 0.5 },
      { pose: make([shoulder[0] + 10, shoulder[1] + 24]), cue: "Squeeze shoulder blades together", hold: 1.5 },
    ],
  };
}

function thoracicRotationDemo(): Demo {
  const knee = 120;
  const make = (bend: XY, head: number) => {
    const spec = quadruped(knee, { head });
    const root = spec.root;
    const neck = trunkPoint(root, QUAD_TORSO, RIG.torso);
    const headCentre = add(neck, vec(head, RIG.headOffset));
    const behindHead = add(headCentre, vec(head + 90, 8));
    return fig({ ...spec, nearArm: { to: behindHead, bend } });
  };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: make([0.2, 1], 80), cue: "Hand behind head, elbow down", hold: 0.5 },
      { pose: make([-0.6, -1], 150), cue: "Rotate elbow up to ceiling", hold: 1.5 },
    ],
  };
}

function pendulumDemo(): Demo {
  const root: XY = [104, STAND_Y + 6];
  const torso = 132;
  const make = (arm: number) =>
    fig({
      root,
      torso,
      head: 120,
      nearArm: [arm, arm],
      farArm: { to: [181, 92], bend: [0, 1] },
      nearLeg: { to: [112, ANK], bend: [1, 0] },
      farLeg: { to: [98, ANK], bend: [1, 0] },
    });
  return {
    view: "side",
    props: [{ type: "chair", x: 159, facing: "left" }],
    tempo: 1.4,
    frames: [
      { pose: make(-14), cue: "Let the arm hang loose", hold: 0.2 },
      { pose: make(16), cue: "Sway gently, let it swing", hold: 0.2 },
    ],
  };
}

function wallSlideDemo(): Demo {
  const W = 232;
  const root: XY = [198, STAND_Y];
  const make = (handY: number, bend: XY) =>
    fig({
      root,
      torso: 180,
      nearArm: { to: [W - 4, handY], bend },
      farArm: { to: [W - 5, handY + 1], bend },
    });
  return {
    view: "side",
    props: [{ type: "wall", x: W }],
    tempo: 2,
    frames: [
      { pose: make(24, [1, 0.6]), cue: "Forearms resting on the wall", hold: 0.5 },
      { pose: make(7, [1, 0.2]), cue: "Slide up as far as comfortable", hold: 1 },
    ],
  };
}

function doorwayPecDemo(): Demo {
  const D = 166;
  const make = (root: XY, torso: number, near: XY, far: XY) => {
    const shoulder = trunkPoint(root, torso, RIG.torso - 4);
    return fig({
      root,
      torso,
      nearArm: { to: [D - 1, shoulder[1] - 22], bend: [-1, 0.2] },
      farArm: [8, 4],
      nearLeg: { to: near, bend: [1, -0.2] },
      farLeg: { to: far, bend: [1, -0.2] },
    });
  };
  return {
    view: "side",
    props: [{ type: "doorway", x: D }],
    tempo: 2,
    frames: [
      { pose: make([184, STAND_Y], 180, [186, ANK], [182, ANK]), cue: "Forearm on the door frame", hold: 0.6 },
      { pose: make([202, STAND_Y + 5], 172, [232, ANK], [182, ANK]), cue: "Step through until you feel it", hold: 3 },
    ],
  };
}

function bandPullApartDemo(): Demo {
  const root: XY = [160, STAND_Y];
  const chest: XY = [160, 50];
  return {
    view: "front",
    props: [{ type: "band", anchor: chest, to: "bothHands" }],
    tempo: 1.6,
    frames: [
      {
        pose: fig(
          {
            root,
            torso: 180,
            nearArm: { to: [chest[0] - 13, chest[1]], bend: [-1, 0.6] },
            farArm: { to: [chest[0] + 13, chest[1]], bend: [1, 0.6] },
          },
          "front",
        ),
        cue: "Hold the band at chest height",
        hold: 0.4,
      },
      { pose: fig({ root, torso: 180, nearArm: [-92, -90], farArm: [92, 90] }, "front"), cue: "Pull apart, squeeze shoulder blades", hold: 1.2 },
    ],
  };
}

function catCowDemo(): Demo {
  const knee = 130;
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2.2,
    frames: [
      { pose: fig(quadruped(knee, { root: [knee - 5, GROUND - 43.7], torso: 95, head: 22 })), cue: "Round your back, chin down", hold: 0.8 },
      { pose: fig(quadruped(knee, { root: [knee + 5, GROUND - 43.7], torso: 113, head: 158 })), cue: "Let your back dip, look ahead", hold: 0.8 },
    ],
  };
}

function pelvicTiltDemo(): Demo {
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: fig(supine(140)), cue: "Knees bent, back relaxed", hold: 0.6 },
      { pose: fig(supine(140, { root: [140, LIE - 3], torso: -93 })), cue: "Gently flatten your lower back", hold: 2 },
    ],
  };
}

function pronePressUpDemo(): Demo {
  const x = 128;
  // Arm angles chosen so the hands stay planted through the whole press.
  const make = (torso: number, head: number, arm: [number, number]) => {
    const root: XY = [x, LIE];
    return fig({
      root,
      torso,
      head,
      nearArm: arm,
      farArm: [arm[0] + 2, arm[1] + 2],
      nearLeg: [-90, -90, -92],
      farLeg: [-88, -90, -92],
    });
  };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: make(90, 110, [146, 16]), cue: "Hands flat by your shoulders", hold: 0.6 },
      { pose: make(142, 150, [60, 28]), cue: "Press up, hips stay down", hold: 1.5 },
    ],
  };
}

function deadBugDemo(): Demo {
  const x = 150;
  const start = fig(supine(x, { nearArm: [178, 178], farArm: [-178, -178], nearLeg: [180, 90, 180], farLeg: [176, 88, 178] }));
  const reach = fig(supine(x, { nearArm: [178, 178], farArm: [-100, -100], nearLeg: [101, 99, 172], farLeg: [176, 88, 178] }));
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: start, cue: "Arms up, knees over hips", hold: 0.5 },
      { pose: reach, cue: "Lower opposite arm and leg", hold: 1 },
    ],
  };
}

function birdDogDemo(): Demo {
  const knee = 120;
  const spec = quadruped(knee);
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: fig(spec), cue: "Hands and knees, back flat", hold: 0.5 },
      {
        pose: fig({ ...spec, torso: QUAD_TORSO - 4, farArm: [100, 100], farLeg: (() => [-2, -88, -90]) as LegSpec, nearLeg: [-90, -90, -6] }),
        cue: "Reach opposite arm and leg",
        hold: 2,
      },
    ],
  };
}

function pallofPressDemo(): Demo {
  const root: XY = [160, STAND_Y + 4];
  const legs = { nearLeg: { to: [146, ANK] as XY, bend: [-1, 0] as XY }, farLeg: { to: [174, ANK] as XY, bend: [1, 0] as XY } };
  return {
    view: "front",
    props: [{ type: "band", anchor: [290, 70], to: "bothHands" }],
    tempo: 1.8,
    frames: [
      {
        pose: fig(
          {
            root,
            torso: 180,
            ...legs,
            nearArm: { to: [157, 66], bend: [-1, 0.6] },
            farArm: { to: [163, 66], bend: [1, 0.6] },
          },
          "front",
        ),
        cue: "Hands at your chest",
        hold: 0.5,
      },
      {
        pose: fig(
          {
            root,
            torso: 180,
            ...legs,
            nearArm: { to: [157, 88], bend: [-1, 0] },
            farArm: { to: [163, 88], bend: [1, 0] },
          },
          "front",
        ),
        cue: "Press out, don't let it twist",
        hold: 2,
      },
    ],
  };
}

function sidePlankDemo(): Demo {
  const elbow: XY = [204, GROUND];
  const shoulderUp: XY = [elbow[0], elbow[1] - RIG.upperArm];
  const span = RIG.thigh + RIG.torso - 4;
  const dy = elbow[1] - shoulderUp[1];
  const knee: XY = [shoulderUp[0] - Math.sqrt(span * span - dy * dy), GROUND];
  const dir = sub(shoulderUp, knee);
  const len = Math.hypot(dir[0], dir[1]);
  const hipUp = add(knee, [(dir[0] / len) * RIG.thigh, (dir[1] / len) * RIG.thigh]);
  const make = (hip: XY) => {
    const torso = angleTo(hip, shoulderUp);
    return fig({
      root: hip,
      torso,
      head: torso + 4,
      nearArm: (s) => [angleTo(xy(s.nearShoulder), elbow), 90],
      farArm: { to: trunkPoint(hip, torso, 2, -2), bend: [0, -1] },
      nearLeg: [angleTo(hip, knee), -90, -90],
      farLeg: [angleTo(hip, knee) + 3, -92, -90],
    });
  };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: make([knee[0] + RIG.thigh - 1, LIE - 1]), cue: "Elbow under shoulder, knees bent", hold: 0.5 },
      { pose: make(hipUp), cue: "Lift hips, hold a straight line", hold: 3 },
    ],
  };
}

function gluteBridgeDemo(): Demo {
  const neck: XY = [100, LIE];
  const ankle: XY = [202, ANK];
  const make = (torso: number) => {
    const root = sub(neck, vec(torso, RIG.torso));
    const shoulder = trunkPoint(root, torso, RIG.torso - 4);
    return fig({
      root,
      torso,
      head: HEAD_DOWN_LEFT,
      nearArm: { to: [shoulder[0] + 57, GROUND], bend: [0, -1] },
      farArm: { to: [shoulder[0] + 54, GROUND], bend: [0, -1] },
      nearLeg: { to: ankle, bend: [0, -1], foot: 90 },
      farLeg: { to: [ankle[0] - 3, ANK], bend: [0, -1], foot: 90 },
    });
  };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: make(-90), cue: "Feet flat, knees bent", hold: 0.5 },
      { pose: make(-68), cue: "Squeeze glutes, lift hips", hold: 2 },
    ],
  };
}

function hipFlexorDemo(): Demo {
  const knee: XY = [132, GROUND];
  const front: XY = [196, ANK];
  const make = (dx: number) => {
    const root: XY = [knee[0] + dx, knee[1] - Math.sqrt(RIG.thigh ** 2 - dx * dx)];
    return fig({
      root,
      torso: 181,
      nearLeg: [angleTo(root, knee), -90, -90],
      farLeg: { to: front, bend: [1, -1], foot: 90 },
      nearArm: { to: trunkPoint(root, 181, 6, 6), bend: [-1, 0.3] },
      farArm: { to: trunkPoint(root, 181, 6, 3), bend: [-1, 0.3] },
    });
  };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: make(6), cue: "Kneel, tuck your pelvis under", hold: 0.6 },
      { pose: make(22), cue: "Shift forward, feel the front", hold: 3 },
    ],
  };
}

function clamshellDemo(): Demo {
  const x = 140;
  const feet: XY = [x + 80, ANK - 1];
  const bottom = { to: feet, bend: [0, -1] as XY, foot: 110 };
  const s0 = fig(sideLying(x, { farLeg: bottom, nearLeg: { to: [feet[0], feet[1] - 3], bend: [0, -1], foot: 110 } }));
  const open = fig(
    sideLying(x, {
      farLeg: bottom,
      nearLeg: (s) => {
        const knee = add(xy(s.nearHip), vec(146, RIG.thigh));
        return [146, angleTo(knee, [feet[0], feet[1] - 3]), 110];
      },
    }),
  );
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: s0, cue: "Knees bent, feet together", hold: 0.5 },
      { pose: open, cue: "Open top knee, feet stay together", hold: 1.5 },
    ],
  };
}

function sideLyingAbductionDemo(): Demo {
  const x = 130;
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: fig(sideLying(x, { farLeg: [91, 89, 100], nearLeg: [92, 90, 102] })), cue: "Legs long, hips stacked", hold: 0.5 },
      { pose: fig(sideLying(x, { farLeg: [91, 89, 100], nearLeg: [119, 119, 130] })), cue: "Lift top leg, toes forward", hold: 1.5 },
    ],
  };
}

function hipHingeDemo(): Demo {
  const near: XY = [162, ANK];
  const far: XY = [158, ANK];
  const make = (root: XY, torso: number, arm: number) =>
    fig({
      root,
      torso,
      head: torso + 4,
      nearArm: [arm, arm - 4],
      farArm: [arm - 6, arm - 10],
      nearLeg: { to: near, bend: [1, 0], foot: 90 },
      farLeg: { to: far, bend: [1, 0], foot: 90 },
    });
  return {
    view: "side",
    tempo: 2,
    frames: [
      { pose: make(overAnkle(near, -1), 180, 8), cue: "Stand tall, knees soft", hold: 0.5 },
      { pose: make([140, STAND_Y + 6], 120, 18), cue: "Push your hips back", hold: 1 },
    ],
  };
}

function lateralBandWalkDemo(): Demo {
  const nearAnkle: XY = [148, ANK];
  const make = (rootX: number, farX: number) =>
    fig(
      {
        root: [rootX, STAND_Y + 7],
        torso: 180,
        nearLeg: { to: nearAnkle, bend: [-1, 0], foot: -90 },
        farLeg: { to: [farX, ANK], bend: [1, 0], foot: 90 },
        nearArm: { to: [rootX - 14, STAND_Y - 2], bend: [-1, 0] },
        farArm: { to: [rootX + 14, STAND_Y - 2], bend: [1, 0] },
      },
      "front",
    );
  return {
    view: "front",
    props: [{ type: "band", anchor: [nearAnkle[0], nearAnkle[1] - 6], to: "farFoot" }],
    tempo: 1.4,
    frames: [
      { pose: make(160, 172), cue: "Band around ankles, knees soft", hold: 0.4 },
      { pose: make(172, 198), cue: "Step wide, keep tension", hold: 0.4 },
    ],
  };
}

function quadSetDemo(): Demo {
  const x = 106;
  return {
    view: "side",
    props: [
      { type: "mat" },
      // A rolled towel under the knee.
      { type: "step", x: 141, w: 18, h: 8 },
    ],
    tempo: 1.6,
    frames: [
      { pose: fig(longSit(x, { nearLeg: [98.5, 81.5, 168] })), cue: "Towel roll under your knee", hold: 0.5 },
      { pose: fig(longSit(x, { nearLeg: [94.5, 85.5, 186] })), cue: "Press knee down, tighten thigh", hold: 5 },
    ],
  };
}

function sitToStandDemo(): Demo {
  const cx = 116;
  const near: XY = [164, ANK];
  const far: XY = [160, ANK];
  const make = (root: XY, torso: number) =>
    fig({
      root,
      torso,
      head: torso + 4,
      nearArm: { to: trunkPoint(root, torso, 30, 9), bend: [-0.2, 1] },
      farArm: { to: trunkPoint(root, torso, 32, 8), bend: [-0.2, 1] },
      nearLeg: { to: near, bend: [1, -0.3], foot: 90 },
      farLeg: { to: far, bend: [1, -0.3], foot: 90 },
    });
  return {
    view: "side",
    props: [{ type: "chair", x: cx }],
    tempo: 1.6,
    frames: [
      { pose: make([cx + 2, SEAT], 140), cue: "Lean forward, nose over toes", hold: 0.5 },
      { pose: make([cx + 20, SEAT - 22], 152), cue: "Push through your feet", hold: 0 },
      { pose: make([near[0] - 3, STAND_Y + 2], 180), cue: "Stand up tall", hold: 0.6 },
    ],
  };
}

function straightLegRaiseDemo(): Demo {
  const x = 130;
  const bent = { to: [x + 48, ANK] as XY, bend: [0, -1] as XY, foot: 90 };
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 1.8,
    frames: [
      { pose: fig(supine(x, { farLeg: bent, nearLeg: [90, 90, 180] })), cue: "Tighten the thigh, knee straight", hold: 0.6 },
      { pose: fig(supine(x, { farLeg: bent, nearLeg: [128, 128, 214] })), cue: "Lift to the other knee's height", hold: 1.5 },
    ],
  };
}

function heelSlideDemo(): Demo {
  const x = 124;
  const straight: [number, number, number] = [90, 90, 180];
  return {
    view: "side",
    props: [{ type: "mat" }],
    tempo: 2,
    frames: [
      { pose: fig(supine(x, { farLeg: [89, 91, 178], nearLeg: straight })), cue: "Lie flat, legs straight", hold: 0.5 },
      { pose: fig(supine(x, { farLeg: [89, 91, 178], nearLeg: { to: [x + 50, LIE], bend: [0, -1], foot: 118 } })), cue: "Slide heel toward you", hold: 1.5 },
    ],
  };
}

function terminalKneeExtensionDemo(): Demo {
  const near: XY = [166, ANK];
  const far: XY = [140, ANK];
  const make = (root: XY) =>
    fig({
      root,
      torso: 180,
      nearArm: { to: trunkPoint(root, 180, 6, 6), bend: [-1, 0.3] },
      farArm: { to: trunkPoint(root, 180, 6, 3), bend: [-1, 0.3] },
      nearLeg: { to: near, bend: [1, 0], foot: 90 },
      farLeg: { to: far, bend: [1, 0], foot: 90 },
    });
  return {
    view: "side",
    tempo: 1.6,
    frames: [
      { pose: make([150, STAND_Y + 7]), cue: "Band behind knee, knee soft", hold: 0.4 },
      { pose: make([154, STAND_Y + 2]), cue: "Straighten knee against the band", hold: 1.5 },
    ],
  };
}

function stepUpDemo(): Demo {
  const step = { x: 172, w: 72, h: 14 };
  const top = F - step.h - 3;
  const onStep: XY = [194, top];
  const make = (root: XY, torso: number, far: XY) =>
    fig({
      root,
      torso,
      head: torso + 2,
      nearArm: [torso - 172, torso - 168],
      farArm: [torso - 186, torso - 190],
      nearLeg: { to: onStep, bend: [1, -0.3], foot: 90 },
      farLeg: { to: far, bend: [1, -0.3], foot: 90 },
    });
  return {
    view: "side",
    props: [{ type: "step", ...step }],
    tempo: 1.8,
    frames: [
      { pose: make([156, STAND_Y + 2], 170, [150, ANK]), cue: "Whole foot on the step", hold: 0.5 },
      { pose: make(overAnkle(onStep, -2), 180, [190, top]), cue: "Push through heel, stand tall", hold: 0.6 },
    ],
  };
}

function wallSitDemo(): Demo {
  const W = 66;
  const x = W + 12;
  const ankles: XY = [x + 44, ANK];
  const make = (y: number) =>
    fig({
      root: [x, y],
      torso: 180,
      nearArm: { to: [x + 28, y - 3], bend: [-0.2, 1] },
      farArm: { to: [x + 25, y - 2], bend: [-0.2, 1] },
      nearLeg: { to: ankles, bend: [1, -0.3], foot: 90 },
      farLeg: { to: [ankles[0] - 3, ANK], bend: [1, -0.3], foot: 90 },
    });
  return {
    view: "side",
    props: [{ type: "wall", x: W }],
    tempo: 2,
    frames: [
      { pose: make(110), cue: "Back flat against the wall", hold: 0.5 },
      { pose: make(134), cue: "Slide down and hold", hold: 4 },
    ],
  };
}

function miniSquatDemo(): Demo {
  const near: XY = [152, ANK];
  const far: XY = [148, ANK];
  const make = (root: XY, torso: number, arm: number) =>
    fig({
      root,
      torso,
      head: torso + 6,
      nearArm: [arm, arm - 2],
      farArm: [arm - 6, arm - 8],
      nearLeg: { to: near, bend: [1, 0], foot: 90 },
      farLeg: { to: far, bend: [1, 0], foot: 90 },
    });
  return {
    view: "side",
    tempo: 1.8,
    frames: [
      { pose: make(overAnkle(near, -1), 180, 8), cue: "Feet hip-width, stand tall", hold: 0.4 },
      { pose: make([138, STAND_Y + 18], 158, 80), cue: "Sit back, knees over toes", hold: 0.8 },
    ],
  };
}

function calfRaiseDemo(): Demo {
  const chairTop: XY = [182, F - 46 - 46];
  const toeX = 160;
  const make = (lift: number) => {
    const footAngle = lift ? (Math.acos(lift / RIG.foot) * DEG) : 90;
    const ankle: XY = [toeX - Math.sin(footAngle / DEG) * RIG.foot, ANK - lift];
    const root = overAnkle(ankle, -1);
    return fig({
      root,
      torso: 180,
      nearArm: { to: chairTop, bend: [0, 1] },
      nearLeg: { to: ankle, bend: [1, 0], foot: footAngle },
      farLeg: { to: [ankle[0] - 3, ankle[1]], bend: [1, 0], foot: footAngle },
    });
  };
  return {
    view: "side",
    props: [{ type: "chair", x: 204 }],
    tempo: 1.6,
    frames: [
      { pose: make(0), cue: "Light hand on the chair", hold: 0.4 },
      { pose: make(10), cue: "Rise up onto your toes", hold: 1 },
    ],
  };
}

function ankleDorsiflexionDemo(): Demo {
  const W = 240;
  const front: XY = [W - 21, ANK];
  const back: XY = [176, ANK];
  const make = (root: XY) => {
    const shoulder = trunkPoint(root, 176, RIG.torso - 4);
    return fig({
      root,
      torso: 176,
      nearArm: { to: [W - 4, shoulder[1] + 8], bend: [0, 1] },
      farArm: { to: [W - 5, shoulder[1] + 10], bend: [0, 1] },
      nearLeg: { to: front, bend: [1, -0.2], foot: 90 },
      farLeg: { to: back, bend: [1, -0.2], foot: 90 },
    });
  };
  return {
    view: "side",
    props: [{ type: "wall", x: W }],
    tempo: 1.8,
    frames: [
      { pose: make([204, STAND_Y + 6]), cue: "Front foot close to wall", hold: 0.4 },
      { pose: make([212, STAND_Y + 11]), cue: "Knee to wall, heel down", hold: 1.5 },
    ],
  };
}

function singleLegBalanceDemo(): Demo {
  const chairTop: XY = [182, F - 92];
  const stand: XY = [150, ANK];
  const root = overAnkle(stand, -1);
  return {
    view: "side",
    props: [{ type: "chair", x: 204 }],
    tempo: 1.6,
    frames: [
      {
        pose: fig({ root, torso: 180, nearArm: { to: chairTop, bend: [0, 1] }, nearLeg: { to: [stand[0] + 3, ANK], bend: [1, 0], foot: 90 }, farLeg: { to: stand, bend: [1, 0], foot: 90 } }),
        cue: "Stand tall by a chair",
        hold: 0.5,
      },
      {
        pose: fig({ root, torso: 180, nearArm: { to: [chairTop[0] - 2, chairTop[1] - 8], bend: [0, 1] }, nearLeg: [62, -4, 84], farLeg: { to: stand, bend: [1, 0], foot: 90 } }),
        cue: "Lift one foot and hold",
        hold: 4,
      },
    ],
  };
}

function towelCalfStretchDemo(): Demo {
  const x = 100;
  const make = (torso: number, hand: XY, foot: number) =>
    fig(
      longSit(x, {
        torso,
        head: torso - 4,
        nearLeg: [90, 90, foot],
        nearArm: { to: hand, bend: [0, 1] },
        farArm: { to: add(hand, [-2, 1]), bend: [0, 1] },
      }),
    );
  return {
    view: "side",
    props: [{ type: "mat" }, { type: "towel", to: "nearFoot" }],
    tempo: 2,
    frames: [
      { pose: make(172, [152, 136], 158), cue: "Towel around the ball of foot", hold: 0.5 },
      { pose: make(182, [138, 132], 198), cue: "Pull toes toward you, hold", hold: 3 },
    ],
  };
}

function seatedAnklePumpDemo(): Demo {
  const cx = 110;
  const make = (foot: number) =>
    fig(
      seated(cx, {
        nearLeg: { to: [cx + 66, LIE], bend: [0, -1], foot },
        farLeg: { to: [cx + 34, ANK], bend: [0.3, -1], foot: 90 },
      }),
    );
  return {
    view: "side",
    props: [{ type: "chair", x: cx }],
    tempo: 1.4,
    frames: [
      { pose: make(198), cue: "Pull your toes up", hold: 0.4 },
      { pose: make(118), cue: "Point your toes away", hold: 0.4 },
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Library                                                             */
/* ------------------------------------------------------------------ */

const STOP = "Stop if you feel sharp or increasing pain, numbness or tingling, and let your physio know.";

export const EXERCISES: ExerciseSeed[] = [
  /* Neck ------------------------------------------------------------ */
  {
    slug: "chin-tuck",
    name: "Chin Tuck",
    summary: "A small movement that draws your head back over your shoulders to wake up the deep muscles at the front of the neck.",
    bodyAreas: ["neck"],
    movementPatterns: ["retraction", "cervical flexion"],
    categories: ["control", "mobility"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 55,
    instructions: [
      "Sit tall in a chair with your feet flat and eyes looking straight ahead.",
      "Gently glide your chin straight back, as if making a double chin.",
      "Hold for 3 seconds without tipping your head down.",
      "Relax back to the start and repeat.",
    ],
    formCues: ["Keep your eyes level the whole time", "Think 'back', not 'down'", "Shoulders stay relaxed"],
    feel: "A light working feeling at the front of the neck and a gentle stretch at the base of the skull.",
    commonMistakes: ["Nodding the head down instead of gliding it back", "Pushing too hard and straining"],
    safetyNotes: STOP,
    tags: ["posture", "desk", "neck", "forward head", "text neck", "deep neck flexors", "headache"],
    progressions: [],
    regressions: [],
    demo: chinTuckDemo(),
  },
  {
    slug: "cervical-rotation",
    name: "Cervical Rotation",
    summary: "Slowly turning your head side to side to keep the neck moving comfortably.",
    bodyAreas: ["neck"],
    movementPatterns: ["rotation"],
    categories: ["mobility"],
    equipment: ["none"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 8 },
    secondsPerSet: 50,
    instructions: [
      "Sit or stand tall with your shoulders relaxed.",
      "Slowly turn your head to look over one shoulder.",
      "Pause for 2 seconds where you feel a gentle stretch.",
      "Turn back through the middle and repeat to the other side.",
    ],
    formCues: ["Keep your chin level as you turn", "Move slowly through the range", "Let your shoulders stay still"],
    feel: "An easy stretch along the side of the neck — not pain.",
    commonMistakes: ["Turning the shoulders along with the head", "Forcing the end of the range"],
    safetyNotes: "Move within a comfortable range. Stop if you feel dizzy, sharp pain, numbness or tingling, and let your physio know.",
    tags: ["neck", "stiff neck", "turning", "range of motion", "desk", "driving"],
    progressions: [],
    regressions: [],
    demo: cervicalRotationDemo(),
  },
  {
    slug: "levator-scapulae-stretch",
    name: "Levator Scapulae Stretch",
    summary: "A gentle stretch for the muscle that runs from the side of the neck to the top of the shoulder blade.",
    bodyAreas: ["neck", "upper-back"],
    movementPatterns: ["cervical flexion", "rotation", "stretch"],
    categories: ["stretch"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Sit tall and hold the edge of the seat with the hand on the side you are stretching.",
      "Turn your head about halfway toward the opposite side.",
      "Tip your head down, as if looking toward your opposite armpit.",
      "Rest your other hand on the back of your head and let its weight add a light stretch.",
      "Hold, then slowly lift your head back up.",
    ],
    formCues: ["Keep the stretching shoulder heavy and low", "Let your hand rest, don't pull", "Breathe slowly through the hold"],
    feel: "A gentle stretch from the back of the neck down toward the shoulder blade.",
    commonMistakes: ["Pulling hard on the head", "Letting the shoulder creep up toward the ear"],
    safetyNotes: STOP,
    tags: ["neck", "shoulder blade", "tension", "desk", "stiff neck", "upper back", "levator"],
    progressions: [],
    regressions: [],
    demo: levatorDemo(),
  },
  {
    slug: "upper-trapezius-stretch",
    name: "Upper Trapezius Stretch",
    summary: "A side-of-the-neck stretch that eases tension across the top of the shoulders.",
    bodyAreas: ["neck", "shoulder"],
    movementPatterns: ["lateral flexion", "stretch"],
    categories: ["stretch"],
    equipment: ["none"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Sit or stand tall with your arms relaxed.",
      "Tip your ear toward one shoulder, keeping your face pointing forward.",
      "Rest that side's hand over the top of your head for a little extra stretch.",
      "Hold, then bring your head slowly back to the middle.",
    ],
    formCues: ["Reach the opposite shoulder gently toward the floor", "Ear moves to shoulder, not shoulder to ear", "Let the hand rest without pulling"],
    feel: "A gentle stretch along the side of your neck — not pain.",
    commonMistakes: ["Turning the face down or to the side", "Hitching the stretching shoulder up"],
    safetyNotes: STOP,
    tags: ["neck", "traps", "tension", "desk", "stress", "headache", "shoulders"],
    progressions: [],
    regressions: [],
    demo: upperTrapDemo(),
  },

  /* Shoulder & upper back ------------------------------------------- */
  {
    slug: "wall-angels",
    name: "Wall Angels",
    summary: "Sliding your arms up and down a wall to improve upper-back posture and shoulder blade control.",
    bodyAreas: ["shoulder", "upper-back"],
    movementPatterns: ["scapular upward rotation", "thoracic extension", "overhead reach"],
    categories: ["mobility", "control"],
    equipment: ["wall"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 8 },
    secondsPerSet: 55,
    instructions: [
      "Stand with your back, head and bottom against a wall, feet a small step forward.",
      "Raise your arms into a goalpost shape with the backs of your hands toward the wall.",
      "Slowly slide your arms up as far as you can while keeping contact.",
      "Slide back down to the goalpost and repeat.",
    ],
    formCues: ["Keep your ribs down and lower back gently against the wall", "Move slowly through the range", "Only go as high as you can keep contact"],
    feel: "Muscles working between the shoulder blades and a stretch across the chest.",
    commonMistakes: ["Arching the lower back away from the wall", "Shrugging the shoulders up toward the ears"],
    safetyNotes: STOP,
    tags: ["posture", "desk", "shoulder blade", "thoracic", "upper back", "rounded shoulders", "overhead"],
    progressions: [],
    regressions: ["wall-slide"],
    demo: wallAngelsDemo(),
  },
  {
    slug: "band-external-rotation",
    name: "Band External Rotation",
    summary: "Turning the forearm outward against a band to strengthen the small muscles that steady the shoulder.",
    bodyAreas: ["shoulder"],
    movementPatterns: ["external rotation"],
    categories: ["strength"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 12, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Anchor a band at elbow height and stand side-on to it.",
      "Hold the band in the hand furthest from the anchor, elbow bent to 90° and tucked at your side.",
      "Rotate your forearm out, away from your body, keeping the elbow in place.",
      "Return slowly to the start and repeat.",
    ],
    formCues: ["Keep your elbow glued to your side", "Wrist stays straight", "Control the return — slower than the pull"],
    feel: "A working feeling at the back of the shoulder.",
    commonMistakes: ["Letting the elbow drift away from the body", "Twisting the trunk to help the arm"],
    safetyNotes: STOP,
    tags: ["rotator cuff", "shoulder", "infraspinatus", "throwing", "stability", "resistance band"],
    progressions: [],
    regressions: [],
    demo: bandExternalRotationDemo(),
  },
  {
    slug: "scapular-retraction",
    name: "Scapular Retraction",
    summary: "A band row that trains you to draw your shoulder blades back and together.",
    bodyAreas: ["upper-back", "shoulder"],
    movementPatterns: ["retraction", "horizontal pull", "row"],
    categories: ["strength", "control"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 12 },
    secondsPerSet: 50,
    instructions: [
      "Anchor a band at chest height and stand facing it, holding one end in each hand.",
      "Step back until the band is lightly taut with your arms straight.",
      "Draw your elbows back, squeezing your shoulder blades together.",
      "Hold for 2 seconds, then let your arms return slowly.",
    ],
    formCues: ["Shoulders down and away from your ears", "Lead with the shoulder blades, then the elbows", "Keep your chest tall without leaning back"],
    feel: "Muscles working between and around your shoulder blades.",
    commonMistakes: ["Shrugging as you pull", "Leaning the whole body back to move the band"],
    safetyNotes: STOP,
    tags: ["posture", "row", "rhomboids", "shoulder blade", "upper back", "desk", "rounded shoulders"],
    progressions: ["band-pull-apart"],
    regressions: [],
    demo: scapularRetractionDemo(),
  },
  {
    slug: "thoracic-rotation",
    name: "Thoracic Rotation",
    summary: "A hands-and-knees rotation that keeps the middle of your back turning freely.",
    bodyAreas: ["upper-back"],
    movementPatterns: ["rotation", "thoracic rotation"],
    categories: ["mobility"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 2, reps: 8, perSide: true },
    secondsPerSet: 50,
    instructions: [
      "Start on your hands and knees, hands under shoulders and knees under hips.",
      "Place one hand behind your head.",
      "Rotate that elbow down toward the opposite wrist.",
      "Then turn the other way, opening the elbow up toward the ceiling and following it with your eyes.",
      "Repeat slowly, then switch sides.",
    ],
    formCues: ["Turn through your upper back, not your hips", "Keep your weight even over both knees", "Breathe out as you open up"],
    feel: "A turning stretch through the middle of your back and across the chest.",
    commonMistakes: ["Shifting the hips to one side", "Rushing the movement"],
    safetyNotes: STOP,
    tags: ["thoracic", "mid back", "rotation", "stiffness", "open book", "upper back", "golf", "desk"],
    progressions: [],
    regressions: ["cat-cow"],
    demo: thoracicRotationDemo(),
  },
  {
    slug: "pendulum",
    name: "Pendulum Swing",
    summary: "Letting a relaxed arm swing gently while you lean on a support, to keep the shoulder moving without effort.",
    bodyAreas: ["shoulder"],
    movementPatterns: ["passive range of motion", "swing"],
    categories: ["mobility"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 2, durationSec: 30 },
    secondsPerSet: 45,
    instructions: [
      "Stand beside a sturdy chair or table and rest your other hand on it.",
      "Lean forward and let the arm you are working hang straight down, completely relaxed.",
      "Gently rock your body so the arm sways forward and back.",
      "Then let it draw small circles, both directions.",
    ],
    formCues: ["Let your body move the arm — the shoulder stays relaxed", "Keep the swings small and smooth", "Breathe easily"],
    feel: "A loose, easy movement with a gentle pull at the shoulder.",
    commonMistakes: ["Using the shoulder muscles to swing the arm", "Making the swings large and fast"],
    safetyNotes: STOP,
    tags: ["shoulder", "frozen shoulder", "post-op", "rotator cuff", "gentle", "codman"],
    progressions: ["wall-slide"],
    regressions: [],
    demo: pendulumDemo(),
  },
  {
    slug: "wall-slide",
    name: "Wall Slide",
    summary: "Sliding your forearms up a wall to gently build overhead shoulder movement.",
    bodyAreas: ["shoulder"],
    movementPatterns: ["flexion", "overhead reach", "scapular upward rotation"],
    categories: ["mobility", "control"],
    equipment: ["wall"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Stand facing a wall with your forearms resting on it, elbows at shoulder height.",
      "Slowly slide your forearms up the wall as far as is comfortable.",
      "Pause for 2 seconds at the top.",
      "Slide back down with control.",
    ],
    formCues: ["Keep your shoulders away from your ears", "Let the shoulder blades glide up with the arms", "Stay tall — don't lean into the wall"],
    feel: "A gentle stretch under the arms and light work around the shoulder blades.",
    commonMistakes: ["Shrugging as the arms rise", "Arching the lower back to reach higher"],
    safetyNotes: STOP,
    tags: ["shoulder", "overhead", "range of motion", "serratus", "post-op", "frozen shoulder"],
    progressions: ["wall-angels"],
    regressions: ["pendulum"],
    demo: wallSlideDemo(),
  },
  {
    slug: "doorway-pec-stretch",
    name: "Doorway Pec Stretch",
    summary: "Using a door frame to stretch the front of the chest and shoulder.",
    bodyAreas: ["shoulder", "upper-back"],
    movementPatterns: ["horizontal abduction", "stretch"],
    categories: ["stretch"],
    equipment: ["doorway"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Stand in a doorway and place your forearm on the frame, elbow at shoulder height.",
      "Step forward with the leg on the same side.",
      "Turn your chest slightly away until you feel a stretch across the front of the shoulder.",
      "Hold, then step back to release.",
    ],
    formCues: ["Keep your shoulder down and back", "Stand tall — don't let your head poke forward", "Ease in gently"],
    feel: "A comfortable stretch across the chest and front of the shoulder.",
    commonMistakes: ["Lunging too far into the stretch", "Letting the shoulder roll forward"],
    safetyNotes: STOP,
    tags: ["chest", "pecs", "posture", "rounded shoulders", "desk", "stretch"],
    progressions: [],
    regressions: [],
    demo: doorwayPecDemo(),
  },
  {
    slug: "band-pull-apart",
    name: "Band Pull-Apart",
    summary: "Pulling a band apart in front of your chest to strengthen the upper back and the back of the shoulders.",
    bodyAreas: ["upper-back", "shoulder"],
    movementPatterns: ["horizontal abduction", "retraction"],
    categories: ["strength"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 12 },
    secondsPerSet: 45,
    instructions: [
      "Stand tall holding a band in both hands at chest height, arms in front of you.",
      "Pull the band apart by moving your hands out to the sides.",
      "Squeeze your shoulder blades together at the end.",
      "Return slowly with control.",
    ],
    formCues: ["Keep your ribs down and back straight", "Arms nearly straight with soft elbows", "Shoulders stay low"],
    feel: "Muscles working across your upper back and the back of the shoulders.",
    commonMistakes: ["Shrugging the shoulders up", "Arching the lower back as the band stretches"],
    safetyNotes: STOP,
    tags: ["posture", "upper back", "rear delts", "shoulder blade", "rounded shoulders", "resistance band"],
    progressions: [],
    regressions: ["scapular-retraction"],
    demo: bandPullApartDemo(),
  },

  /* Spine & core ---------------------------------------------------- */
  {
    slug: "cat-cow",
    name: "Cat-Cow",
    summary: "Gently rounding and arching your back on hands and knees to move the whole spine.",
    bodyAreas: ["lower-back", "upper-back"],
    movementPatterns: ["flexion", "extension", "spinal segmental"],
    categories: ["mobility"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Start on your hands and knees, hands under shoulders and knees under hips.",
      "Round your back up toward the ceiling and let your head drop.",
      "Then let your back dip gently and lift your gaze forward.",
      "Move slowly between the two, breathing steadily.",
    ],
    formCues: ["Move one part of the spine at a time", "Keep your arms straight but not locked", "Breathe out as you round, in as you arch"],
    feel: "An easy, flowing movement through your back with no strain.",
    commonMistakes: ["Rushing between positions", "Bending the elbows instead of moving the spine"],
    safetyNotes: STOP,
    tags: ["back", "spine", "stiffness", "mobility", "low back", "morning", "warm-up"],
    progressions: ["thoracic-rotation", "bird-dog"],
    regressions: [],
    demo: catCowDemo(),
  },
  {
    slug: "pelvic-tilt",
    name: "Pelvic Tilt",
    summary: "A small rocking of the pelvis while lying down to gently move the lower back and switch on the deep tummy muscles.",
    bodyAreas: ["lower-back", "core"],
    movementPatterns: ["posterior pelvic tilt", "lumbar flexion"],
    categories: ["control", "mobility"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Lie on your back with knees bent and feet flat on the floor.",
      "Gently tighten your lower tummy and press your lower back toward the floor.",
      "Hold for 3 seconds, breathing normally.",
      "Relax back to the start and repeat.",
    ],
    formCues: ["Small movement — the pelvis rocks, the bottom stays down", "Keep breathing during the hold", "Relax your shoulders and neck"],
    feel: "A gentle tightening low in your tummy and a light stretch in the lower back.",
    commonMistakes: ["Holding your breath", "Lifting the bottom off the floor"],
    safetyNotes: STOP,
    tags: ["low back", "core", "pelvis", "back pain", "pregnancy", "beginner", "gentle"],
    progressions: ["glute-bridge", "dead-bug"],
    regressions: [],
    demo: pelvicTiltDemo(),
  },
  {
    slug: "prone-press-up",
    name: "Prone Press-Up",
    summary: "Lying face down and pressing your upper body up with your arms to gently move the lower back into extension.",
    bodyAreas: ["lower-back"],
    movementPatterns: ["extension", "lumbar extension"],
    categories: ["mobility"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 55,
    instructions: [
      "Lie face down with your hands flat on the floor under your shoulders.",
      "Press through your hands to lift your chest, keeping your hips on the floor.",
      "Go only as high as is comfortable and pause for 2 seconds.",
      "Lower slowly back down.",
    ],
    formCues: ["Let your lower back and bottom stay relaxed", "Hips stay in contact with the floor", "Breathe out as you press up"],
    feel: "A gentle stretch or pressure in the lower back that eases as you go.",
    commonMistakes: ["Lifting the hips off the floor", "Tensing the buttocks and back muscles"],
    safetyNotes: "Stop if pain spreads further into your leg, or if you feel sharp pain, numbness or tingling, and let your physio know.",
    tags: ["low back", "extension", "mckenzie", "back pain", "sitting", "press up"],
    progressions: [],
    regressions: [],
    demo: pronePressUpDemo(),
  },
  {
    slug: "dead-bug",
    name: "Dead Bug",
    summary: "Lowering opposite arm and leg while lying on your back to train the deep core to keep the trunk steady.",
    bodyAreas: ["core", "lower-back"],
    movementPatterns: ["anti-extension", "contralateral reach"],
    categories: ["stability", "control"],
    equipment: ["mat"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 8, perSide: true },
    secondsPerSet: 55,
    instructions: [
      "Lie on your back with arms reaching to the ceiling and knees bent over your hips.",
      "Gently press your lower back toward the floor.",
      "Slowly lower one arm overhead and straighten the opposite leg toward the floor.",
      "Return to the start and switch sides.",
    ],
    formCues: ["Lower back stays heavy on the floor", "Move slowly — only as far as you can control", "Breathe out as you reach"],
    feel: "Your tummy muscles working to keep your trunk still.",
    commonMistakes: ["Arching the lower back as the leg lowers", "Holding your breath"],
    safetyNotes: STOP,
    tags: ["core", "abs", "stability", "low back", "trunk control", "pilates"],
    progressions: ["side-plank-modified"],
    regressions: ["pelvic-tilt"],
    demo: deadBugDemo(),
  },
  {
    slug: "bird-dog",
    name: "Bird Dog",
    summary: "Reaching out with opposite arm and leg on hands and knees to build back and core control.",
    bodyAreas: ["core", "lower-back", "hip"],
    movementPatterns: ["anti-rotation", "anti-extension", "contralateral reach", "hip extension"],
    categories: ["stability", "control"],
    equipment: ["mat"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 8, perSide: true },
    secondsPerSet: 60,
    instructions: [
      "Start on your hands and knees with a flat back.",
      "Reach one arm forward and the opposite leg back until both are level with your body.",
      "Hold for 2 seconds without letting your back twist or sag.",
      "Return with control and switch sides.",
    ],
    formCues: ["Imagine a glass of water balanced on your lower back", "Reach long rather than high", "Keep your neck in line with your spine"],
    feel: "Muscles working along your back, bottom and tummy.",
    commonMistakes: ["Lifting the leg too high and arching the back", "Rotating the hips open"],
    safetyNotes: STOP,
    tags: ["core", "back", "stability", "glutes", "low back", "balance"],
    progressions: ["side-plank-modified"],
    regressions: ["cat-cow", "dead-bug"],
    demo: birdDogDemo(),
  },
  {
    slug: "pallof-press",
    name: "Pallof Press",
    summary: "Pressing a band straight out from your chest while resisting its sideways pull, to train the trunk not to twist.",
    bodyAreas: ["core"],
    movementPatterns: ["anti-rotation"],
    categories: ["stability", "strength"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 10, perSide: true },
    secondsPerSet: 50,
    instructions: [
      "Anchor a band at chest height and stand side-on to it, feet hip-width, knees soft.",
      "Hold the band with both hands at the middle of your chest.",
      "Press your hands straight out in front of you, without letting the band turn you.",
      "Hold for 2 seconds, bring your hands back to your chest, and repeat.",
    ],
    formCues: ["Hips and shoulders stay facing forward", "Keep your ribs down and tummy lightly braced", "Move slowly and steadily"],
    feel: "Your tummy and sides working to stop you rotating.",
    commonMistakes: ["Letting the band twist the shoulders", "Standing too close so there is no tension"],
    safetyNotes: STOP,
    tags: ["core", "anti-rotation", "obliques", "stability", "resistance band", "sport"],
    progressions: [],
    regressions: ["dead-bug"],
    demo: pallofPressDemo(),
  },
  {
    slug: "side-plank-modified",
    name: "Modified Side Plank",
    summary: "A side plank from your knees to strengthen the side of the trunk and hip.",
    bodyAreas: ["core", "hip"],
    movementPatterns: ["anti-lateral flexion", "hip abduction"],
    categories: ["stability", "strength"],
    equipment: ["mat"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 20, perSide: true },
    secondsPerSet: 40,
    instructions: [
      "Lie on your side with your elbow under your shoulder and knees bent behind you.",
      "Lift your hips so your body forms a straight line from knees to head.",
      "Hold, breathing normally.",
      "Lower your hips gently and rest before switching sides.",
    ],
    formCues: ["Elbow directly under the shoulder", "Push the floor away so you don't sink into the shoulder", "Hips stay stacked and forward"],
    feel: "Muscles working along the side of your trunk and hip.",
    commonMistakes: ["Letting the hips sag or drift back", "Holding your breath"],
    safetyNotes: STOP,
    tags: ["core", "obliques", "side plank", "hip", "glute med", "stability"],
    progressions: [],
    regressions: ["bird-dog"],
    demo: sidePlankDemo(),
  },

  /* Hip ------------------------------------------------------------- */
  {
    slug: "glute-bridge",
    name: "Glute Bridge",
    summary: "Lifting your hips off the floor while lying on your back to strengthen the buttocks and back of the thighs.",
    bodyAreas: ["hip", "lower-back", "core"],
    movementPatterns: ["hip extension", "bridge"],
    categories: ["strength"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 12 },
    secondsPerSet: 55,
    instructions: [
      "Lie on your back with knees bent, feet flat and hip-width apart, arms by your sides.",
      "Squeeze your buttocks and lift your hips until your body is in line from shoulders to knees.",
      "Hold for 2 seconds at the top.",
      "Lower slowly back to the floor.",
    ],
    formCues: ["Push through your heels", "Lift with your buttocks, not your lower back", "Keep your knees pointing forward"],
    feel: "Your buttocks and the backs of your thighs working.",
    commonMistakes: ["Arching the lower back at the top", "Letting the knees fall in or out"],
    safetyNotes: STOP,
    tags: ["glutes", "hip", "bridge", "low back", "posterior chain", "runner", "core"],
    progressions: ["hip-hinge"],
    regressions: ["pelvic-tilt"],
    demo: gluteBridgeDemo(),
  },
  {
    slug: "hip-flexor-stretch",
    name: "Half-Kneeling Hip Flexor Stretch",
    summary: "A kneeling stretch for the front of the hip, which often gets tight from sitting.",
    bodyAreas: ["hip", "lower-back"],
    movementPatterns: ["hip extension", "stretch"],
    categories: ["stretch"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Kneel on one knee on a mat with the other foot flat in front of you.",
      "Stand tall and gently tuck your pelvis under, as if flattening your lower back.",
      "Shift your weight forward slowly until you feel a stretch at the front of the back hip.",
      "Hold, then ease back.",
    ],
    formCues: ["Tuck the pelvis first, then shift", "Keep your trunk upright", "Squeeze the buttock on the kneeling side"],
    feel: "A stretch across the front of the hip and top of the thigh on the kneeling side.",
    commonMistakes: ["Arching the lower back instead of tucking the pelvis", "Lunging too far forward"],
    safetyNotes: "Use a cushion under your knee if kneeling is uncomfortable. " + STOP,
    tags: ["hip flexor", "psoas", "sitting", "desk", "tight hips", "runner", "low back"],
    progressions: [],
    regressions: [],
    demo: hipFlexorDemo(),
  },
  {
    slug: "clamshell",
    name: "Clamshell",
    summary: "Opening the top knee while lying on your side to strengthen the muscles on the outside of the hip.",
    bodyAreas: ["hip"],
    movementPatterns: ["hip external rotation", "hip abduction"],
    categories: ["strength"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 12, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Lie on your side with hips and knees bent and your feet together.",
      "Rest your head on your lower arm and keep your hips stacked.",
      "Keeping your feet touching, lift your top knee as far as you can without rolling back.",
      "Lower slowly and repeat.",
    ],
    formCues: ["Keep your top hip slightly forward — don't roll back", "Feet stay together", "Slow on the way down"],
    feel: "A working feeling deep in the side and back of the hip.",
    commonMistakes: ["Rolling the pelvis backward to lift higher", "Moving too quickly"],
    safetyNotes: STOP,
    tags: ["glute med", "hip", "clam", "knee", "runner", "pelvis", "outer hip"],
    progressions: ["side-lying-hip-abduction"],
    regressions: [],
    demo: clamshellDemo(),
  },
  {
    slug: "side-lying-hip-abduction",
    name: "Side-Lying Hip Abduction",
    summary: "Lifting your straight top leg while lying on your side to strengthen the outer hip.",
    bodyAreas: ["hip"],
    movementPatterns: ["hip abduction"],
    categories: ["strength"],
    equipment: ["mat"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 12, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Lie on your side with both legs straight and your head resting on your lower arm.",
      "Bend the bottom knee slightly if that feels steadier.",
      "Lift your top leg toward the ceiling, keeping it in line with your body and toes pointing forward.",
      "Lower slowly with control.",
    ],
    formCues: ["Lead with the heel, toes pointing forward", "Keep your hips stacked — don't roll back", "Lift only as high as you can without tilting"],
    feel: "Muscles working on the outside of your hip and bottom.",
    commonMistakes: ["Swinging the leg forward", "Rolling the hips back and turning the toes up"],
    safetyNotes: STOP,
    tags: ["glute med", "hip", "abduction", "outer hip", "runner", "knee", "balance"],
    progressions: ["lateral-band-walk"],
    regressions: ["clamshell"],
    demo: sideLyingAbductionDemo(),
  },
  {
    slug: "hip-hinge",
    name: "Hip Hinge",
    summary: "Bending forward from the hips with a straight back — the safe base for lifting and bending.",
    bodyAreas: ["hip", "lower-back"],
    movementPatterns: ["hinge"],
    categories: ["control", "strength"],
    equipment: ["none"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 10 },
    secondsPerSet: 45,
    instructions: [
      "Stand tall with feet hip-width apart and knees softly bent.",
      "Push your hips back as if closing a car door with your bottom.",
      "Let your chest tip forward while your back stays long and straight.",
      "Stop when you feel a stretch at the back of your thighs, then squeeze your buttocks to stand up.",
    ],
    formCues: ["Hips go back, not down", "Keep your back long from head to tailbone", "Knees stay soft but still"],
    feel: "A stretch at the back of the thighs, then your buttocks working as you stand.",
    commonMistakes: ["Rounding the back to reach lower", "Bending the knees into a squat"],
    safetyNotes: STOP,
    tags: ["hinge", "lifting", "deadlift", "hamstrings", "glutes", "low back", "posterior chain"],
    progressions: [],
    regressions: ["glute-bridge"],
    demo: hipHingeDemo(),
  },
  {
    slug: "lateral-band-walk",
    name: "Lateral Band Walk",
    summary: "Stepping sideways against a band to strengthen the outer hip muscles in standing.",
    bodyAreas: ["hip", "knee"],
    movementPatterns: ["hip abduction", "lateral step"],
    categories: ["strength", "stability"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 10, perSide: true },
    secondsPerSet: 50,
    instructions: [
      "Place a loop band around your ankles or just above your knees.",
      "Stand with feet hip-width apart and bend your knees slightly.",
      "Step sideways with one foot, then follow with the other, keeping tension in the band.",
      "Take all your steps one way, then come back the other way.",
    ],
    formCues: ["Stay low and level — no bobbing up and down", "Knees push gently outward", "Toes point forward"],
    feel: "A burning, working feeling on the outside of your hips.",
    commonMistakes: ["Letting the knees fall inward", "Swaying the trunk side to side"],
    safetyNotes: STOP,
    tags: ["glute med", "hip", "knee", "band walk", "monster walk", "runner", "ACL", "resistance band"],
    progressions: [],
    regressions: ["side-lying-hip-abduction"],
    demo: lateralBandWalkDemo(),
  },

  /* Knee ------------------------------------------------------------ */
  {
    slug: "quad-set",
    name: "Quad Set",
    summary: "Tightening the thigh muscle to press the back of your knee down, to switch the quadriceps back on.",
    bodyAreas: ["knee"],
    movementPatterns: ["isometric knee extension"],
    categories: ["strength", "control"],
    equipment: ["towel", "mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 10 },
    secondsPerSet: 70,
    instructions: [
      "Sit or lie with your leg straight and a small rolled towel under the knee.",
      "Tighten the muscle on the front of your thigh to press the back of your knee into the towel.",
      "Pull your toes up toward you as you do it.",
      "Hold for 5 seconds, then relax fully.",
    ],
    formCues: ["Watch the kneecap glide up as the thigh tightens", "Keep breathing during the hold", "Relax completely between reps"],
    feel: "A firm tightening along the front of your thigh.",
    commonMistakes: ["Lifting the heel instead of pressing the knee down", "Holding your breath"],
    safetyNotes: STOP,
    tags: ["quads", "knee", "post-op", "ACL", "knee replacement", "isometric", "VMO"],
    progressions: ["straight-leg-raise"],
    regressions: [],
    demo: quadSetDemo(),
  },
  {
    slug: "sit-to-stand",
    name: "Sit-to-Stand",
    summary: "Standing up from a chair and sitting back down with control to build leg strength for everyday life.",
    bodyAreas: ["knee", "hip"],
    movementPatterns: ["squat", "sit to stand"],
    categories: ["strength"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Sit near the front of a sturdy chair with your feet flat and slightly behind your knees.",
      "Cross your arms over your chest or rest them on your thighs.",
      "Lean forward and push through your feet to stand up tall.",
      "Slowly sit back down, reaching your bottom back to the chair.",
    ],
    formCues: ["Nose over toes as you rise", "Knees in line with your toes", "Sit down slowly — don't drop"],
    feel: "Your thighs and buttocks working.",
    commonMistakes: ["Letting the knees fall inward", "Dropping heavily into the chair"],
    safetyNotes: "Use a chair that won't slide, and use your hands to help if needed. " + STOP,
    tags: ["squat", "legs", "knee", "hip", "functional", "older adults", "strength", "quads"],
    progressions: ["mini-squat", "step-up"],
    regressions: [],
    demo: sitToStandDemo(),
  },
  {
    slug: "straight-leg-raise",
    name: "Straight Leg Raise",
    summary: "Lifting a straight leg while lying on your back to strengthen the thigh without bending the knee.",
    bodyAreas: ["knee", "hip"],
    movementPatterns: ["hip flexion", "isometric knee extension"],
    categories: ["strength"],
    equipment: ["mat"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Lie on your back with one knee bent and the other leg straight.",
      "Tighten the thigh of the straight leg so the knee is fully straight.",
      "Lift the straight leg to the height of the bent knee.",
      "Hold for 2 seconds, then lower slowly.",
    ],
    formCues: ["Keep the knee locked straight all the way up and down", "Lower back stays relaxed on the floor", "Slow on the way down"],
    feel: "The front of your thigh and hip working.",
    commonMistakes: ["Letting the knee bend as the leg lifts", "Lifting too high and arching the back"],
    safetyNotes: STOP,
    tags: ["quads", "knee", "post-op", "ACL", "knee replacement", "SLR", "hip flexor"],
    progressions: ["terminal-knee-extension"],
    regressions: ["quad-set"],
    demo: straightLegRaiseDemo(),
  },
  {
    slug: "heel-slide",
    name: "Heel Slide",
    summary: "Sliding your heel toward you while lying down to gently bend and straighten the knee.",
    bodyAreas: ["knee"],
    movementPatterns: ["knee flexion", "active range of motion"],
    categories: ["mobility"],
    equipment: ["mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 2, reps: 10 },
    secondsPerSet: 50,
    instructions: [
      "Lie on your back with both legs straight.",
      "Slowly slide the heel of one foot toward your bottom, bending the knee.",
      "Pause for 2 seconds where you feel a comfortable stretch.",
      "Slide the heel back out until the leg is straight.",
    ],
    formCues: ["Keep the heel in contact with the floor", "Move smoothly, no bouncing", "Let the knee point to the ceiling"],
    feel: "A gentle stretch or tightness at the front of the knee as it bends.",
    commonMistakes: ["Lifting the foot off the floor", "Forcing the knee past a comfortable stretch"],
    safetyNotes: STOP,
    tags: ["knee", "range of motion", "flexion", "post-op", "knee replacement", "ACL", "stiffness"],
    progressions: [],
    regressions: [],
    demo: heelSlideDemo(),
  },
  {
    slug: "terminal-knee-extension",
    name: "Terminal Knee Extension",
    summary: "Straightening the knee fully against a band behind it to strengthen the last few degrees of extension.",
    bodyAreas: ["knee"],
    movementPatterns: ["knee extension", "closed chain"],
    categories: ["strength", "control"],
    equipment: ["band"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 15 },
    secondsPerSet: 50,
    instructions: [
      "Anchor a loop band low in front of you and place it behind your knee.",
      "Step back until the band is taut, with your knee slightly bent.",
      "Straighten the knee fully by tightening your thigh, pushing back into the band.",
      "Hold for 2 seconds, then let the knee bend slightly again.",
    ],
    formCues: ["Keep your heel down throughout", "Squeeze the thigh to finish the movement", "Hips stay level and still"],
    feel: "The front of your thigh working hardest as the knee reaches straight.",
    commonMistakes: ["Leaning the trunk instead of straightening the knee", "Letting the heel lift"],
    safetyNotes: STOP,
    tags: ["knee", "quads", "TKE", "ACL", "post-op", "extension", "resistance band"],
    progressions: ["mini-squat"],
    regressions: ["quad-set"],
    demo: terminalKneeExtensionDemo(),
  },
  {
    slug: "step-up",
    name: "Step-Up",
    summary: "Stepping up onto a low step to build leg strength and control for stairs.",
    bodyAreas: ["knee", "hip"],
    movementPatterns: ["step up", "single leg", "squat"],
    categories: ["strength", "balance"],
    equipment: ["step"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, reps: 10, perSide: true },
    secondsPerSet: 50,
    instructions: [
      "Stand facing a low, stable step, with a rail or wall nearby for support.",
      "Place your whole foot on the step.",
      "Push through that heel to step up and stand tall.",
      "Step back down slowly with the other leg and repeat.",
    ],
    formCues: ["Knee tracks over the middle of the foot", "Push through the step leg — don't spring off the back foot", "Lower down slowly"],
    feel: "The thigh and buttock of the stepping leg working.",
    commonMistakes: ["Letting the knee fall inward", "Pushing off with the back foot"],
    safetyNotes: "Use a step that won't move and keep a hand on a rail or wall if needed. " + STOP,
    tags: ["stairs", "knee", "quads", "glutes", "single leg", "ACL", "functional"],
    progressions: [],
    regressions: ["sit-to-stand", "mini-squat"],
    demo: stepUpDemo(),
  },
  {
    slug: "wall-sit",
    name: "Wall Sit",
    summary: "Holding a partly seated position against a wall to build thigh strength and endurance.",
    bodyAreas: ["knee", "hip"],
    movementPatterns: ["squat", "isometric"],
    categories: ["strength"],
    equipment: ["wall"],
    difficulty: 2,
    lateralitySupported: false,
    defaultDosage: { sets: 3, durationSec: 30 },
    secondsPerSet: 45,
    instructions: [
      "Stand with your back against a wall and your feet about a foot's length out in front.",
      "Slide down the wall until your knees are bent to a comfortable depth.",
      "Hold the position, breathing normally.",
      "Slide back up the wall to finish.",
    ],
    formCues: ["Knees stay over your ankles, not past your toes", "Weight evenly through both feet", "Only go as low as feels comfortable"],
    feel: "A strong, building burn in your thighs.",
    commonMistakes: ["Sliding too low too soon", "Letting the knees drift together"],
    safetyNotes: STOP,
    tags: ["quads", "knee", "isometric", "squat", "endurance", "ski", "patellar tendon"],
    progressions: [],
    regressions: ["mini-squat"],
    demo: wallSitDemo(),
  },
  {
    slug: "mini-squat",
    name: "Mini Squat",
    summary: "A shallow squat to build leg strength while keeping knee movement comfortable.",
    bodyAreas: ["knee", "hip"],
    movementPatterns: ["squat"],
    categories: ["strength"],
    equipment: ["none"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 12 },
    secondsPerSet: 45,
    instructions: [
      "Stand with feet hip-width apart, holding onto something steady if you need to.",
      "Push your hips back and bend your knees a quarter of the way down.",
      "Keep your weight through your heels and the middle of your feet.",
      "Stand back up tall, squeezing your buttocks.",
    ],
    formCues: ["Knees in line with your second toe", "Chest up, back long", "Small range, smooth movement"],
    feel: "Your thighs and buttocks working.",
    commonMistakes: ["Knees falling inward", "Lifting the heels"],
    safetyNotes: STOP,
    tags: ["squat", "knee", "quads", "glutes", "functional", "ACL", "beginner"],
    progressions: ["wall-sit", "step-up"],
    regressions: ["sit-to-stand"],
    demo: miniSquatDemo(),
  },

  /* Ankle & foot ---------------------------------------------------- */
  {
    slug: "calf-raise",
    name: "Calf Raise",
    summary: "Rising up onto your toes to strengthen the calves and support the ankle.",
    bodyAreas: ["ankle"],
    movementPatterns: ["plantarflexion"],
    categories: ["strength"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 3, reps: 15 },
    secondsPerSet: 45,
    instructions: [
      "Stand tall with your feet hip-width apart, lightly holding a chair or wall.",
      "Rise up onto the balls of your feet as high as you comfortably can.",
      "Pause for a second at the top.",
      "Lower your heels slowly to the floor.",
    ],
    formCues: ["Weight through the big toe and second toe", "Straight up and down — don't sway forward", "Lower slower than you rise"],
    feel: "Your calf muscles working, with a building burn toward the end of the set.",
    commonMistakes: ["Rolling out onto the little toes", "Bouncing quickly through the reps"],
    safetyNotes: STOP,
    tags: ["calf", "ankle", "achilles", "runner", "heel raise", "balance", "sprain"],
    progressions: [],
    regressions: ["seated-ankle-pump"],
    demo: calfRaiseDemo(),
  },
  {
    slug: "ankle-dorsiflexion",
    name: "Knee-to-Wall Ankle Dorsiflexion",
    summary: "Driving your knee toward a wall with your heel down to improve how far your ankle bends.",
    bodyAreas: ["ankle"],
    movementPatterns: ["dorsiflexion", "lunge"],
    categories: ["mobility"],
    equipment: ["wall"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 2, reps: 10, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Stand facing a wall with one foot a few centimetres from it and the other foot behind.",
      "Keeping the front heel on the floor, bend the front knee toward the wall.",
      "Touch the wall with your knee if you can, then return.",
      "Move the foot further back as it gets easier.",
    ],
    formCues: ["Heel stays glued to the floor", "Knee travels over the second toe", "Hands on the wall for balance"],
    feel: "A stretch in the calf or at the front of the ankle.",
    commonMistakes: ["Letting the heel lift", "Letting the knee drift inward"],
    safetyNotes: STOP,
    tags: ["ankle", "calf", "dorsiflexion", "sprain", "squat depth", "runner", "knee to wall"],
    progressions: [],
    regressions: ["towel-calf-stretch"],
    demo: ankleDorsiflexionDemo(),
  },
  {
    slug: "single-leg-balance",
    name: "Single-Leg Balance",
    summary: "Standing on one leg to train balance and the small muscles that steady the ankle, knee and hip.",
    bodyAreas: ["ankle", "knee", "hip"],
    movementPatterns: ["single leg", "balance"],
    categories: ["balance", "stability"],
    equipment: ["chair"],
    difficulty: 2,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Stand next to a chair or counter you can hold if needed.",
      "Shift your weight onto one foot and lift the other foot off the floor.",
      "Stand tall and hold your balance, using the support only as needed.",
      "Lower the foot and switch sides.",
    ],
    formCues: ["Keep the standing knee soft, not locked", "Hips level — don't sink into one side", "Fix your eyes on a point ahead"],
    feel: "Small muscles in your foot, ankle and hip making constant tiny adjustments.",
    commonMistakes: ["Gripping the support the whole time", "Letting the hip drop on the lifted side"],
    safetyNotes: "Always have something sturdy within reach. " + STOP,
    tags: ["balance", "ankle", "proprioception", "falls", "sprain", "stability", "ACL", "older adults"],
    progressions: [],
    regressions: ["calf-raise"],
    demo: singleLegBalanceDemo(),
  },
  {
    slug: "towel-calf-stretch",
    name: "Towel Calf Stretch",
    summary: "Using a towel around your foot to gently stretch the calf while sitting.",
    bodyAreas: ["ankle"],
    movementPatterns: ["dorsiflexion", "stretch"],
    categories: ["stretch"],
    equipment: ["towel", "mat"],
    difficulty: 1,
    lateralitySupported: true,
    defaultDosage: { sets: 3, durationSec: 30, perSide: true },
    secondsPerSet: 45,
    instructions: [
      "Sit on the floor with the leg you are stretching straight out in front.",
      "Loop a towel around the ball of your foot and hold one end in each hand.",
      "Gently pull the towel to draw your toes toward you, keeping the knee straight.",
      "Hold, then relax.",
    ],
    formCues: ["Sit tall rather than slumping forward", "Keep the knee straight", "Pull gently and steadily — no bouncing"],
    feel: "A gentle stretch along the back of the lower leg.",
    commonMistakes: ["Bending the knee", "Yanking the towel"],
    safetyNotes: STOP,
    tags: ["calf", "achilles", "ankle", "stretch", "plantar fascia", "runner", "flexibility"],
    progressions: ["ankle-dorsiflexion"],
    regressions: ["seated-ankle-pump"],
    demo: towelCalfStretchDemo(),
  },
  {
    slug: "seated-ankle-pump",
    name: "Seated Ankle Pump",
    summary: "Pointing and flexing your foot while seated to keep the ankle moving and help circulation.",
    bodyAreas: ["ankle"],
    movementPatterns: ["dorsiflexion", "plantarflexion", "active range of motion"],
    categories: ["mobility"],
    equipment: ["chair"],
    difficulty: 1,
    lateralitySupported: false,
    defaultDosage: { sets: 2, reps: 20 },
    secondsPerSet: 45,
    instructions: [
      "Sit in a chair with one leg stretched out and the heel resting on the floor.",
      "Pull your toes up toward you as far as is comfortable.",
      "Then point your toes away from you.",
      "Keep a steady rhythm, then switch legs.",
    ],
    formCues: ["Move only at the ankle", "Use the full comfortable range", "Smooth and rhythmic"],
    feel: "A gentle stretch at the front and back of the ankle, and the calf working.",
    commonMistakes: ["Moving the whole leg instead of the ankle", "Rushing through small movements"],
    safetyNotes: STOP,
    tags: ["ankle", "circulation", "swelling", "post-op", "sprain", "gentle", "range of motion"],
    progressions: ["calf-raise", "towel-calf-stretch"],
    regressions: [],
    demo: seatedAnklePumpDemo(),
  },
];

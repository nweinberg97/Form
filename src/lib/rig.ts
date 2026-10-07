/**
 * FORM movement rig.
 *
 * Every exercise demonstration in FORM is described as data: a handful of
 * keyframe poses for a simple articulated figure. The same description drives
 * the in-app animated demonstration (no external video dependency), its
 * poster frame, and server-side rendering for previews.
 *
 * Angle convention (degrees, screen space, y grows downward):
 *   0   → segment points straight down
 *   90  → points right
 *   180 → points straight up
 *   -90 → points left
 * Every segment angle is absolute, not relative to its parent.
 */

export const RIG = {
  width: 320,
  height: 200,
  floorY: 184,
  torso: 54,
  neck: 6,
  headOffset: 13,
  headRadius: 10,
  upperArm: 31,
  forearm: 29,
  thigh: 44,
  shin: 42,
  foot: 13,
  /** Half-width of the shoulders/hips when seen from the front. */
  shoulderHalf: 13,
  hipHalf: 8,
} as const;

/** Pelvis height when standing tall on the floor. */
export const STAND_Y = RIG.floorY - RIG.thigh - RIG.shin - 3;

export type Pose = {
  /** Pelvis position in the 320×200 viewBox. */
  root: [number, number];
  torso: number;
  head: number;
  /** [upper arm, forearm] */
  nearArm: [number, number];
  farArm: [number, number];
  /** [thigh, shin, foot] */
  nearLeg: [number, number, number];
  farLeg: [number, number, number];
};

export type RigProp =
  | { type: "wall"; x: number }
  | { type: "chair"; x: number; facing?: "left" | "right" }
  | { type: "mat"; x1?: number; x2?: number }
  | { type: "step"; x: number; w: number; h: number }
  | { type: "doorway"; x: number }
  | {
      type: "band";
      /** Fixed anchor point in the viewBox. */
      anchor: [number, number];
      /** Which hand or foot holds the other end. */
      to: "nearHand" | "farHand" | "nearFoot" | "farFoot" | "bothHands";
    }
  | { type: "towel"; to: "nearFoot" | "farFoot" };

export type Keyframe = {
  pose: Pose;
  /** Seconds to hold this pose before moving to the next. */
  hold?: number;
  /** Short caption shown while moving toward/holding this pose. */
  cue?: string;
};

export type Demo = {
  view: "side" | "front";
  props?: RigProp[];
  /** At least two frames. The animation loops back to the first frame. */
  frames: Keyframe[];
  /** Seconds to travel between frames (default 1.6). */
  tempo?: number;
};

export type Point = { x: number; y: number };

export type Skeleton = {
  pelvis: Point;
  neck: Point;
  head: Point;
  nearShoulder: Point;
  farShoulder: Point;
  nearHip: Point;
  farHip: Point;
  nearElbow: Point;
  nearHand: Point;
  farElbow: Point;
  farHand: Point;
  nearKnee: Point;
  nearAnkle: Point;
  nearToe: Point;
  farKnee: Point;
  farAnkle: Point;
  farToe: Point;
};

const rad = (deg: number) => (deg * Math.PI) / 180;

function step(from: Point, angle: number, length: number): Point {
  return {
    x: from.x + Math.sin(rad(angle)) * length,
    y: from.y + Math.cos(rad(angle)) * length,
  };
}

export function solve(pose: Pose, view: Demo["view"]): Skeleton {
  const pelvis = { x: pose.root[0], y: pose.root[1] };
  const neck = step(pelvis, pose.torso, RIG.torso);
  const headBase = step(neck, pose.head, RIG.neck);
  const head = step(headBase, pose.head, RIG.headOffset - RIG.neck);

  // Lateral offset is perpendicular to the spine; only visible from the front.
  const perp = pose.torso - 90;
  const sh = view === "front" ? RIG.shoulderHalf : 0;
  const hp = view === "front" ? RIG.hipHalf : 0;
  const shoulderBase = step(neck, pose.torso + 180, 4);
  const nearShoulder = step(shoulderBase, perp, -sh);
  const farShoulder = step(shoulderBase, perp, sh);
  const nearHip = step(pelvis, perp, -hp);
  const farHip = step(pelvis, perp, hp);

  const nearElbow = step(nearShoulder, pose.nearArm[0], RIG.upperArm);
  const nearHand = step(nearElbow, pose.nearArm[1], RIG.forearm);
  const farElbow = step(farShoulder, pose.farArm[0], RIG.upperArm);
  const farHand = step(farElbow, pose.farArm[1], RIG.forearm);

  const nearKnee = step(nearHip, pose.nearLeg[0], RIG.thigh);
  const nearAnkle = step(nearKnee, pose.nearLeg[1], RIG.shin);
  const nearToe = step(nearAnkle, pose.nearLeg[2], RIG.foot);
  const farKnee = step(farHip, pose.farLeg[0], RIG.thigh);
  const farAnkle = step(farKnee, pose.farLeg[1], RIG.shin);
  const farToe = step(farAnkle, pose.farLeg[2], RIG.foot);

  return {
    pelvis,
    neck,
    head,
    nearShoulder,
    farShoulder,
    nearHip,
    farHip,
    nearElbow,
    nearHand,
    farElbow,
    farHand,
    nearKnee,
    nearAnkle,
    nearToe,
    farKnee,
    farAnkle,
    farToe,
  };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const lerpTuple = <T extends number[]>(a: T, b: T, t: number) =>
  a.map((v, i) => lerp(v, b[i], t)) as T;

export function interpolate(a: Pose, b: Pose, t: number): Pose {
  return {
    root: lerpTuple(a.root, b.root, t),
    torso: lerp(a.torso, b.torso, t),
    head: lerp(a.head, b.head, t),
    nearArm: lerpTuple(a.nearArm, b.nearArm, t),
    farArm: lerpTuple(a.farArm, b.farArm, t),
    nearLeg: lerpTuple(a.nearLeg, b.nearLeg, t),
    farLeg: lerpTuple(a.farLeg, b.farLeg, t),
  };
}

/** Smooth, controlled acceleration — "controlled movement". */
export const ease = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

export type Timeline = {
  duration: number;
  /** Pose and active cue at time `time` (seconds, wraps). */
  at: (time: number) => { pose: Pose; cue?: string; frameIndex: number };
};

export function timeline(demo: Demo): Timeline {
  const tempo = demo.tempo ?? 1.6;
  const segments = demo.frames.map((frame, i) => ({
    frame,
    next: demo.frames[(i + 1) % demo.frames.length],
    hold: frame.hold ?? 0.6,
    index: i,
  }));
  const duration = segments.reduce((sum, s) => sum + s.hold + tempo, 0);

  return {
    duration,
    at(time: number) {
      let t = ((time % duration) + duration) % duration;
      for (const s of segments) {
        if (t < s.hold) {
          return { pose: s.frame.pose, cue: s.frame.cue, frameIndex: s.index };
        }
        t -= s.hold;
        if (t < tempo) {
          const p = ease(t / tempo);
          return {
            pose: interpolate(s.frame.pose, s.next.pose, p),
            cue: p > 0.5 ? s.next.cue : s.frame.cue,
            frameIndex: p > 0.5 ? (s.index + 1) % segments.length : s.index,
          };
        }
        t -= tempo;
      }
      return { pose: demo.frames[0].pose, cue: demo.frames[0].cue, frameIndex: 0 };
    },
  };
}

/* ------------------------------------------------------------------ */
/* SVG rendering (string based, so it works on the server and client). */
/* ------------------------------------------------------------------ */

type RenderOptions = {
  ink?: string;
  muted?: string;
  accent?: string;
  ground?: string;
  /** Optional faint ghost pose (the movement trail). */
  ghost?: Pose;
  /** Hide the figure's ghost/props labels for tiny thumbnails. */
  compact?: boolean;
};

const f = (n: number) => Math.round(n * 10) / 10;

function line(a: Point, b: Point, stroke: string, width: number, opacity = 1) {
  return `<line x1="${f(a.x)}" y1="${f(a.y)}" x2="${f(b.x)}" y2="${f(b.y)}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"/>`;
}

function polyline(points: Point[], stroke: string, width: number, opacity = 1) {
  const d = points.map((p) => `${f(p.x)},${f(p.y)}`).join(" ");
  return `<polyline points="${d}" fill="none" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round" opacity="${opacity}"/>`;
}

function figure(s: Skeleton, view: Demo["view"], ink: string, opacity = 1, width = 9) {
  const farOpacity = view === "side" ? 0.32 : 1;
  const parts: string[] = [];
  // Far limbs first (behind the body).
  parts.push(polyline([s.farHip, s.farKnee, s.farAnkle, s.farToe], ink, width, opacity * farOpacity));
  parts.push(polyline([s.farShoulder, s.farElbow, s.farHand], ink, width * 0.86, opacity * farOpacity));
  // Body.
  if (view === "front") {
    parts.push(line(s.nearShoulder, s.farShoulder, ink, width, opacity));
    parts.push(line(s.nearHip, s.farHip, ink, width, opacity));
  }
  parts.push(line(s.pelvis, s.neck, ink, width * 1.25, opacity));
  parts.push(`<circle cx="${f(s.head.x)}" cy="${f(s.head.y)}" r="${RIG.headRadius}" fill="${ink}" opacity="${opacity}"/>`);
  // Near limbs.
  parts.push(polyline([s.nearHip, s.nearKnee, s.nearAnkle, s.nearToe], ink, width, opacity));
  parts.push(polyline([s.nearShoulder, s.nearElbow, s.nearHand], ink, width * 0.86, opacity));
  return parts.join("");
}

function point(s: Skeleton, key: Extract<RigProp, { type: "band" }>["to"] | "nearFoot" | "farFoot"): Point[] {
  switch (key) {
    case "nearHand":
      return [s.nearHand];
    case "farHand":
      return [s.farHand];
    case "bothHands":
      return [s.nearHand, s.farHand];
    case "nearFoot":
      return [s.nearToe];
    case "farFoot":
      return [s.farToe];
  }
}

function propsBehind(props: RigProp[], muted: string, ground: string) {
  const out: string[] = [];
  for (const p of props) {
    switch (p.type) {
      case "wall":
        out.push(`<rect x="${p.x}" y="20" width="6" height="${RIG.floorY - 20}" fill="${muted}" opacity="0.5"/>`);
        break;
      case "doorway":
        out.push(`<rect x="${p.x - 3}" y="16" width="6" height="${RIG.floorY - 16}" fill="${muted}" opacity="0.55"/>`);
        break;
      case "chair": {
        const dir = p.facing === "left" ? -1 : 1;
        const seatY = RIG.floorY - 46;
        const backX = p.x - dir * 22;
        out.push(`<line x1="${p.x - 22}" y1="${seatY}" x2="${p.x + 22}" y2="${seatY}" stroke="${muted}" stroke-width="6" stroke-linecap="round"/>`);
        out.push(`<line x1="${backX}" y1="${seatY}" x2="${backX}" y2="${seatY - 48}" stroke="${muted}" stroke-width="6" stroke-linecap="round"/>`);
        out.push(`<line x1="${p.x - 18}" y1="${seatY}" x2="${p.x - 18}" y2="${RIG.floorY}" stroke="${muted}" stroke-width="4" stroke-linecap="round"/>`);
        out.push(`<line x1="${p.x + 18}" y1="${seatY}" x2="${p.x + 18}" y2="${RIG.floorY}" stroke="${muted}" stroke-width="4" stroke-linecap="round"/>`);
        break;
      }
      case "mat":
        out.push(`<rect x="${p.x1 ?? 40}" y="${RIG.floorY - 3}" width="${(p.x2 ?? 280) - (p.x1 ?? 40)}" height="5" rx="2" fill="${ground}"/>`);
        break;
      case "step":
        out.push(`<rect x="${p.x}" y="${RIG.floorY - p.h}" width="${p.w}" height="${p.h}" rx="3" fill="${muted}" opacity="0.55"/>`);
        break;
      default:
        break;
    }
  }
  return out.join("");
}

function propsFront(props: RigProp[], s: Skeleton, accent: string) {
  const out: string[] = [];
  for (const p of props) {
    if (p.type === "band") {
      for (const end of point(s, p.to)) {
        out.push(
          `<line x1="${p.anchor[0]}" y1="${p.anchor[1]}" x2="${f(end.x)}" y2="${f(end.y)}" stroke="${accent}" stroke-width="3" stroke-linecap="round"/>`,
        );
      }
      out.push(`<circle cx="${p.anchor[0]}" cy="${p.anchor[1]}" r="3.5" fill="${accent}"/>`);
    }
    if (p.type === "towel") {
      const foot = point(s, p.to)[0];
      out.push(polyline([s.nearHand, foot, s.farHand], accent, 3, 1));
    }
  }
  return out.join("");
}

export function renderSvgInner(demo: Demo, pose: Pose, options: RenderOptions = {}) {
  const ink = options.ink ?? "#111111";
  const muted = options.muted ?? "#B9B4AA";
  const accent = options.accent ?? "#FF4D2E";
  const ground = options.ground ?? "#D9D5CC";
  const props = demo.props ?? [];
  const s = solve(pose, demo.view);
  const parts: string[] = [];
  parts.push(`<line x1="16" y1="${RIG.floorY + 1.5}" x2="${RIG.width - 16}" y2="${RIG.floorY + 1.5}" stroke="${ground}" stroke-width="3" stroke-linecap="round"/>`);
  parts.push(propsBehind(props, muted, ground));
  if (options.ghost) {
    parts.push(figure(solve(options.ghost, demo.view), demo.view, ink, 0.12, 9));
  }
  parts.push(figure(s, demo.view, ink));
  parts.push(propsFront(props, s, accent));
  return parts.join("");
}

export function renderSvg(demo: Demo, pose: Pose, options: RenderOptions = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${RIG.width} ${RIG.height}">${renderSvgInner(demo, pose, options)}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Pose helpers for authoring.                                         */
/* ------------------------------------------------------------------ */

/** Standing tall, facing right (side view) or the viewer (front view). */
export const standing = (x = 160): Pose => ({
  root: [x, STAND_Y],
  torso: 180,
  head: 180,
  nearArm: [8, 4],
  farArm: [-6, -4],
  nearLeg: [2, 0, 90],
  farLeg: [-2, 0, 90],
});

export const standingFront = (x = 160): Pose => ({
  root: [x, STAND_Y],
  torso: 180,
  head: 180,
  nearArm: [-8, -4],
  farArm: [8, 4],
  nearLeg: [-4, 0, -90],
  farLeg: [4, 0, 90],
});

export const pose = (base: Pose, patch: Partial<Pose>): Pose => ({ ...base, ...patch });

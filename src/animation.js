// Pose = flat object of joint values (radians; grip 0..1).
const D = Math.PI / 180;

export const REST = {
  headYaw: 0, headPitch: 0, headRoll: 0,
  waistYaw: 0, waistPitch: 0, waistRoll: 0,
  lShPitch: 0.02, lShRoll: 0.09, lShYaw: 0, lElbow: 0.2, lWrist: 0, lWristTwist: 0, lGrip: 0.22,
  rShPitch: 0.02, rShRoll: 0.09, rShYaw: 0, rElbow: 0.2, rWrist: 0, rWristTwist: 0, rGrip: 0.22,
  lHip: 0, lHipRoll: 0.015, lKnee: 0.03, lAnkle: 0, lToe: 0,
  rHip: 0, rHipRoll: 0.015, rKnee: 0.03, rAnkle: 0, rToe: 0,
  rootX: 0, rootY: 0, rootZ: 0, rootYaw: 0, rootRoll: 0,
};
export const POSE_KEYS = Object.keys(REST);

// Slider definitions (displayed in degrees / %)
export const JOINTS = [
  { group: 'Head', key: 'headYaw', label: 'Yaw', min: -70, max: 70 },
  { group: 'Head', key: 'headPitch', label: 'Pitch', min: -30, max: 35 },
  { group: 'Torso', key: 'waistYaw', label: 'Twist', min: -50, max: 50 },
  { group: 'Torso', key: 'waistPitch', label: 'Bend', min: -10, max: 40 },
  { group: 'Left arm', key: 'lShPitch', label: 'Shoulder pitch', min: -60, max: 180 },
  { group: 'Left arm', key: 'lShRoll', label: 'Shoulder raise', min: -5, max: 170 },
  { group: 'Left arm', key: 'lShYaw', label: 'Arm twist', min: -90, max: 90 },
  { group: 'Left arm', key: 'lElbow', label: 'Elbow', min: 0, max: 145 },
  { group: 'Left arm', key: 'lWrist', label: 'Wrist', min: -60, max: 60 },
  { group: 'Left arm', key: 'lWristTwist', label: 'Wrist twist', min: -90, max: 90 },
  { group: 'Left arm', key: 'lGrip', label: 'Grip', min: 0, max: 100, pct: true },
  { group: 'Right arm', key: 'rShPitch', label: 'Shoulder pitch', min: -60, max: 180 },
  { group: 'Right arm', key: 'rShRoll', label: 'Shoulder raise', min: -5, max: 170 },
  { group: 'Right arm', key: 'rShYaw', label: 'Arm twist', min: -90, max: 90 },
  { group: 'Right arm', key: 'rElbow', label: 'Elbow', min: 0, max: 145 },
  { group: 'Right arm', key: 'rWrist', label: 'Wrist', min: -60, max: 60 },
  { group: 'Right arm', key: 'rWristTwist', label: 'Wrist twist', min: -90, max: 90 },
  { group: 'Right arm', key: 'rGrip', label: 'Grip', min: 0, max: 100, pct: true },
  { group: 'Left leg', key: 'lHip', label: 'Hip', min: -40, max: 110 },
  { group: 'Left leg', key: 'lHipRoll', label: 'Hip out', min: -5, max: 35 },
  { group: 'Left leg', key: 'lKnee', label: 'Knee', min: 0, max: 140 },
  { group: 'Left leg', key: 'lAnkle', label: 'Ankle', min: -30, max: 30 },
  { group: 'Right leg', key: 'rHip', label: 'Hip', min: -40, max: 110 },
  { group: 'Right leg', key: 'rHipRoll', label: 'Hip out', min: -5, max: 35 },
  { group: 'Right leg', key: 'rKnee', label: 'Knee', min: 0, max: 140 },
  { group: 'Right leg', key: 'rAnkle', label: 'Ankle', min: -30, max: 30 },
];
export const toUi = (j, v) => (j.pct ? v * 100 : v / D);
export const fromUi = (j, v) => (j.pct ? v / 100 : v * D);

const S = Math.sin, C = Math.cos;
const pos = (x) => Math.max(0, x);
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export const PRESETS = {
  idle: {
    label: 'Idle', icon: 'M4 12h3l2-5 3 10 2-5h6',
    fn(t) {
      const p = { ...REST };
      const b = S(t * 1.5);
      p.waistPitch = 0.01 + b * 0.012;
      p.headYaw = S(t * 0.37) * 0.22 + S(t * 0.11) * 0.1;
      p.headPitch = 0.04 + S(t * 0.5) * 0.04;
      p.lShRoll = 0.1 + b * 0.012; p.rShRoll = 0.1 + b * 0.012;
      p.lShPitch = 0.03 + S(t * 0.7) * 0.02; p.rShPitch = 0.03 + S(t * 0.7 + 1) * 0.02;
      p.lElbow = 0.22 + b * 0.02; p.rElbow = 0.22 - b * 0.02;
      p.lGrip = 0.25 + S(t * 0.9) * 0.05; p.rGrip = 0.25 + S(t * 0.8 + 2) * 0.05;
      p.waistYaw = S(t * 0.23) * 0.04;
      p.rootRoll = S(t * 0.4) * 0.006;
      return p;
    },
  },
  wave: {
    label: 'Wave', icon: 'M7 11V6a1.5 1.5 0 0 1 3 0v5m0-6a1.5 1.5 0 0 1 3 0v6m0-5a1.5 1.5 0 0 1 3 0v6m0-3a1.5 1.5 0 0 1 3 0v4a7 7 0 0 1-14 1l-1-4',
    fn(t) {
      const p = PRESETS.idle.fn(t);
      p.rShPitch = 0.55; p.rShRoll = 1.05; p.rElbow = 1.75;
      p.rShYaw = 1.15 + S(t * 7.5) * 0.38;
      p.rWrist = S(t * 7.5 - 0.6) * 0.18;
      p.rGrip = 0.04;
      p.headYaw = -0.18 + S(t * 0.6) * 0.04; p.headPitch = -0.04; p.headRoll = -0.06;
      p.waistRoll = 0.03; p.waistYaw = -0.06;
      p.lShRoll = 0.12;
      return p;
    },
  },
  walk: {
    label: 'Walk', icon: 'M13 4a1.5 1.5 0 1 0 0 .01M10 21l2-6 2 2v4M8 12l2-4 4 1 2 3M12 15l-3-3',
    fn(t) {
      const p = { ...REST };
      const ph = t * Math.PI * 2 * 0.85;
      const sp = S(ph), cp = C(ph);
      p.lHip = 0.42 * sp - 0.02; p.rHip = -0.42 * sp - 0.02;
      p.lKnee = 0.08 + 0.95 * Math.pow(pos(cp), 1.6) + 0.12 * pos(-sp);
      p.rKnee = 0.08 + 0.95 * Math.pow(pos(-cp), 1.6) + 0.12 * pos(sp);
      p.lAnkle = -0.18 * sp + 0.1 * pos(cp); p.rAnkle = 0.18 * sp + 0.1 * pos(-cp);
      p.lToe = 0.35 * pos(-sp) * pos(-cp); p.rToe = 0.35 * pos(sp) * pos(cp);
      p.lShPitch = -0.38 * sp; p.rShPitch = 0.38 * sp;
      p.lElbow = 0.35 + 0.25 * pos(-sp); p.rElbow = 0.35 + 0.25 * pos(sp);
      p.lShRoll = p.rShRoll = 0.1;
      p.waistYaw = 0.09 * sp; p.waistPitch = 0.05;
      p.headYaw = -0.06 * sp; p.headPitch = 0.05;
      p.rootRoll = 0.025 * S(ph);
      p.rootX = 0.012 * S(ph);
      p.lGrip = p.rGrip = 0.32;
      return p;
    },
  },
  grip: {
    label: 'Egg grip', icon: 'M12 3c3.5 0 6 5.5 6 9.5A6 6 0 0 1 6 12.5C6 8.5 8.5 3 12 3z',
    fn(t) {
      const p = PRESETS.idle.fn(t);
      const cyc = (t % 6) / 6;
      const close = smooth(0.08, 0.3, cyc) - smooth(0.72, 0.92, cyc);
      p.rShPitch = 0.45 + S(t * 0.8) * 0.03; p.rShRoll = 0.12; p.rShYaw = 0.05;
      p.rElbow = 1.3; p.rWrist = -0.1 + close * 0.08; p.rWristTwist = 1.35;
      p.rGrip = 0.06 + close * 0.34;
      p.headPitch = 0.32; p.headYaw = -0.16;
      p.waistPitch = 0.05; p.waistYaw = -0.08;
      p.lShRoll = 0.13; p.lElbow = 0.3;
      return p;
    },
  },
  dance: {
    label: 'Dance', icon: 'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
    fn(t) {
      const p = { ...REST };
      const bt = t * Math.PI * 2 * 1.05;
      const sb = S(bt), hb = S(bt / 2), ab = Math.abs(S(bt));
      const bounce = 0.18 + 0.16 * ab;
      p.lHip = bounce + 0.08 * hb; p.rHip = bounce - 0.08 * hb;
      p.lKnee = bounce * 2 + 0.1 * pos(hb); p.rKnee = bounce * 2 + 0.1 * pos(-hb);
      p.lHipRoll = 0.08 + 0.05 * hb; p.rHipRoll = 0.08 - 0.05 * hb;
      p.rootX = 0.035 * hb; p.rootRoll = -0.05 * hb;
      p.waistYaw = 0.35 * S(bt / 2); p.waistRoll = 0.07 * hb; p.waistPitch = 0.06;
      p.lShPitch = 0.7 + 0.75 * sb; p.rShPitch = 0.7 - 0.75 * sb;
      p.lShRoll = 0.45 + 0.25 * pos(hb); p.rShRoll = 0.45 + 0.25 * pos(-hb);
      p.lElbow = 1.3 + 0.3 * sb; p.rElbow = 1.3 - 0.3 * sb;
      p.lShYaw = -0.3; p.rShYaw = -0.3;
      p.lWrist = 0.3 * sb; p.rWrist = -0.3 * sb;
      p.lGrip = p.rGrip = 0.55;
      p.headPitch = -0.05 + 0.1 * S(bt * 2); p.headYaw = -0.25 * S(bt / 2); p.headRoll = 0.1 * hb;
      return p;
    },
  },
};

export function lerpPose(a, b, t, out = {}) {
  for (const k of POSE_KEYS) out[k] = a[k] + (b[k] - a[k]) * t;
  return out;
}

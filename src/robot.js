import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ *
 *  Procedural Optimus-style humanoid.
 *  Units are metres. The robot faces +Z; its left side is +X.
 *  Every body segment is a Group used as a joint pivot so the model
 *  can be posed / animated with simple Euler rotations.
 * ------------------------------------------------------------------ */

export const DIM = {
  pelvisY: 0.95,
  thigh: 0.42,
  shin: 0.4,
  upperArm: 0.28,
  forearm: 0.255,
};

// ---------- materials -------------------------------------------------
export function createMaterials() {
  const white = new THREE.MeshPhysicalMaterial({
    name: 'white',
    color: 0xf4f5f7,
    roughness: 0.34,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.07,
  });
  const pearl = white.clone();
  pearl.name = 'pearl';
  pearl.color.set(0xdfe2e7);

  const graphite = new THREE.MeshPhysicalMaterial({
    name: 'graphite',
    color: 0x1b1d22,
    roughness: 0.38,
    metalness: 0.6,
    clearcoat: 0.5,
    clearcoatRoughness: 0.25,
  });
  const rubber = new THREE.MeshStandardMaterial({
    name: 'rubber',
    color: 0x0c0d0f,
    roughness: 0.8,
    metalness: 0.1,
  });
  const silver = new THREE.MeshPhysicalMaterial({
    name: 'silver',
    color: 0xc9cdd3,
    roughness: 0.4,
    metalness: 1.0,
  });
  const visor = new THREE.MeshPhysicalMaterial({
    name: 'visor',
    color: 0x020304,
    roughness: 0.05,
    metalness: 0.35,
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
  });
  const glow = new THREE.MeshBasicMaterial({ name: 'glow', color: new THREE.Color(6, 15, 24) });
  const cell = new THREE.MeshStandardMaterial({
    name: 'cell',
    color: 0x0b2a24,
    emissive: new THREE.Color(0x19ffc0),
    emissiveIntensity: 16,
    roughness: 0.4,
  });
  const actuator = new THREE.MeshBasicMaterial({ name: 'actuator', color: new THREE.Color(24, 10, 2) });
  const egg = new THREE.MeshPhysicalMaterial({ name: 'egg', color: 0xf3e6d3, roughness: 0.55, sheen: 0.4 });
  return { white, pearl, graphite, rubber, silver, visor, glow, cell, actuator, egg };
}

// ---------- geometry helpers -----------------------------------------
const geoCache = new Map();
function cached(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}

/**
 * Smooth tapered "body shell": a lathe with elliptical end caps,
 * hanging down from y=0 to y=-len, then scaled for an oval section.
 */
function shellGeo(len, r0, r1, { sx = 1, sz = 1, bulge = 0, capT = 0.5, capB = 0.5, seg = 48 } = {}) {
  const key = `shell:${[len, r0, r1, sx, sz, bulge, capT, capB, seg].join(',')}`;
  return cached(key, () => {
    const pts = [];
    const n = 12;
    const ct = r0 * capT;
    const cb = r1 * capB;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(Math.max(1e-4, Math.sin(a) * r0), ct * Math.cos(a)));
    }
    const m = 20;
    for (let i = 1; i < m; i++) {
      const t = i / m;
      const r = r0 + (r1 - r0) * t + bulge * Math.sin(Math.PI * t);
      pts.push(new THREE.Vector2(r, -t * len));
    }
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 0.5;
      pts.push(new THREE.Vector2(Math.max(1e-4, Math.cos(a) * r1), -len - cb * Math.sin(a)));
    }
    pts.reverse(); // bottom -> top for outward normals
    const g = new THREE.LatheGeometry(pts, seg);
    g.scale(sx, 1, sz);
    return g;
  });
}
const rbox = (w, h, d, r = 0.01, s = 3) => cached(`rb:${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, r));
const sphere = (r, ws = 32, hs = 20) => cached(`sp:${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, s = 32) => cached(`cy:${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const capsule = (r, l) => cached(`ca:${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 14));
const torus = (R, r, arc = Math.PI * 2) => cached(`to:${R},${r},${arc}`, () => new THREE.TorusGeometry(R, r, 10, 64, arc));

function mesh(geo, mat, { pos, rot, scale, name } = {}) {
  const m = new THREE.Mesh(geo, mat);
  if (pos) m.position.set(...pos);
  if (rot) m.rotation.set(...rot);
  if (scale) m.scale.set(...scale);
  if (name) m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}
function group(name, pos = [0, 0, 0]) {
  const g = new THREE.Group();
  g.name = name;
  g.position.set(...pos);
  return g;
}

// ---------- body parts -----------------------------------------------
function buildHead(M) {
  const neck = group('neck', [0, 0, 0]);
  neck.rotation.order = 'YXZ';
  neck.add(mesh(cyl(0.034, 0.042, 0.1), M.graphite, { pos: [0, 0.03, 0] }));
  neck.add(mesh(torus(0.04, 0.006), M.silver, { pos: [0, 0.055, 0], rot: [Math.PI / 2, 0, 0] }));

  const head = group('head', [0, 0.13, 0.012]);
  neck.add(head);
  // helmet shell (white/pearl back & crown)
  const helmet = mesh(sphere(1, 56, 36), M.white, { scale: [0.094, 0.124, 0.11] });
  head.add(helmet);
  // glossy black face visor, wraps the front & sides
  const visorGeo = cached('visor', () =>
    new THREE.SphereGeometry(1, 64, 40, Math.PI / 2 - 1.2, 2.4, 0.6, 1.85)
  );
  head.add(mesh(visorGeo, M.visor, { scale: [0.0968, 0.1268, 0.1128], pos: [0, -0.002, 0.002] }));
  // subtle light bar across the face
  const barGeo = cached('lightbar', () => {
    const g = new THREE.TorusGeometry(1, 0.022, 8, 64, 1.1);
    g.rotateZ(Math.PI / 2 - 0.55);
    g.rotateX(Math.PI / 2);
    g.scale(0.0978, 0.07, 0.1142);
    return g;
  });
  const bar = mesh(barGeo, M.glow, { pos: [0, 0.008, 0.003] });
  bar.castShadow = false;
  head.add(bar);
  head.add(mesh(sphere(1, 40, 24), M.graphite, { scale: [0.06, 0.04, 0.07], pos: [0, -0.095, 0.005] }));
  // ear / side actuator pods
  for (const s of [1, -1]) {
    head.add(mesh(cyl(0.028, 0.028, 0.014, 32), M.graphite, { pos: [s * 0.09, -0.005, -0.012], rot: [0, 0, Math.PI / 2] }));
    head.add(mesh(cyl(0.018, 0.018, 0.016, 32), M.silver, { pos: [s * 0.094, -0.005, -0.012], rot: [0, 0, Math.PI / 2] }));
  }
  return { neck, head };
}

function buildArm(M, s) {
  const side = s > 0 ? 'L' : 'R';
  const shoulder = group(`shoulder${side}`, [s * 0.218, 0.245, -0.005]);
  shoulder.rotation.order = 'XZY';
  shoulder.add(mesh(sphere(0.056), M.graphite));
  // shoulder cap dome
  const capGeo = cached('shoulderCap', () => new THREE.SphereGeometry(0.072, 40, 20, 0, Math.PI * 2, 0, Math.PI * 0.55));
  shoulder.add(mesh(capGeo, M.white, { pos: [s * 0.006, 0.004, 0], rot: [0, 0, -s * 0.55], scale: [1, 0.95, 1.1] }));
  shoulder.add(mesh(torus(0.066, 0.0045), M.silver, { pos: [s * 0.006, 0.004, 0], rot: [Math.PI / 2, -s * 0.55, 0], scale: [1, 1.1, 1] }));
  // upper arm
  shoulder.add(mesh(shellGeo(0.22, 0.05, 0.041, { sz: 1.06, bulge: 0.006 }), M.white, { pos: [0, -0.045, 0] }));
  shoulder.add(mesh(cyl(0.036, 0.036, 0.05), M.graphite, { pos: [0, -0.26, 0] }));

  const elbow = group(`elbow${side}`, [0, -DIM.upperArm, 0]);
  shoulder.add(elbow);
  elbow.add(mesh(cyl(0.037, 0.037, 0.078), M.graphite, { rot: [0, 0, Math.PI / 2] }));
  for (const k of [1, -1]) elbow.add(mesh(cyl(0.026, 0.026, 0.006), M.silver, { pos: [k * 0.041, 0, 0], rot: [0, 0, Math.PI / 2] }));
  // forearm
  elbow.add(mesh(shellGeo(0.2, 0.047, 0.033, { sz: 1.1, bulge: 0.009, capT: 0.4 }), M.white, { pos: [0, -0.03, 0.002] }));
  elbow.add(mesh(shellGeo(0.17, 0.03, 0.026, { sz: 1.0 }), M.graphite, { pos: [-s * 0.018, -0.05, -0.012] }));

  const wrist = group(`wrist${side}`, [0, -DIM.forearm, 0]);
  elbow.add(wrist);
  wrist.add(mesh(sphere(0.027), M.graphite));
  wrist.add(mesh(cyl(0.03, 0.033, 0.02), M.silver, { pos: [0, 0.018, 0] }));

  const hand = buildHand(M, s);
  wrist.add(hand.root);
  return { shoulder, elbow, wrist, hand };
}

function buildHand(M, s) {
  const root = group('hand', [0, -0.012, 0]);
  // palm (palm faces the body: -s * X)
  root.add(mesh(rbox(0.032, 0.088, 0.078, 0.012), M.graphite, { pos: [0, -0.05, 0.002] }));
  // back-of-hand cover
  root.add(mesh(rbox(0.012, 0.062, 0.066, 0.006), M.white, { pos: [s * 0.017, -0.045, 0.002] }));
  const fingers = [];
  const zs = [0.027, 0.009, -0.009, -0.027];
  const scales = [1.0, 1.08, 1.0, 0.84];
  const L = [0.036, 0.026, 0.02];
  zs.forEach((z, i) => {
    let parent = root;
    const segs = [];
    let y = -0.094;
    for (let k = 0; k < 3; k++) {
      const len = L[k] * scales[i];
      const r = 0.0088 - k * 0.0009;
      const seg = group(`finger${i}_${k}`, [0, y, z]);
      seg.add(mesh(sphere(0.0094, 16, 12), M.silver));
      seg.add(mesh(capsule(r, Math.max(0.001, len - 2 * r)), k === 2 ? M.rubber : M.graphite, { pos: [0, -len / 2, 0] }));
      parent.add(seg);
      segs.push(seg);
      parent = seg;
      y = -len;
      z = 0;
    }
    fingers.push(segs);
  });
  // thumb
  const thumbBase = group('thumb', [-s * 0.008, -0.03, 0.04]);
  root.add(thumbBase);
  const thumb = [];
  let parent = thumbBase;
  let y = 0;
  [0.03, 0.024, 0.02].forEach((len, k) => {
    const r = 0.0098 - k * 0.001;
    const seg = group(`thumb_${k}`, [0, y, 0]);
    seg.add(mesh(sphere(0.0102, 16, 12), M.silver));
    seg.add(mesh(capsule(r, Math.max(0.001, len - 2 * r)), k === 2 ? M.rubber : M.graphite, { pos: [0, -len / 2, 0] }));
    parent.add(seg);
    thumb.push(seg);
    parent = seg;
    y = -len;
  });
  return { root, fingers, thumbBase, thumb };
}

function buildLeg(M, s) {
  const side = s > 0 ? 'L' : 'R';
  const hip = group(`hip${side}`, [s * 0.1, -0.065, 0]);
  hip.rotation.order = 'XZY';
  hip.add(mesh(sphere(0.064), M.graphite));
  hip.add(mesh(cyl(0.05, 0.05, 0.02), M.silver, { pos: [s * 0.05, 0, 0], rot: [0, 0, Math.PI / 2] }));
  // thigh: big white shell + rear actuator
  hip.add(mesh(shellGeo(0.35, 0.08, 0.05, { sx: 0.92, sz: 1.08, bulge: 0.012, capT: 0.4 }), M.white, { pos: [0, -0.04, 0.006] }));
  hip.add(mesh(cyl(0.013, 0.013, 0.24), M.silver, { pos: [s * 0.012, -0.21, -0.07] }));
  hip.add(mesh(cyl(0.022, 0.022, 0.1), M.graphite, { pos: [s * 0.012, -0.1, -0.068] }));

  const knee = group(`knee${side}`, [0, -DIM.thigh, 0]);
  hip.add(knee);
  knee.add(mesh(cyl(0.05, 0.05, 0.1), M.graphite, { rot: [0, 0, Math.PI / 2] }));
  for (const k of [1, -1]) knee.add(mesh(cyl(0.036, 0.036, 0.006), M.silver, { pos: [k * 0.052, 0, 0], rot: [0, 0, Math.PI / 2] }));
  const capGeo = cached('kneecap', () => new THREE.SphereGeometry(0.058, 32, 16, Math.PI / 2 - 1.0, 2.0, 0.5, 1.9));
  knee.add(mesh(capGeo, M.pearl, { pos: [0, 0.005, 0.004], scale: [0.95, 1.1, 1] }));
  // shin: white front shell, dark calf, linear actuator rods
  knee.add(mesh(shellGeo(0.3, 0.054, 0.034, { sx: 0.9, sz: 0.8, bulge: 0.006, capT: 0.4 }), M.white, { pos: [0, -0.05, 0.02] }));
  knee.add(mesh(shellGeo(0.28, 0.052, 0.03, { sx: 0.86, sz: 0.9, bulge: 0.008 }), M.graphite, { pos: [0, -0.06, -0.02] }));
  for (const k of [1, -1]) {
    knee.add(mesh(cyl(0.0085, 0.0085, 0.25), M.silver, { pos: [k * 0.022, -0.2, -0.062] }));
    knee.add(mesh(cyl(0.015, 0.015, 0.08), M.graphite, { pos: [k * 0.022, -0.1, -0.062] }));
  }

  const ankle = group(`ankle${side}`, [0, -DIM.shin, 0]);
  knee.add(ankle);
  ankle.add(mesh(sphere(0.034), M.graphite));
  ankle.add(mesh(cyl(0.028, 0.028, 0.075), M.silver, { rot: [0, 0, Math.PI / 2] }));
  const foot = group('foot', [0, 0, 0]);
  ankle.add(foot);
  foot.add(mesh(rbox(0.094, 0.05, 0.17, 0.018), M.graphite, { pos: [0, -0.043, 0.012] }));
  foot.add(mesh(rbox(0.07, 0.014, 0.09, 0.006), M.silver, { pos: [0, -0.016, 0.03] }));
  foot.add(mesh(rbox(0.098, 0.012, 0.172, 0.005), M.rubber, { pos: [0, -0.068, 0.012] }));
  const toe = group('toe', [0, -0.05, 0.097]);
  foot.add(toe);
  toe.add(mesh(rbox(0.09, 0.034, 0.06, 0.014), M.graphite, { pos: [0, 0.0, 0.028] }));
  toe.add(mesh(rbox(0.094, 0.01, 0.062, 0.004), M.rubber, { pos: [0, -0.018, 0.028] }));
  return { hip, knee, ankle, foot, toe };
}

function buildInternals(M) {
  // Visible only in X-ray mode: battery pack + compute + actuator markers
  const g = group('internals');
  const pack = group('battery', [0, 0.11, 0.0]);
  const cols = 9, rows = 5, layers = 2;
  const cellGeo = new THREE.CylinderGeometry(0.0085, 0.0085, 0.05, 12);
  const inst = new THREE.InstancedMesh(cellGeo, M.cell, cols * rows * layers);
  const m4 = new THREE.Matrix4();
  let i = 0;
  for (let l = 0; l < layers; l++)
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) {
        m4.makeTranslation((c - (cols - 1) / 2) * 0.021, (r - (rows - 1) / 2) * 0.034, (l - 0.5) * 0.022);
        inst.setMatrixAt(i++, m4);
      }
  inst.name = 'cells';
  pack.add(inst);
  const frame = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(0.22, 0.2, 0.07)),
    new THREE.LineBasicMaterial({ color: 0x5ff5d0, transparent: true, opacity: 0.8 })
  );
  pack.add(frame);
  const compute = mesh(rbox(0.12, 0.03, 0.05, 0.006), M.actuator, { pos: [0, 0.12, 0] });
  compute.name = 'compute';
  pack.add(compute);
  g.add(pack);
  return { root: g, pack };
}

// ---------- assemble ---------------------------------------------------
export function buildRobot(M) {
  const root = group('optimus');
  const pelvis = group('pelvis', [0, DIM.pelvisY, 0]);
  root.add(pelvis);
  pelvis.add(mesh(shellGeo(0.12, 0.122, 0.098, { sx: 1.38, sz: 0.86, capT: 0.25, capB: 0.55 }), M.white, { pos: [0, 0.055, 0] }));
  pelvis.add(mesh(rbox(0.1, 0.08, 0.12, 0.03), M.graphite, { pos: [0, -0.06, 0] }));
  pelvis.add(mesh(torus(0.118, 0.006), M.silver, { pos: [0, 0.058, 0], rot: [Math.PI / 2, 0, 0], scale: [1.36, 0.86, 1] }));

  const waist = group('waist', [0, 0.07, 0]);
  waist.rotation.order = 'YXZ';
  pelvis.add(waist);
  // abdomen: dark mechanical core with ribs
  waist.add(mesh(cyl(0.098, 0.105, 0.14, 48), M.graphite, { pos: [0, 0.07, -0.005], scale: [1.25, 1, 0.82] }));
  for (let k = 0; k < 3; k++) {
    waist.add(mesh(torus(0.102, 0.007), M.rubber, { pos: [0, 0.03 + k * 0.04, -0.005], rot: [Math.PI / 2, 0, 0], scale: [1.25, 0.82, 1] }));
  }

  const chest = group('chest', [0, 0.13, 0]);
  waist.add(chest);
  // V-shaped chest shell
  chest.add(mesh(shellGeo(0.27, 0.168, 0.102, { sx: 1.3, sz: 0.72, bulge: 0.02, capT: 0.2, capB: 0.3 }), M.white, { pos: [0, 0.285, 0] }));
  // pectoral plates
  for (const s of [1, -1]) {
    chest.add(mesh(shellGeo(0.12, 0.08, 0.062, { sx: 1.15, sz: 0.36, capT: 0.3, capB: 0.6 }), M.white, { pos: [s * 0.08, 0.262, 0.086], rot: [0.12, s * 0.22, s * 0.08] }));
  }
  // back plate / spine
  chest.add(mesh(rbox(0.2, 0.2, 0.05, 0.02), M.pearl, { pos: [0, 0.17, -0.1] }));
  chest.add(mesh(rbox(0.05, 0.22, 0.03, 0.012), M.graphite, { pos: [0, 0.16, -0.122] }));
  // collar
  chest.add(mesh(cyl(0.07, 0.11, 0.035, 48), M.graphite, { pos: [0, 0.31, -0.005], scale: [1.4, 1, 0.9] }));

  const internals = buildInternals(M);
  chest.add(internals.root);
  internals.root.visible = false;

  const { neck, head } = buildHead(M);
  neck.position.set(0, 0.335, 0);
  chest.add(neck);

  const armL = buildArm(M, 1);
  const armR = buildArm(M, -1);
  chest.add(armL.shoulder, armR.shoulder);
  const legL = buildLeg(M, 1);
  const legR = buildLeg(M, -1);
  pelvis.add(legL.hip, legR.hip);

  // egg prop for the grip demo (held in right hand)
  const egg = mesh(sphere(1, 24, 16), M.egg, { scale: [0.0215, 0.029, 0.0215] });
  egg.name = 'egg';
  egg.position.set(0.04, -0.1, 0.012);
  armR.hand.root.add(egg);
  egg.visible = false;

  // actuator markers at each joint (x-ray)
  const markers = [];
  const markerGeo = new THREE.TorusGeometry(0.03, 0.004, 8, 32);
  const addMarker = (obj, scale = 1) => {
    const m = new THREE.Mesh(markerGeo, M.actuator);
    m.scale.setScalar(scale);
    m.visible = false;
    obj.add(m);
    markers.push(m);
  };
  [armL, armR].forEach((a) => { addMarker(a.shoulder, 1.6); addMarker(a.elbow, 1.2); addMarker(a.wrist, 0.9); });
  [legL, legR].forEach((l) => { addMarker(l.hip, 2); addMarker(l.knee, 1.6); addMarker(l.ankle, 1.1); });
  addMarker(neck, 1.2);
  addMarker(waist, 3);

  // --- part tagging (for picking / highlighting) ---
  const tag = (obj, part, focus = obj) => obj.traverse((o) => {
    if (o.isMesh || o.isInstancedMesh) { o.userData.part = part; o.userData.focus = focus; }
  });
  tag(root, 'torso', chest);
  tag(armL.shoulder, 'arm'); tag(armR.shoulder, 'arm');
  tag(armL.hand.root, 'hand'); tag(armR.hand.root, 'hand');
  tag(legL.hip, 'leg'); tag(legR.hip, 'leg');
  tag(legL.foot, 'foot'); tag(legR.foot, 'foot');
  tag(neck, 'head', head);
  tag(internals.pack, 'battery');
  markers.forEach((m) => { m.userData.part = null; });
  egg.userData.part = 'hand';

  const meshes = [];
  root.traverse((o) => { if (o.isMesh || o.isInstancedMesh) { o.userData.baseMat = o.material; meshes.push(o); } });
  internals.root.traverse((o) => { if (o.isMesh) o.castShadow = false; });

  const J = { root, pelvis, waist, chest, neck, head, armL, armR, legL, legR };
  const base = new Map();
  for (const o of [neck, armL.shoulder, armR.shoulder, armL.elbow, armR.elbow, armL.wrist, armR.wrist, legL.hip, legR.hip, legL.knee, legR.knee, legL.ankle, legR.ankle, chest]) {
    base.set(o, o.position.clone());
  }

  // ---------- posing ----------
  function applyArm(a, p, pre, s) {
    a.shoulder.rotation.set(-p[pre + 'ShPitch'], s * p[pre + 'ShYaw'], s * p[pre + 'ShRoll']);
    a.elbow.rotation.x = -p[pre + 'Elbow'];
    a.hand.root.rotation.set(0, s * p[pre + 'WristTwist'], -s * p[pre + 'Wrist']);
    const g = p[pre + 'Grip'];
    const curl = [1.15, 1.45, 1.05];
    a.hand.fingers.forEach((f, i) => f.forEach((seg, k) => {
      seg.rotation.z = -s * g * curl[k] * (1 - i * 0.04) - (k === 0 ? s * 0.06 : 0);
      if (k === 0) seg.rotation.x = (i - 1.5) * 0.04 * (1 - g);
    }));
    a.hand.thumbBase.rotation.set(-0.55 - g * 0.25, 0, -s * (0.35 + g * 0.55));
    a.hand.thumb.forEach((seg, k) => { if (k) seg.rotation.z = -s * g * 0.6; });
  }
  function applyLeg(l, p, pre, s) {
    const h = p[pre + 'Hip'], k = p[pre + 'Knee'];
    l.hip.rotation.set(-h, 0, s * p[pre + 'HipRoll']);
    l.knee.rotation.x = k;
    l.ankle.rotation.x = h - k + p[pre + 'Ankle'];
    l.ankle.rotation.z = -s * p[pre + 'HipRoll'];
    l.toe.rotation.x = p[pre + 'Toe'] || 0;
  }
  function applyPose(p) {
    neck.rotation.set(p.headPitch, p.headYaw, p.headRoll || 0);
    waist.rotation.set(p.waistPitch, p.waistYaw, p.waistRoll || 0);
    applyArm(armL, p, 'l', 1);
    applyArm(armR, p, 'r', -1);
    applyLeg(legL, p, 'l', 1);
    applyLeg(legR, p, 'r', -1);
    // keep the lowest foot on the ground
    const ext = (pre) => (DIM.thigh * Math.cos(p[pre + 'Hip']) + DIM.shin * Math.cos(p[pre + 'Hip'] - p[pre + 'Knee'])) * Math.cos(p[pre + 'HipRoll']);
    const drop = DIM.thigh + DIM.shin - Math.max(ext('l'), ext('r'));
    pelvis.position.set(p.rootX || 0, DIM.pelvisY - drop + (p.rootY || 0) + explodeE * 0.22, p.rootZ || 0);
    pelvis.rotation.set(0, p.rootYaw || 0, p.rootRoll || 0);
  }

  let explodeE = 0;
  function setExplode(e) {
    explodeE = e;
    const off = (o, x, y, z) => { const b = base.get(o); o.position.set(b.x + x * e, b.y + y * e, b.z + z * e); };
    off(neck, 0, 0.16, 0);
    off(chest, 0, 0.08, 0);
    off(armL.shoulder, 0.16, 0.02, 0); off(armR.shoulder, -0.16, 0.02, 0);
    off(armL.elbow, 0.03, -0.08, 0); off(armR.elbow, -0.03, -0.08, 0);
    off(armL.wrist, 0.02, -0.07, 0); off(armR.wrist, -0.02, -0.07, 0);
    off(legL.hip, 0.09, -0.06, 0); off(legR.hip, -0.09, -0.06, 0);
    off(legL.knee, 0, -0.09, 0); off(legR.knee, 0, -0.09, 0);
    off(legL.ankle, 0, -0.07, 0); off(legR.ankle, 0, -0.07, 0);
  }

  return { root, J, meshes, internals, markers, egg, applyPose, setExplode };
}

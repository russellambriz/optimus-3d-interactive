import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/* ------------------------------------------------------------------ *
 *  Procedural Optimus Gen 3–style humanoid (fan recreation from
 *  Tesla's public "gen3" app renders – not Tesla CAD).
 *  Units are metres. The robot faces +Z; its left side is +X.
 *  Every body segment is a Group used as a joint pivot.
 * ------------------------------------------------------------------ */

export const DIM = {
  pelvisY: 0.95,
  thigh: 0.42,
  shin: 0.4,
  upperArm: 0.28,
  forearm: 0.255,
};

const GOLD = { color: 0xcdb68b, roughness: 0.26, metalness: 1.0, clearcoat: 0.4 };
const MATTE = { color: 0x111113, roughness: 0.62, metalness: 0.1, clearcoat: 0.0 };
const SATIN = { color: 0x0b0b0d, roughness: 0.34, metalness: 0.25, clearcoat: 0.3 };
const GLOSS = { color: 0x040405, roughness: 0.04, metalness: 0.4, clearcoat: 1.0 };

/**
 * Two-tone PBR material. `dist` is a GLSL function body returning a signed
 * distance-ish value from the object-space position `p`; >0 → finish A,
 * <0 → finish B. A thin seam is drawn along the boundary.
 */
function twoTone(name, A, B, dist, { seam = 0.0016, seamFinish = { color: 0x050506, roughness: 0.7, metalness: 0.0 }, seamAmt = 0.85 } = {}) {
  const mat = new THREE.MeshPhysicalMaterial({ name, color: 0xffffff, roughness: A.roughness, metalness: A.metalness, clearcoat: 1, clearcoatRoughness: 0.18 });
  const U = {
    uColA: { value: new THREE.Color(A.color) }, uColB: { value: new THREE.Color(B.color) },
    uRA: { value: A.roughness }, uRB: { value: B.roughness },
    uMA: { value: A.metalness }, uMB: { value: B.metalness },
    uCA: { value: A.clearcoat ?? 0 }, uCB: { value: B.clearcoat ?? 0 },
    uSeam: { value: seam }, uSeamAmt: { value: seamAmt },
    uSeamCol: { value: new THREE.Color(seamFinish.color) }, uSeamR: { value: seamFinish.roughness }, uSeamM: { value: seamFinish.metalness },
  };
  mat.userData.tt = U;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = 'varying vec3 vObjPos;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vObjPos = position;');
    sh.fragmentShader = `varying vec3 vObjPos;
uniform vec3 uColA; uniform vec3 uColB; uniform float uRA; uniform float uRB; uniform float uMA; uniform float uMB;
uniform float uCA; uniform float uCB; uniform float uSeam; uniform float uSeamAmt; uniform vec3 uSeamCol; uniform float uSeamR; uniform float uSeamM;
float ttDist(vec3 p) { ${dist} }
` + sh.fragmentShader
      .replace('#include <color_fragment>', `#include <color_fragment>
  float ttD = ttDist(vObjPos);
  float ttW = fwidth(ttD) * 0.9 + 1e-6;
  float ttM = smoothstep(-ttW, ttW, ttD);
  float ttS = (1.0 - smoothstep(uSeam - ttW, uSeam + ttW, abs(ttD))) * uSeamAmt;
  diffuseColor.rgb *= mix(mix(uColB, uColA, ttM), uSeamCol, ttS);`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  roughnessFactor = mix(mix(uRB, uRA, ttM), uSeamR, ttS);`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
  metalnessFactor = mix(mix(uMB, uMA, ttM), uSeamM, ttS);`)
      .replace('#include <lights_physical_fragment>', `#include <lights_physical_fragment>
  #ifdef USE_CLEARCOAT
  material.clearcoat = mix(uCB, uCA, ttM) * (1.0 - ttS);
  #endif`);
  };
  mat.customProgramCacheKey = () => 'tt-' + name;
  return mat;
}

function solid(name, F, extra = {}) {
  return new THREE.MeshPhysicalMaterial({ name, color: F.color, roughness: F.roughness, metalness: F.metalness, clearcoat: F.clearcoat, clearcoatRoughness: 0.2, ...extra });
}

// ---------- materials -------------------------------------------------
export function createMaterials() {
  const gold = solid('gold', GOLD);
  const black = solid('black', MATTE);
  const satin = solid('satin', SATIN);
  const rubber = new THREE.MeshStandardMaterial({ name: 'rubber', color: 0x070708, roughness: 0.9, metalness: 0 });
  const silver = new THREE.MeshPhysicalMaterial({ name: 'silver', color: 0x8d8f94, roughness: 0.4, metalness: 1.0 });

  // Head: mirror-gloss face, satin black shell, gold pinstripe at the boundary
  const head = twoTone('head', GLOSS, SATIN, `
    float phi = atan(p.x, p.z);
    float a = abs(phi) / 1.32;
    float side = (1.32 - abs(phi)) * 0.085;
    float top = (0.112 - 0.085 * a * a) - p.y;
    return min(side, top);`, { seam: 0.0013, seamFinish: { color: 0xc9b083, roughness: 0.25, metalness: 1.0 }, seamAmt: 1.0 });

  // Torso: gold chest plate + flanks, black yoke/neckline and abdomen
  const torso = twoTone('torso', GOLD, MATTE, `
    float ph = abs(atan(p.x, p.z / 0.6));
    float k = ph / 1.36;
    float ybFront = 0.07 - 0.06 * k * k * k;
    float flank = smoothstep(1.34, 1.46, ph);
    float yb = mix(ybFront, -0.3, flank);
    float back = smoothstep(1.4, 1.8, ph);
    float topEdge = mix(0.27, 0.252, back);
    return min(topEdge - p.y, p.y - yb);`);

  // Pelvis: matte black with gold continuing down the outer hips
  const pelvis = twoTone('pelvis', GOLD, MATTE, `
    float ph = abs(atan(p.x, p.z / 0.62));
    float lo = 1.3 + 0.45 * clamp((0.0 - p.y) / 0.08, 0.0, 1.0);
    return min(min(ph - lo, 2.3 - ph) * 0.12, p.y + 0.06);`);

  // Thigh: gold, black "brief" region on the inner/upper thigh, black kneepad
  const thigh = twoTone('thigh', GOLD, MATTE, `
    float th = abs(atan(p.z, p.x));
    float yb = 0.09 - 0.096 * th;
    float knee = -0.356 + 0.018 * cos(atan(p.z, p.x));
    return min(yb - p.y, p.y - knee);`);

  // Upper arm: gold with a single panel seam
  const upperArm = twoTone('upperArm', GOLD, GOLD, `return abs(p.y + 0.105) - 0.0;`, { seam: 0.0012 });
  // Lower leg "boot": cuff line + slanted ankle seam
  const boot = twoTone('boot', MATTE, { color: 0x18181a, roughness: 0.5, metalness: 0.15, clearcoat: 0.1 }, `
    float cuff = -0.045 - p.y;
    float ankle = p.y - (-0.3 - 0.75 * p.z);
    return min(cuff, ankle);`, { seam: 0.0022, seamFinish: { color: 0x45464b, roughness: 0.3, metalness: 0.6 }, seamAmt: 1.0 });

  const glow = new THREE.MeshBasicMaterial({ name: 'glow', color: new THREE.Color(6, 15, 24) });
  const cell = new THREE.MeshStandardMaterial({ name: 'cell', color: 0x0b2a24, emissive: new THREE.Color(0x19ffc0), emissiveIntensity: 12, roughness: 0.4 });
  const actuator = new THREE.MeshBasicMaterial({ name: 'actuator', color: new THREE.Color(24, 10, 2) });
  const egg = new THREE.MeshPhysicalMaterial({ name: 'egg', color: 0xf3e6d3, roughness: 0.55, sheen: 0.4 });
  return { gold, black, satin, rubber, silver, head, torso, pelvis, thigh, upperArm, boot, glow, cell, actuator, egg };
}

// ---------- geometry helpers -----------------------------------------
const geoCache = new Map();
function cached(key, fn) {
  if (!geoCache.has(key)) geoCache.set(key, fn());
  return geoCache.get(key);
}

/** Smooth lathe from a list of [radius, y] control points (top → bottom). */
function profileGeo(key, pts, { sx = 1, sz = 1, seg = 64, samples = 90, zFn = null } = {}) {
  return cached('prof:' + key, () => {
    const curve = new THREE.SplineCurve(pts.map(([r, y]) => new THREE.Vector2(r, y)));
    const p2 = curve.getSpacedPoints(samples).map((v) => new THREE.Vector2(Math.max(1e-4, v.x), v.y));
    p2[0].x = 1e-4; p2[p2.length - 1].x = 1e-4;
    p2.reverse(); // bottom -> top
    const g = new THREE.LatheGeometry(p2, seg);
    g.scale(sx, 1, sz);
    if (zFn) {
      const pos = g.attributes.position;
      for (let i = 0; i < pos.count; i++) pos.setZ(i, pos.getZ(i) * zFn(pos.getY(i), pos.getZ(i), pos.getX(i)));
      g.computeVertexNormals();
    }
    return g;
  });
}
const rbox = (w, h, d, r = 0.01, s = 4) => cached(`rb:${w},${h},${d},${r},${s}`, () => new RoundedBoxGeometry(w, h, d, s, r));
const sphere = (r, ws = 32, hs = 20) => cached(`sp:${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs));
const cyl = (rt, rb, h, s = 40) => cached(`cy:${rt},${rb},${h},${s}`, () => new THREE.CylinderGeometry(rt, rb, h, s));
const capsule = (r, l) => cached(`ca:${r},${l}`, () => new THREE.CapsuleGeometry(r, l, 6, 16));
const torus = (R, r) => cached(`to:${R},${r}`, () => new THREE.TorusGeometry(R, r, 10, 64));

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
  const neck = group('neck');
  neck.rotation.order = 'YXZ';
  // tall matte neck flaring into the trapezius
  neck.add(mesh(profileGeo('neck', [[0, 0.13], [0.052, 0.125], [0.054, 0.075], [0.06, 0.03], [0.085, 0.0], [0.11, -0.02], [0, -0.03]], { sx: 1.05, sz: 0.8 }), M.black, { pos: [0, 0, -0.008] }));

  const head = group('head', [0, 0.158, 0.008]);
  neck.add(head);
  const headGeo = profileGeo('head', [[0, 0.12], [0.046, 0.113], [0.075, 0.09], [0.088, 0.048], [0.088, 0.005], [0.081, -0.04], [0.068, -0.075], [0.048, -0.1], [0.025, -0.113], [0, -0.117]], {
    sx: 1.0, sz: 1.06, seg: 96, samples: 120,
    // flatten the face slightly and push the back of the skull out
    zFn: (y, z) => (z > 0 ? 1.0 - 0.06 * Math.max(0, 1 - Math.abs(y + 0.01) / 0.1) : 1.06),
  });
  const skull = mesh(headGeo, M.head, { rot: [-0.08, 0, 0] });
  head.add(skull);
  return { neck, head };
}

function buildArm(M, s) {
  const side = s > 0 ? 'L' : 'R';
  const shoulder = group(`shoulder${side}`, [s * 0.2, 0.222, -0.004]);
  shoulder.rotation.order = 'XZY';
  shoulder.add(mesh(sphere(0.036), M.black));
  // gold shoulder cap continuous with the upper arm
  shoulder.add(mesh(profileGeo('upperArm', [[0, 0.048], [0.034, 0.041], [0.046, 0.012], [0.047, -0.03], [0.044, -0.11], [0.04, -0.2], [0.037, -0.245], [0, -0.258]], { sz: 1.04 }), M.upperArm, { pos: [s * 0.004, 0, 0] }));

  const elbow = group(`elbow${side}`, [0, -DIM.upperArm, 0]);
  shoulder.add(elbow);
  elbow.add(mesh(cyl(0.036, 0.036, 0.07), M.black, { rot: [0, 0, Math.PI / 2] }));
  // matte elbow band with a small ridge
  elbow.add(mesh(cyl(0.043, 0.044, 0.05, 48), M.satin, { pos: [0, -0.012, 0], scale: [1, 1, 1.06] }));
  elbow.add(mesh(rbox(0.022, 0.04, 0.028, 0.009), M.satin, { pos: [s * 0.04, -0.006, -0.004] }));
  // bulky gold forearm (houses the hand actuators)
  elbow.add(mesh(profileGeo('forearm', [[0, -0.02], [0.04, -0.03], [0.045, -0.06], [0.044, -0.11], [0.038, -0.18], [0.031, -0.23], [0.028, -0.245], [0, -0.25]], { sz: 1.1 }), M.gold));

  const wrist = group(`wrist${side}`, [0, -DIM.forearm, 0]);
  elbow.add(wrist);
  wrist.add(mesh(cyl(0.028, 0.031, 0.03), M.black, { pos: [0, 0.008, 0] }));
  wrist.add(mesh(sphere(0.026), M.black));

  const hand = buildHand(M, s);
  wrist.add(hand.root);
  return { shoulder, elbow, wrist, hand };
}

function buildHand(M, s) {
  const root = group('hand', [0, -0.012, 0]);
  // palm (palm faces the body: -s * X), slightly tapered
  root.add(mesh(rbox(0.03, 0.094, 0.08, 0.013), M.black, { pos: [0, -0.052, 0.002] }));
  root.add(mesh(rbox(0.026, 0.03, 0.07, 0.012), M.black, { pos: [0, -0.008, 0.0] }));
  const fingers = [];
  const zs = [0.0285, 0.0095, -0.0095, -0.027];
  const lens = [[0.042, 0.026, 0.021], [0.046, 0.029, 0.022], [0.043, 0.027, 0.021], [0.034, 0.021, 0.018]];
  zs.forEach((z, i) => {
    let parent = root;
    const segs = [];
    let y = -0.1;
    for (let k = 0; k < 3; k++) {
      const len = lens[i][k];
      const r = (i === 3 ? 0.0083 : 0.0093) - k * 0.0008;
      const seg = group(`finger${i}_${k}`, [0, y, z]);
      seg.add(mesh(sphere(r + 0.0004, 16, 12), M.black));
      seg.add(mesh(capsule(r, Math.max(0.001, len - 2 * r)), k === 2 ? M.rubber : M.black, { pos: [0, -len / 2, 0] }));
      parent.add(seg);
      segs.push(seg);
      parent = seg;
      y = -len;
      z = 0;
    }
    fingers.push(segs);
  });
  // opposable thumb near the base of the palm
  const thumbBase = group('thumb', [-s * 0.006, -0.032, 0.036]);
  root.add(thumbBase);
  const thumb = [];
  let parent = thumbBase;
  let y = 0;
  [0.036, 0.028, 0.022].forEach((len, k) => {
    const r = 0.0108 - k * 0.0009;
    const seg = group(`thumb_${k}`, [0, y, 0]);
    seg.add(mesh(sphere(r + 0.0004, 16, 12), M.black));
    seg.add(mesh(capsule(r, Math.max(0.001, len - 2 * r)), k === 2 ? M.rubber : M.black, { pos: [0, -len / 2, 0] }));
    parent.add(seg);
    thumb.push(seg);
    parent = seg;
    y = -len;
  });
  return { root, fingers, thumbBase, thumb };
}

function buildLeg(M, s) {
  const side = s > 0 ? 'L' : 'R';
  const hip = group(`hip${side}`, [s * 0.09, -0.065, 0]);
  hip.rotation.order = 'XZY';
  hip.add(mesh(sphere(0.06), M.black));
  // gold thigh; mirrored for the right leg so the mask's +X is always "outer"
  hip.add(mesh(profileGeo('thigh', [[0, 0.07], [0.055, 0.064], [0.074, 0.03], [0.078, -0.03], [0.074, -0.14], [0.066, -0.26], [0.057, -0.35], [0.053, -0.4], [0, -0.415]], { sx: 0.96, sz: 1.06, seg: 72 }), M.thigh, { scale: [s, 1, 1] }));

  const knee = group(`knee${side}`, [0, -DIM.thigh, 0]);
  hip.add(knee);
  knee.add(mesh(sphere(0.052), M.black, { scale: [1, 1, 1.05] }));
  // black kneepad
  const padGeo = cached('kneepad', () => new THREE.SphereGeometry(0.064, 48, 24, Math.PI / 2 - 1.35, 2.7, 0.3, 1.75));
  knee.add(mesh(padGeo, M.black, { pos: [0, 0.012, 0.0], scale: [0.95, 1.3, 1.02] }));
  // lower leg "boot"
  knee.add(mesh(profileGeo('boot', [[0, 0.02], [0.058, 0.012], [0.066, -0.03], [0.066, -0.09], [0.061, -0.17], [0.053, -0.26], [0.047, -0.33], [0.048, -0.39], [0.051, -0.42], [0, -0.43]], {
    sx: 0.92, sz: 1.04, seg: 64,
    zFn: (y, z) => (z < 0 ? 1 + 0.18 * Math.max(0, 1 - Math.abs(y + 0.12) / 0.12) : 1),
  }), M.boot, { pos: [0, -0.012, 0] }));

  const ankle = group(`ankle${side}`, [0, -DIM.shin, 0]);
  knee.add(ankle);
  ankle.add(mesh(sphere(0.036), M.black));
  const foot = group('foot', [0, 0, 0]);
  ankle.add(foot);
  // one-piece boot-like shoe (lathe laid along +Z, flat sole)
  const shoeGeo = cached('shoe', () => {
    const curve = new THREE.SplineCurve([[0, 0.18], [0.028, 0.172], [0.042, 0.145], [0.049, 0.09], [0.048, 0.02], [0.045, -0.035], [0.036, -0.062], [0, -0.072]].map(([r, y]) => new THREE.Vector2(r, y)));
    const pts = curve.getSpacedPoints(80).map((v) => new THREE.Vector2(Math.max(1e-4, v.x), v.y));
    pts[0].x = 1e-4; pts[pts.length - 1].x = 1e-4;
    pts.reverse();
    const g = new THREE.LatheGeometry(pts, 64);
    g.rotateX(Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      let y = pos.getY(i) * 0.82;
      const z = pos.getZ(i);
      // rise toward the ankle, flat sole
      y += 0.012 * Math.max(0, 1 - Math.abs(z - 0.0) / 0.08) * (y > 0 ? 1 : 0);
      pos.setXYZ(i, pos.getX(i) * 0.98, Math.max(y, -0.03), z);
    }
    g.computeVertexNormals();
    return g;
  });
  foot.add(mesh(shoeGeo, M.black, { pos: [0, -0.04, 0.0], scale: [1.1, 1.08, 1.08] }));
  const toe = group('toe', [0, -0.062, 0.1]);
  foot.add(toe);
  return { hip, knee, ankle, foot, toe };
}

function buildInternals(M) {
  // Visible only in X-ray mode: battery pack + compute
  const g = group('internals');
  const pack = group('battery', [0, 0.13, 0.0]);
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
  // enclosed matte pelvis ("brief" region)
  pelvis.add(mesh(profileGeo('pelvis', [[0, 0.1], [0.088, 0.098], [0.098, 0.06], [0.112, 0.01], [0.142, -0.03], [0.13, -0.07], [0.082, -0.1], [0.04, -0.116], [0, -0.12]], { sx: 1, sz: 0.62, seg: 72 }), M.pelvis));

  const waist = group('waist', [0, 0.07, 0]);
  waist.rotation.order = 'YXZ';
  pelvis.add(waist);

  const chest = group('chest', [0, 0.13, 0]);
  waist.add(chest);
  // one smooth torso shell: gold chest + flanks, black yoke & abdomen
  chest.add(mesh(profileGeo('torso', [[0, 0.345], [0.06, 0.342], [0.12, 0.326], [0.158, 0.3], [0.17, 0.262], [0.162, 0.19], [0.146, 0.1], [0.128, 0.02], [0.112, -0.06], [0.11, -0.12], [0.124, -0.17], [0.13, -0.2], [0, -0.212]], {
    sx: 1, sz: 0.6, seg: 96, samples: 120,
    zFn: (y, z, x) => (z > 0 ? (1 + 0.08 * Math.max(0, 1 - Math.abs(y - 0.18) / 0.12)) * (1 - 0.035 * Math.exp(-(x * x) / 0.0009) * Math.max(0, 1 - Math.abs(y - 0.16) / 0.1)) : 1 + 0.05 * Math.max(0, 1 - Math.abs(y - 0.2) / 0.12)),
  }), M.torso));

  const internals = buildInternals(M);
  chest.add(internals.root);
  internals.root.visible = false;

  const { neck, head } = buildHead(M);
  neck.position.set(0, 0.33, -0.004);
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
  const addMarker = (obj, scale = 1, pos) => {
    const m = new THREE.Mesh(markerGeo, M.actuator);
    m.scale.setScalar(scale);
    if (pos) m.position.set(...pos);
    m.visible = false;
    obj.add(m);
    markers.push(m);
  };
  [armL, armR].forEach((a) => {
    addMarker(a.shoulder, 1.6); addMarker(a.elbow, 1.2); addMarker(a.wrist, 0.9);
    // forearm actuator pack (Gen 3 moves the hand actuators into the forearm)
    addMarker(a.elbow, 1.45, [0, -0.08, 0]); addMarker(a.elbow, 1.3, [0, -0.13, 0]);
  });
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
    const curl = [1.2, 1.45, 1.0];
    a.hand.fingers.forEach((f, i) => f.forEach((seg, k) => {
      seg.rotation.z = -s * g * curl[k] * (1 - i * 0.03) - (k === 0 ? s * 0.05 : -s * 0.08);
      if (k === 0) seg.rotation.x = (i - 1.5) * 0.045 * (1 - g);
    }));
    a.hand.thumbBase.rotation.set(-0.22 - g * 0.55, 0, -s * (0.28 + g * 0.6));
    a.hand.thumb.forEach((seg, k) => { if (k) seg.rotation.z = -s * (0.1 + g * 0.55); });
  }
  function applyLeg(l, p, pre, s) {
    const h = p[pre + 'Hip'], k = p[pre + 'Knee'];
    l.hip.rotation.set(-h, 0, s * p[pre + 'HipRoll']);
    l.knee.rotation.x = k;
    l.ankle.rotation.x = h - k + p[pre + 'Ankle'];
    l.ankle.rotation.z = -s * p[pre + 'HipRoll'];
    l.toe.rotation.x = p[pre + 'Toe'] || 0;
  }
  let explodeE = 0;
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

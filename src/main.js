import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { createMaterials, buildRobot } from './robot.js';
import { PRESETS, JOINTS, REST, POSE_KEYS, lerpPose, toUi, fromUi } from './animation.js';
import { PARTS, PART_ORDER } from './parts.js';
import './style.css';

const $ = (s) => document.querySelector(s);
const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r()));
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const isMobile = matchMedia('(max-width: 720px)').matches || matchMedia('(pointer: coarse)').matches;
const params = new URLSearchParams(location.search);

async function progress(pct, text) {
  $('#loadbar').style.width = pct + '%';
  $('#loadtext').textContent = text;
  await nextFrame();
}

const THEMES = {
  dark: { center: '#1d2330', mid: '#0e1218', edge: '#05070a', floor: 0x07090c, platform: 0x101318, ring: new THREE.Color(4.5, 14, 24), key: 1.7, env: 0.5, rim: 0x7fbfff, rimI: 1.4 },
  light: { center: '#ffffff', mid: '#e4e8ee', edge: '#b9c0ca', floor: 0xd4d9e0, platform: 0xe9ecf0, ring: new THREE.Color(2.4, 10, 26), key: 1.5, env: 0.6, rim: 0xffffff, rimI: 0.8 },
};

// ======================================================================
async function init() {
  await progress(8, 'Initializing renderer…');
  const canvas = $('#c');
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: params.has('capture') });
  renderer.setPixelRatio(Math.min(devicePixelRatio, isMobile ? 1.75 : 2));
  renderer.setSize(innerWidth, innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, innerWidth / innerHeight, 0.05, 60);
  const HOME = { pos: new THREE.Vector3(1.95, 1.4, 3.05), target: new THREE.Vector3(0, 0.9, 0) };
  if (isMobile) HOME.pos.multiplyScalar(1.25);
  camera.position.copy(HOME.pos);

  const controls = new OrbitControls(camera, canvas);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 0.6;
  controls.maxDistance = 9;
  controls.maxPolarAngle = Math.PI * 0.5 - 0.03;
  controls.autoRotateSpeed = 0.8;
  controls.rotateSpeed = 0.8;
  controls.update();

  await progress(22, 'Baking studio lighting…');
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.035).texture;
  scene.environment = envTex;
  pmrem.dispose();

  // background gradient (canvas texture)
  const bgCanvas = document.createElement('canvas');
  bgCanvas.width = 1024; bgCanvas.height = 1024;
  const bgTex = new THREE.CanvasTexture(bgCanvas);
  bgTex.colorSpace = THREE.SRGBColorSpace;
  scene.background = bgTex;

  // lights
  const key = new THREE.DirectionalLight(0xffffff, 2.6);
  key.position.set(2.2, 4.2, 2.6);
  key.castShadow = true;
  key.shadow.mapSize.set(isMobile ? 1024 : 2048, isMobile ? 1024 : 2048);
  Object.assign(key.shadow.camera, { left: -1.4, right: 1.4, top: 2.2, bottom: -0.6, near: 0.5, far: 10 });
  key.shadow.bias = -0.0003;
  key.shadow.normalBias = 0.015;
  key.shadow.radius = 4;
  key.target.position.set(0, 0.9, 0);
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0x6fb6ff, 3.0);
  rim.position.set(-3, 2.6, -3.2);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xffe8d6, 0.35);
  fill.position.set(-3, 1.2, 2.5);
  scene.add(fill);

  // floor with radial fade + platform
  const fadeCanvas = document.createElement('canvas');
  fadeCanvas.width = fadeCanvas.height = 256;
  const fctx = fadeCanvas.getContext('2d');
  const fg = fctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  fg.addColorStop(0, '#fff'); fg.addColorStop(0.45, '#fff'); fg.addColorStop(1, '#000');
  fctx.fillStyle = fg; fctx.fillRect(0, 0, 256, 256);
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x0b0e13, roughness: 0.92, metalness: 0.0, transparent: true, alphaMap: new THREE.CanvasTexture(fadeCanvas) });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(9, 96), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const platformMat = new THREE.MeshPhysicalMaterial({ color: 0x14171d, roughness: 0.25, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 });
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.76, 0.035, 128), platformMat);
  platform.position.y = 0.0175;
  platform.receiveShadow = true;
  scene.add(platform);
  const ringMat = new THREE.MeshBasicMaterial({ color: THEMES.dark.ring });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.742, 0.0035, 8, 192), ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.03;
  scene.add(ring);
  const PLATFORM_TOP = 0.035;

  await progress(45, 'Assembling chassis & actuators…');
  const M = createMaterials();
  const robot = buildRobot(M);
  robot.root.position.y = PLATFORM_TOP;
  scene.add(robot.root);

  await progress(68, 'Compiling shaders…');
  // post-processing
  const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, rt);
  composer.setPixelRatio(renderer.getPixelRatio());
  composer.setSize(innerWidth, innerHeight);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.6, 0.5, 10.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  renderer.compile(scene, camera);

  // ==================================================================
  // State
  const state = {
    preset: 'idle',
    speed: 1,
    t: 0,
    from: { ...REST },
    switchT: -10,
    manual: { ...REST },
    pose: { ...REST },
    explode: 0, explodeTarget: 0,
    xray: false, wire: false,
    theme: 'dark',
    hovered: null, selected: null, selectedFocus: null,
    camAnim: null,
    eggVis: 0,
  };

  // ---------- theme ----------
  function paintBackground(th) {
    const ctx = bgCanvas.getContext('2d');
    const g = ctx.createRadialGradient(512, 430, 30, 512, 520, 760);
    g.addColorStop(0, th.center); g.addColorStop(0.45, th.mid); g.addColorStop(1, th.edge);
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1024, 1024);
    bgTex.needsUpdate = true;
  }
  function setTheme(name) {
    state.theme = name;
    const th = THEMES[name];
    document.documentElement.dataset.theme = name;
    document.querySelector('meta[name=theme-color]').content = name === 'dark' ? '#0a0c11' : '#e7eaef';
    paintBackground(th);
    floorMat.color.set(th.floor);
    platformMat.color.set(th.platform);
    platformMat.metalness = name === 'dark' ? 0.4 : 0.05;
    ringMat.color.copy(th.ring);
    key.intensity = th.key;
    rim.color.set(th.rim); rim.intensity = th.rimI;
    scene.environmentIntensity = th.env;
    bloom.strength = name === 'dark' ? 0.55 : 0.35;
  }
  setTheme(params.get('theme') === 'light' ? 'light' : 'dark');

  // ---------- material modes (x-ray / wireframe) ----------
  const robotMats = Object.values(M);
  const XRAY = new Set([M.white, M.pearl, M.visor, M.graphite, M.rubber, M.silver]);
  function applyMaterialModes() {
    for (const m of robotMats) {
      const x = state.xray && XRAY.has(m);
      m.transparent = x;
      m.opacity = x ? (m === M.graphite || m === M.silver || m === M.rubber ? 0.28 : 0.12) : 1;
      m.depthWrite = !x;
      m.wireframe = state.wire && m !== M.cell;
      m.needsUpdate = true;
    }
    robot.internals.root.visible = state.xray;
    robot.markers.forEach((mk) => (mk.visible = state.xray));
    robot.meshes.forEach((o) => (o.castShadow = !state.xray && !robot.internals.root.children.includes(o)));
    clearHighlightCache();
    refreshHighlights();
  }

  // ---------- highlight ----------
  const hiCache = new Map();
  const accent = new THREE.Color(0x3ab8ff);
  function hiMat(base, strong) {
    const k = base.uuid + (strong ? 's' : 'h');
    if (!hiCache.has(k)) {
      const m = base.clone();
      if (m.emissive) { m.emissive.copy(accent); m.emissiveIntensity = strong ? 0.55 : 0.3; }
      else if (m.color) m.color.lerp(accent, strong ? 0.4 : 0.25);
      hiCache.set(k, m);
    }
    return hiCache.get(k);
  }
  function clearHighlightCache() { hiCache.forEach((m) => m.dispose()); hiCache.clear(); }
  function sameGroup(o, focus, part) {
    if (!part || o.userData.part !== part) return false;
    // hands/arms/legs/feet: highlight only the side that was hit
    return o.userData.focus === focus;
  }
  function refreshHighlights() {
    for (const o of robot.meshes) {
      const sel = state.selected && sameGroup(o, state.selectedFocus, state.selected);
      const hov = state.hovered && sameGroup(o, state.hovered.focus, state.hovered.part);
      if (sel || hov) o.material = hiMat(o.userData.baseMat, sel);
      else o.material = o.userData.baseMat;
    }
  }

  // ---------- camera focus ----------
  function flyTo(pos, target, dur = 1.1) {
    state.camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), start: performance.now(), dur: dur * 1000 };
  }
  const box = new THREE.Box3(), v3 = new THREE.Vector3(), size = new THREE.Vector3();
  function focusObject(obj, part) {
    box.makeEmpty();
    obj.updateWorldMatrix(true, true);
    obj.traverse((o) => { if ((o.isMesh) && o.visible && o.userData.part === part) box.expandByObject(o); });
    if (box.isEmpty()) box.setFromObject(obj);
    box.getCenter(v3); box.getSize(size);
    const r = Math.max(size.x, size.y, size.z);
    const dist = THREE.MathUtils.clamp(r * 2.4 + 0.5, 0.95, 4.5) * (isMobile ? 1.35 : 1);
    const dir = camera.position.clone().sub(controls.target).normalize();
    dir.y = THREE.MathUtils.clamp(dir.y, 0.05, 0.6);
    dir.normalize();
    flyTo(v3.clone().add(dir.multiplyScalar(dist)), v3.clone());
  }
  function resetView(dir) {
    const t = HOME.target.clone();
    const d = HOME.pos.distanceTo(HOME.target);
    let p = HOME.pos.clone();
    if (dir === 'front') p = t.clone().add(new THREE.Vector3(0, 0.2, d));
    if (dir === 'side') p = t.clone().add(new THREE.Vector3(d, 0.2, 0));
    if (dir === 'back') p = t.clone().add(new THREE.Vector3(0, 0.25, -d));
    flyTo(p, t);
  }

  // ---------- info card ----------
  const defaultFocus = {
    head: robot.J.head, torso: robot.J.chest, battery: robot.internals.pack,
    arm: robot.J.armR.shoulder, hand: robot.J.armR.hand.root, leg: robot.J.legR.hip, foot: robot.J.legR.foot,
  };
  function select(part, focus) {
    if (!part) {
      state.selected = null; state.selectedFocus = null;
      $('#infocard').classList.remove('show');
      document.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
      refreshHighlights();
      return;
    }
    focus = focus || defaultFocus[part];
    state.selected = part; state.selectedFocus = focus;
    const d = PARTS[part];
    $('#infoKicker').textContent = d.kicker;
    $('#infoTitle').textContent = d.title;
    $('#infoBody').textContent = d.body;
    $('#infoTags').innerHTML = d.tags.map((t) => `<span class="tag">${t}</span>`).join('');
    const idx = PART_ORDER.indexOf(part);
    $('#infoIndex').textContent = idx >= 0 ? `${idx + 1} / ${PART_ORDER.length}` : 'X-ray';
    const card = $('#infocard');
    card.classList.remove('show'); void card.offsetWidth; card.classList.add('show');
    document.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c.dataset.part === part));
    refreshHighlights();
    focusObject(focus, part);
    hideHint();
  }
  const stepPart = (dir) => {
    const i = Math.max(0, PART_ORDER.indexOf(state.selected));
    select(PART_ORDER[(i + dir + PART_ORDER.length) % PART_ORDER.length]);
  };
  $('#infoPrev').onclick = () => stepPart(-1);
  $('#infoNext').onclick = () => stepPart(1);
  $('#infoClose').onclick = () => { select(null); resetView(); };

  // ---------- picking ----------
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const tooltip = $('#tooltip');
  let pickQueued = false, lastPointer = null, downAt = null;
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const targets = robot.meshes.filter((o) => o.visible && o.userData.part && (o.userData.part !== 'battery' || state.xray) && (state.xray ? true : !isInternal(o)));
    const hits = raycaster.intersectObjects(targets, false);
    if (!hits.length) return null;
    // in x-ray, prefer the battery pack if it was hit at all
    const h = (state.xray && hits.find((x) => x.object.userData.part === 'battery')) || hits[0];
    return { part: h.object.userData.part, focus: h.object.userData.focus };
  }
  const internalSet = new Set();
  robot.internals.root.traverse((o) => internalSet.add(o));
  const isInternal = (o) => internalSet.has(o);

  canvas.addEventListener('pointermove', (e) => {
    lastPointer = e;
    if (e.pointerType === 'touch') return;
    if (!pickQueued) {
      pickQueued = true;
      requestAnimationFrame(() => {
        pickQueued = false;
        const h = pick(lastPointer);
        const changed = (h?.part !== state.hovered?.part) || (h?.focus !== state.hovered?.focus);
        state.hovered = h;
        if (changed) refreshHighlights();
        canvas.style.cursor = h ? 'pointer' : 'grab';
        if (h) {
          tooltip.textContent = PARTS[h.part].title;
          tooltip.style.left = lastPointer.clientX + 'px';
          tooltip.style.top = lastPointer.clientY + 'px';
          tooltip.classList.add('show');
        } else tooltip.classList.remove('show');
      });
    }
  });
  canvas.addEventListener('pointerleave', () => { state.hovered = null; tooltip.classList.remove('show'); refreshHighlights(); });
  canvas.addEventListener('pointerdown', (e) => { downAt = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  canvas.addEventListener('pointerup', (e) => {
    if (!downAt) return;
    const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
    if (moved < 6 && performance.now() - downAt.t < 500) {
      const h = pick(e);
      if (h) select(h.part, h.focus);
      else if (state.selected) { select(null); }
    }
    downAt = null;
  });
  canvas.addEventListener('dblclick', (e) => { if (!pick(e)) { select(null); resetView(); } });
  controls.addEventListener('start', () => { state.camAnim = null; hideHint(); });

  // ==================================================================
  // UI building
  // presets
  const presetBox = $('#presets');
  const presetKeys = Object.keys(PRESETS);
  presetKeys.forEach((k, i) => {
    const b = document.createElement('button');
    b.className = 'preset';
    b.dataset.preset = k;
    b.innerHTML = `<svg viewBox="0 0 24 24"><path d="${PRESETS[k].icon}"/></svg>${PRESETS[k].label}<span class="kb">${i + 1}</span>`;
    b.onclick = () => setPreset(k);
    presetBox.appendChild(b);
  });
  const manualBtn = document.createElement('button');
  manualBtn.className = 'preset';
  manualBtn.dataset.preset = 'manual';
  manualBtn.innerHTML = `<svg viewBox="0 0 24 24"><path d="M4 7h10m4 0h2M4 17h4m4 0h8M14 5v4m-4 6v4"/></svg>Manual<span class="kb">J</span>`;
  manualBtn.onclick = () => { setPreset('manual'); showTab('joints'); };
  presetBox.appendChild(manualBtn);

  function setPreset(k) {
    if (k === state.preset) return;
    state.from = { ...state.pose };
    state.switchT = state.t;
    if (k === 'manual') state.manual = { ...state.pose };
    state.preset = k;
    document.querySelectorAll('.preset').forEach((b) => b.classList.toggle('active', b.dataset.preset === k));
  }
  document.querySelector('.preset[data-preset="idle"]').classList.add('active');

  const speed = $('#speed');
  const setRangeFill = (el) => el.style.setProperty('--p', ((el.value - el.min) / (el.max - el.min)) * 100 + '%');
  speed.oninput = () => { state.speed = +speed.value; $('#speedOut').textContent = state.speed.toFixed(2) + '×'; setRangeFill(speed); };
  setRangeFill(speed);

  // part chips
  PART_ORDER.forEach((p) => {
    const c = document.createElement('button');
    c.className = 'chip'; c.dataset.part = p; c.textContent = PARTS[p].title;
    c.onclick = () => select(p);
    $('#partChips').appendChild(c);
  });

  // sliders
  const sliderEls = {};
  let currentGroup = null, groupEl = null;
  for (const j of JOINTS) {
    if (j.group !== currentGroup) {
      currentGroup = j.group;
      groupEl = document.createElement('div');
      groupEl.className = 'joint-group';
      groupEl.innerHTML = `<h4>${j.group}</h4>`;
      $('#sliders').appendChild(groupEl);
    }
    const row = document.createElement('label');
    row.className = 'joint';
    row.innerHTML = `<span>${j.label}</span><input type="range" min="${j.min}" max="${j.max}" step="1"><output></output>`;
    const input = row.querySelector('input'), out = row.querySelector('output');
    input.addEventListener('input', () => {
      if (state.preset !== 'manual') setPreset('manual');
      state.manual[j.key] = fromUi(j, +input.value);
      out.textContent = Math.round(+input.value) + (j.pct ? '%' : '°');
      setRangeFill(input);
    });
    sliderEls[j.key] = { input, out, j };
    groupEl.appendChild(row);
  }
  function syncSliders() {
    for (const k in sliderEls) {
      const { input, out, j } = sliderEls[k];
      if (document.activeElement === input) continue;
      const v = Math.round(toUi(j, state.pose[k]));
      if (+input.value !== v) { input.value = v; out.textContent = v + (j.pct ? '%' : '°'); setRangeFill(input); }
    }
  }
  $('#btnResetPose').onclick = () => { setPreset('manual'); state.from = { ...state.pose }; state.switchT = state.t; state.manual = { ...REST }; };

  // toggles
  const toggles = [
    { key: 'auto', label: 'Auto-rotate', hint: 'Slowly orbit the robot', kb: 'R', set: (v) => (controls.autoRotate = v), init: false },
    { key: 'explode', label: 'Exploded view', hint: 'Separate the body segments', kb: 'E', set: (v) => (state.explodeTarget = v ? 1 : 0), init: false },
    { key: 'xray', label: 'X-ray', hint: 'See the battery pack & actuators', kb: 'X', set: (v) => { state.xray = v; applyMaterialModes(); }, init: false },
    { key: 'wire', label: 'Wireframe', hint: 'Show the procedural mesh', kb: 'W', set: (v) => { state.wire = v; applyMaterialModes(); }, init: false },
    { key: 'bloom', label: 'Glow (bloom)', hint: 'Post-processing on emissive parts', set: (v) => (bloom.enabled = v), init: true },
    { key: 'shadows', label: 'Soft shadows', hint: 'Disable for extra performance', set: (v) => { key.castShadow = v; }, init: true },
    { key: 'fps', label: 'FPS counter', hint: 'Show performance', set: (v) => ($('#fps').style.display = v ? 'block' : 'none'), init: false },
  ];
  const toggleState = {};
  for (const t of toggles) {
    const row = document.createElement('div');
    row.className = 'toggle-row';
    row.innerHTML = `<div>${t.label}<small>${t.hint}</small></div><span class="switch"></span>`;
    const setV = (v) => { toggleState[t.key] = v; row.classList.toggle('on', v); t.set(v); };
    row.onclick = () => setV(!toggleState[t.key]);
    t.apply = setV;
    setV(t.init);
    $('#toggles').appendChild(row);
  }
  const toggle = (k) => { const t = toggles.find((x) => x.key === k); t.apply(!toggleState[k]); };

  // tabs
  function showTab(name) {
    const tabs = [...document.querySelectorAll('.tab')];
    tabs.forEach((t, i) => {
      const on = t.dataset.tab === name;
      t.classList.toggle('active', on);
      if (on) document.querySelector('.tab-ink').style.transform = `translateX(${i * 100}%)`;
    });
    document.querySelectorAll('.tab-page').forEach((p) => p.classList.toggle('active', p.dataset.page === name));
    if (isMobile) $('#panel').classList.add('open');
  }
  document.querySelectorAll('.tab').forEach((t) => (t.onclick = () => showTab(t.dataset.tab)));
  $('#panelHandle').onclick = () => $('#panel').classList.toggle('open');

  // top buttons
  $('#btnTheme').onclick = () => setTheme(state.theme === 'dark' ? 'light' : 'dark');
  $('#btnFull').onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.());
  function screenshot() {
    composer.render();
    const a = document.createElement('a');
    a.download = 'optimus.png';
    a.href = renderer.domElement.toDataURL('image/png');
    a.click();
  }
  $('#btnShot').onclick = screenshot;
  $('#btnResetCam').onclick = () => resetView();
  $('#btnFront').onclick = () => resetView('front');
  $('#btnSide').onclick = () => resetView('side');
  $('#btnBack').onclick = () => resetView('back');

  // keyboard
  addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
    const k = e.key.toLowerCase();
    if (k >= '1' && k <= String(presetKeys.length)) setPreset(presetKeys[+k - 1]);
    else if (k === 'j') { setPreset('manual'); showTab('joints'); }
    else if (k === 'r') toggle('auto');
    else if (k === 'e') toggle('explode');
    else if (k === 'x') toggle('xray');
    else if (k === 'w') toggle('wire');
    else if (k === 't') setTheme(state.theme === 'dark' ? 'light' : 'dark');
    else if (k === 'f') $('#btnFull').click();
    else if (k === 'p') screenshot();
    else if (k === 'escape') { select(null); resetView(); }
  });

  let hintHidden = false;
  function hideHint() { if (!hintHidden) { hintHidden = true; $('#hint').classList.add('hide'); } }
  setTimeout(hideHint, 9000);

  // resize
  function onResize() {
    camera.aspect = innerWidth / innerHeight;
    if (innerWidth > 720) camera.setViewOffset(innerWidth, innerHeight, -Math.min(176, innerWidth * 0.12), 0, innerWidth, innerHeight);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
    composer.setSize(innerWidth, innerHeight);
    bloom.resolution.set(innerWidth / 2, innerHeight / 2);
  }
  addEventListener('resize', onResize);
  onResize();

  // url params for demos / screenshots
  if (params.get('preset') && (PRESETS[params.get('preset')])) setPreset(params.get('preset'));
  if (params.has('t')) state.t = +params.get('t');
  if (params.has('xray')) toggle('xray');
  if (params.has('explode')) toggle('explode');
  if (params.has('part')) setTimeout(() => select(params.get('part')), 300);
  if (params.has('cam')) {
    const [x, y, z, tx, ty, tz] = params.get('cam').split(',').map(Number);
    camera.position.set(x, y, z); controls.target.set(tx, ty, tz); controls.update();
  }
  if (params.has('hidepanel')) document.body.classList.add('clean');

  await progress(92, 'Calibrating joints…');
  // ==================================================================
  // Loop
  const clock = new THREE.Clock();
  let frames = 0, fpsT = 0, frameCount = 0;
  const target = {};
  const freezeTime = params.has('freeze');
  function tick() {
    const dt = Math.min(clock.getDelta(), 0.05);
    if (!freezeTime) state.t += dt * state.speed;

    // pose
    if (state.preset === 'manual') Object.assign(target, state.manual);
    else Object.assign(target, PRESETS[state.preset].fn(state.t));
    const w = easeInOut(Math.min(1, (state.t - state.switchT) / (0.7 * Math.max(state.speed, 0.5))));
    lerpPose(state.from, target, w, state.pose);
    robot.applyPose(state.pose);

    state.explode += (state.explodeTarget - state.explode) * (1 - Math.exp(-dt * 6));
    robot.setExplode(state.explode);

    const eggTarget = state.preset === 'grip' ? 1 : 0;
    state.eggVis += (eggTarget - state.eggVis) * (1 - Math.exp(-dt * 5));
    robot.egg.visible = state.eggVis > 0.02;
    robot.egg.scale.set(0.0215, 0.029, 0.0215).multiplyScalar(Math.max(0.001, state.eggVis));

    // camera tween
    if (state.camAnim) {
      const a = state.camAnim;
      const k = Math.min(1, (performance.now() - a.start) / a.dur);
      const e = easeInOut(k);
      camera.position.lerpVectors(a.p0, a.p1, e);
      controls.target.lerpVectors(a.t0, a.t1, e);
      if (k >= 1) state.camAnim = null;
    }
    controls.update();

    // keep the selection camera target following animated parts gently
    composer.render();

    if (++frameCount % 4 === 0) syncSliders();
    frames++; fpsT += dt;
    if (fpsT > 0.5) { $('#fps').textContent = Math.round(frames / fpsT) + ' fps'; frames = 0; fpsT = 0; }
    requestAnimationFrame(tick);
  }
  composer.render();
  await progress(100, 'Ready');
  requestAnimationFrame(tick);
  setTimeout(() => $('#loader').classList.add('done'), 250);
  window.__optimus = { state, camera, controls, robot, select, setPreset };
}

init().catch((err) => {
  console.error(err);
  $('#loadtext').textContent = 'WebGL failed to start: ' + err.message;
});

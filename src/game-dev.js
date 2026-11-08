(() => {
"use strict";
const $ = (id) => document.getElementById(id);
if (!window.THREE) { $("err").hidden = false; return; }
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const LOW = coarse || Math.min(innerWidth, innerHeight) < 600;   // утас: хөнгөн чанар
const F = DATA.features;

// ---------- Бодит өндөр (SRTM 30 м) ----------
function gridH(G, x, z) {
  const s = G.size, n = G.n, fx = (x + s / 2) / s * (n - 1), fz = (z + s / 2) / s * (n - 1);
  const i = Math.floor(fx), j = Math.floor(fz), tx = fx - i, tz = fz - j;
  const at = (a, b) => G.h[Math.min(n - 1, Math.max(0, b)) * n + Math.min(n - 1, Math.max(0, a))];
  const cr = (p0, p1, p2, p3, t) => p1 + .5 * t * (p2 - p0 + t * (2 * p0 - 5 * p1 + 4 * p2 - p3 + t * (3 * (p1 - p2) + p3 - p0)));
  const row = (b) => cr(at(i - 1, b), at(i, b), at(i + 1, b), at(i + 2, b), tx);
  return cr(row(j - 1), row(j), row(j + 1), row(j + 2), tz);
}
const NEAR = DATA.near2, HALF = NEAR.size / 2;
const BASE = gridH(NEAR, 0, 0);
function heightAt(x, z) {
  const ax = Math.max(Math.abs(x), Math.abs(z)), hf = gridH(DATA.far, x, z);
  if (ax >= HALF) return hf - BASE;
  const hn = gridH(NEAR, x, z), k = ax < HALF - 60 ? 1 : (HALF - ax) / 60;
  return hn * k + hf * (1 - k) - BASE;
}
$("coords").textContent = `${DATA.center.lat}° N · ${DATA.center.lon}° E · ${Math.round(BASE)} м`;

// ---------- Газрын зургийн туслах ----------
const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const segDist = (x, z, pts) => { let b = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); b = Math.min(b, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return b; };
const fieldAt = (x, z) => F.fields.find((f) => inPoly(x, z, f.pts));

// ---------- Рендер ----------
let renderer;
try { renderer = new THREE.WebGLRenderer({ canvas: $("scene"), antialias: true }); }
catch { $("err").hidden = false; return; }
renderer.setPixelRatio(Math.min(LOW ? 1.5 : 2, window.devicePixelRatio || 1));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog("#d6cfb8", 450, 3400);
const camera = new THREE.PerspectiveCamera(55, 1, .2, 9000);
const lin = (c) => new THREE.Color(c).convertSRGBToLinear();
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color: lin(color), roughness: .9, ...o });

const skyU = { top: { value: new THREE.Color("#4d7fc0") }, bottom: { value: new THREE.Color("#e3dcc4") } };
scene.add(new THREE.Mesh(new THREE.SphereGeometry(6000, 32, 16), new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false, fog: false,
  uniforms: skyU,
  vertexShader: "varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
  fragmentShader: "uniform vec3 top; uniform vec3 bottom; varying vec3 vP; void main(){ float h = clamp(vP.y * 2.2 + .04, 0.0, 1.0); gl_FragColor = vec4(mix(bottom, top, pow(h, .6)), 1.0); }",
})));
const hemi = new THREE.HemisphereLight("#dfeaff", "#6b5a3a", .55); scene.add(hemi);
const sun = new THREE.DirectionalLight("#ffe2b8", 1.35);
const SUN_OFF = new THREE.Vector3(-90, 75, 45);
sun.castShadow = true; sun.shadow.mapSize.set(LOW ? 1024 : 2048, LOW ? 1024 : 2048);
Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 320 });
sun.shadow.bias = -.0006;
scene.add(sun, sun.target);

// ---------- Газрын гадарга ----------
const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
const vnoise = (x, z) => {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi, u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const h = (a, b) => hash(a * 57 + b * 131);
  return (h(xi, zi) * (1 - u) + h(xi + 1, zi) * u) * (1 - v) + (h(xi, zi + 1) * (1 - u) + h(xi + 1, zi + 1) * u) * v;
};
const C = {
  lush: new THREE.Color("#6f8f3e"), dry: new THREE.Color("#a6a058"), steep: new THREE.Color("#b49f72"), north: new THREE.Color("#5a7c38"),
  wheat: new THREE.Color("#cdb47e"), wheatD: new THREE.Color("#a98f5c"), crop: new THREE.Color("#3f5f2a"), cropD: new THREE.Color("#2f4a20"),
  buuts: new THREE.Color("#4e4030"), wet: new THREE.Color("#4d7a33"), forest: new THREE.Color("#4a6a30"), far: new THREE.Color("#7f8a5a"),
};
// ойн нүдний хурдан хайлт (10 м)
const forestCell = new Set();
for (const [x, z] of F.trees) forestCell.add(Math.floor(x / 10) + "," + Math.floor(z / 10));
function groundColor(x, z, c, near) {
  const e = 4, dx = heightAt(x + e, z) - heightAt(x - e, z), dz = heightAt(x, z + e) - heightAt(x, z - e);
  const slope = Math.min(1, Math.hypot(dx, dz) / (2 * e) * 2.4);
  const northFacing = Math.max(0, dz / (2 * e)) * 4;
  const n = vnoise(x * .02, z * .02) * .6 + vnoise(x * .11, z * .11) * .4;
  c.copy(C.lush).lerp(C.dry, n * .8).lerp(C.north, Math.min(.6, northFacing)).lerp(C.steep, Math.max(0, slope - .25) * .9);
  const f = fieldAt(x, z);
  if (f) {
    const stripe = (Math.sin(x / 1.6) * .5 + .5) * .7 + n * .3;
    c.copy(f.crop === "green" ? C.crop : C.wheat).lerp(f.crop === "green" ? C.cropD : C.wheatD, stripe);
  } else {
    if (forestCell.has(Math.floor(x / 10) + "," + Math.floor(z / 10))) c.lerp(C.forest, .55);
    for (const cr of F.creeks) { const d = segDist(x, z, cr.pts); if (d < 14) c.lerp(C.wet, (1 - d / 14) * .6); }
    for (const cp of F.camps) { const d = Math.hypot(x - cp.x, z - cp.z); if (d < cp.r) c.lerp(C.buuts, Math.min(.85, (1 - d / cp.r) * 1.6)); }
  }
  if (!near) c.lerp(C.far, .3);
  return c.convertSRGBToLinear();
}
function terrainMesh(size, seg, sink, near) {
  const g = new THREE.PlaneGeometry(size, size, seg, seg); g.rotateX(-Math.PI / 2);
  const p = g.attributes.position, cols = new Float32Array(p.count * 3), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i);
    let y = heightAt(x, z);
    if (sink && Math.max(Math.abs(x), Math.abs(z)) < HALF - 8) y -= 5;
    p.setY(i, y);
    groundColor(x, z, c, near || Math.max(Math.abs(x), Math.abs(z)) < HALF);
    cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }));
  m.receiveShadow = near;
  return m;
}
scene.add(terrainMesh(NEAR.size, 300, false, true));
scene.add(terrainMesh(DATA.far.size, 170, true, false));

// туузан зам/горхи: газрын дагуу
function ribbon(pts, width, mat, lift, step = 4) {
  const pos = [], idx = [];
  for (let k = 0; k < pts.length - 1; k++) {
    const [x0, z0] = pts[k], [x1, z1] = pts[k + 1];
    const len = Math.hypot(x1 - x0, z1 - z0); if (!len) continue;
    const nx = -(z1 - z0) / len, nz = (x1 - x0) / len, steps = Math.max(1, Math.ceil(len / step));
    for (let s = 0; s < steps; s++) {
      const b = pos.length / 3;
      for (const t of [s / steps, (s + 1) / steps]) {
        const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
        for (const side of [-1, 1]) { const px = x + nx * width / 2 * side, pz = z + nz * width / 2 * side; pos.push(px, heightAt(px, pz) + lift, pz); }
      }
      idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  mat.side = THREE.DoubleSide; mat.polygonOffset = true; mat.polygonOffsetFactor = -3;
  const m = new THREE.Mesh(g, mat); m.receiveShadow = true; scene.add(m); return m;
}
if (DATA.road && DATA.road.length > 1) ribbon(DATA.road, 9, std("#6d6a63", { roughness: .95 }), .3, 8);
for (const t of F.tracks) ribbon(t, 3, std("#a89878", { roughness: 1 }), .12);
for (const cr of F.creeks) {
  if (cr.kind === "main") { ribbon(cr.pts, 5, std("#5d5440", { roughness: 1 }), .1); ribbon(cr.pts, 2.6, std("#3d5f73", { roughness: .15, metalness: .2 }), .22); }
  else ribbon(cr.pts, 1.2, std("#4a5536", { roughness: 1 }), .08);
}

// ---------- Ой мод (хиймэл дагуулаас) ----------
{
  const N = F.trees.length;
  const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .2, 1, 6), std("#5a4632"), N);
  const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 1, 7), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .95, flatShading: true }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
  F.trees.forEach(([x, z], i) => {
    const h = 7 + hash(i * 3.1) * 7, y = heightAt(x, z);
    m.compose(v.set(x, y + h * .2, z), q.setFromAxisAngle(up, hash(i) * 6), s.set(1, h * .4, 1)); trunk.setMatrixAt(i, m);
    m.compose(v.set(x, y + h * .58, z), q, s.set(h * .17, h * .78, h * .17)); crown.setMatrixAt(i, m);
    crown.setColorAt(i, col.setHSL(.27 + hash(i * 7) * .06, .38, .17 + hash(i * 5) * .08).convertSRGBToLinear());
  });
  trunk.castShadow = crown.castShadow = true; crown.receiveShadow = true;
  scene.add(trunk, crown);
}

// өвсний бут
{
  const N = reduceMotion || LOW ? 3000 : 9000;
  const im = new THREE.InstancedMesh(new THREE.ConeGeometry(.18, .5, 5), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1 }), N);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color();
  let i = 0;
  while (i < N) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 600, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (fieldAt(x, z)) continue;
    const k = .6 + Math.random() * 1.2;
    m.compose(v.set(x, heightAt(x, z) + .1, z), q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), s.set(k, k * (.6 + Math.random() * .8), k));
    im.setMatrixAt(i, m); im.setColorAt(i, col.setHSL(.2 + Math.random() * .06, .35 + Math.random() * .2, .3 + Math.random() * .12).convertSRGBToLinear());
    i++;
  }
  scene.add(im);
}

// ---------- Туслах дүрсүүд ----------
const SPH = new THREE.SphereGeometry(.5, 12, 9), WOOL = new THREE.IcosahedronGeometry(.5, 1);
const CYL = new THREE.CylinderGeometry(.5, .5, 1, 7), CONE = new THREE.ConeGeometry(.5, 1, 7), BOX = new THREE.BoxGeometry(1, 1, 1);
const Yv = new THREE.Vector3(0, 1, 0);
function beam(mat, a, b, t) {
  const d = b.clone().sub(a), len = d.length(), m = new THREE.Mesh(CYL, mat);
  m.position.copy(a).add(b).multiplyScalar(.5); m.quaternion.setFromUnitVectors(Yv, d.normalize()); m.scale.set(t, len, t); m.castShadow = true; return m;
}
function canvasTex(w, h, draw, rx = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; if (rx !== 1) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = rx; } return t;
}
function meander(g, x0, y0, len, size, color) {
  g.strokeStyle = color; g.lineWidth = size * .14;
  for (let x = x0; x < x0 + len; x += size) { const s = size * .8; g.beginPath(); g.moveTo(x, y0 + s); g.lineTo(x, y0); g.lineTo(x + s, y0); g.lineTo(x + s, y0 + s * .7); g.lineTo(x + s * .35, y0 + s * .7); g.lineTo(x + s * .35, y0 + s * .35); g.stroke(); }
}

// ---------- Чулуун овоо, ганц модод ----------
if (F.landmarks) {
  const [ox, oz] = F.landmarks.ovoo, oy = heightAt(ox, oz);
  const stone = new THREE.MeshStandardMaterial({ color: lin("#8f8b83"), roughness: 1, flatShading: true });
  const pile = new THREE.Mesh(new THREE.ConeGeometry(1.5, 1.9, 9), stone); pile.position.set(ox, oy + .85, oz); pile.castShadow = true; scene.add(pile);
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4, r = .6 + (i % 4) * .3, s = new THREE.Mesh(new THREE.IcosahedronGeometry(.28 + (i % 3) * .08, 0), stone);
    s.position.set(ox + Math.cos(a) * r, oy + .2 + (3 - i % 4) * .35, oz + Math.sin(a) * r); s.rotation.set(i, i * 2, 0); s.castShadow = true; scene.add(s);
  }
  scene.add(beam(std("#7a5a3a"), new THREE.Vector3(ox, oy + .5, oz), new THREE.Vector3(ox, oy + 3.4, oz), .09));
  const khadag = new THREE.Mesh(new THREE.PlaneGeometry(.25, 1.2), std("#3b7fd0", { side: THREE.DoubleSide }));
  khadag.position.set(ox + .14, oy + 2.75, oz); khadag.rotation.set(0, .4, .15); scene.add(khadag);
  for (const [x, z] of F.landmarks.trees) {
    const y = heightAt(x, z), h = 13;
    const tr = new THREE.Mesh(CYL, std("#5a4632")); tr.scale.set(.45, h * .45, .45); tr.position.set(x, y + h * .22, z); tr.castShadow = true;
    const cr = new THREE.Mesh(new THREE.ConeGeometry(h * .2, h * .75, 8), std("#3e5f2a", { flatShading: true })); cr.position.set(x, y + h * .6, z); cr.castShadow = true;
    scene.add(tr, cr);
  }
}

// ---------- Гэрүүд ----------
const GR = 3.2;
const feltT = canvasTex(512, 256, (c, w, h) => { c.fillStyle = "#f4efe3"; c.fillRect(0, 0, w, h); c.fillStyle = "#2f5c99"; c.fillRect(0, h - 30, w, 30); meander(c, 4, h - 26, w, 22, "#f4efe3"); }, 8);
const roofT = canvasTex(512, 256, (c, w, h) => { c.fillStyle = "#f6f2e8"; c.fillRect(0, 0, w, h); c.fillStyle = "#2f5c99"; c.fillRect(0, h - 46, w, 46); meander(c, 6, h - 38, w, 26, "#f6f2e8"); c.fillStyle = "#c33a2a"; c.fillRect(0, h - 50, w, 5); }, 10);
const gerMats = { wall: new THREE.MeshStandardMaterial({ map: feltT, roughness: .95 }), roof: new THREE.MeshStandardMaterial({ map: roofT, roughness: .9 }), wood: std("#cf6528"), door: std("#d4692a", { roughness: .6 }), iron: std("#2a2b2e", { metalness: .5, roughness: .5 }), rope: std("#5a3a22") };
const gers = [], chimneys = [];
function makeGer(x, z) {
  const y = Math.min(heightAt(x, z), heightAt(x + 2, z), heightAt(x - 2, z), heightAt(x, z + 2), heightAt(x, z - 2));
  const g = new THREE.Group(); g.position.set(x, y, z);
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(GR, GR, 3, 48, 1, true), gerMats.wall); wall.position.y = 0; wall.castShadow = wall.receiveShadow = true;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(.75, GR + .22, 1.5, 48, 1, true), gerMats.roof); top.position.y = 2.2; top.castShadow = true;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(.75, .75, .1, 20), gerMats.wood); cap.position.y = 2.98;
  const door = new THREE.Mesh(BOX, gerMats.door); door.scale.set(.85, 1.3, .1); door.position.set(0, .65 + Math.max(0, heightAt(x, z + GR) - y), GR + .02);
  const pipe = new THREE.Mesh(CYL, gerMats.iron); pipe.scale.set(.13, 1.2, .13); pipe.position.set(0, 3.3, -.1);
  for (const yy of [.4, .9, 1.3]) { const b = new THREE.Mesh(new THREE.CylinderGeometry(GR + .02, GR + .02, .05, 48, 1, true), gerMats.rope); b.position.y = yy; g.add(b); }
  g.add(wall, top, cap, door, pipe); scene.add(g);
  gers.push({ x, z }); chimneys.push(new THREE.Vector3(x, y + 3.9, z - .1));
}
for (const cp of F.camps) for (const [x, z] of cp.gers) makeGer(x, z);

const smoke = [];
{
  const tex = canvasTex(64, 64, (c) => { const r = c.createRadialGradient(32, 32, 0, 32, 32, 32); r.addColorStop(0, "rgba(255,255,255,.9)"); r.addColorStop(1, "rgba(255,255,255,0)"); c.fillStyle = r; c.fillRect(0, 0, 64, 64); });
  chimneys.forEach((ch, ci) => { for (let i = 0; i < 12; i++) { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: "#ddd8cf", transparent: true, depthWrite: false, opacity: 0 })); s.userData = { t: Math.random() * 5, ch }; smoke.push(s); scene.add(s); } });
}

// ---------- Өвөлжөөний хашаа (хонь | тугал-үхэр) ба адууны хашаа ----------
const OUTER = { x: -25, z: 30, w: 40, d: 26 };
const PENS = {
  sheep: { x: -32, z: 30, w: 26, d: 26, gate: 5, outer: OUTER },
  cow:   { x: -12, z: 30, w: 14, d: 26, gate: 4, outer: OUTER },
  horse: { x: 135, z: 40, w: 30, d: 22, gate: 6 },
};
PENS.horse.outer = PENS.horse;
for (const p of Object.values(PENS)) p.S = p.z + p.d / 2;      // урд хана (хаалгатай)
const inPenP = (p, x, z, m = 0) => Math.abs(x - p.x) < p.w / 2 - m && Math.abs(z - p.z) < p.d / 2 - m;
const H = PENS.sheep, H_S = H.S, CP = PENS.cow;
const inPen = (x, z, m = 0) => inPenP(H, x, z, m);
// хашаа руу орох / гарах зам: урдаас бол хаалгаар, хажуу ардаас бол тойрч
function penRoute(a, p, enter) {
  const o = p.outer, inside = inPenP(p, a.x, a.z, -.3);   // мөргөлдөөний хилтэй ижил
  if (enter) {
    if (inside) return null;
    if (a.z > p.S - .6) {   // урд талд
      if (Math.abs(a.x - p.x) < p.gate / 2 - .6) return [p.x, p.z];                       // хаалганы яг өмнө: дотогш
      if (a.z < p.S + 2.5) return [a.x + Math.sign(p.x - a.x) * .8, p.S + 4.5];           // эхлээд хананаас холдоно
      return [p.x, p.S + 3.5];
    }
    const side = a.x < o.x ? -1 : 1, cx = o.x + side * (o.w / 2 + 3.5);
    return Math.abs(a.x - o.x) < o.w / 2 + 2.5 ? [cx, a.z] : [cx, p.S + 4];
  }
  if (!inside) return null;
  return Math.abs(a.x - p.x) < p.gate / 2 - .6 && a.z > p.S - 4 ? [p.x, p.S + 5] : [p.x, p.S - 2];
}
{
  const wood = std("#8a6a48", { roughness: .95 }), P3 = (x, z, y) => new THREE.Vector3(x, heightAt(x, z) + y, z);
  const fenceLine = (x0, z0, x1, z1, gates) => {
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 1.8);
    for (let i = 0; i <= n; i++) {
      const x = x0 + (x1 - x0) * i / n, z = z0 + (z1 - z0) * i / n;
      scene.add(beam(wood, P3(x, z, -.4), P3(x, z, 1.5), .14));
      if (i < n) {
        const xb = x0 + (x1 - x0) * (i + 1) / n, zb = z0 + (z1 - z0) * (i + 1) / n, mx = (x + xb) / 2, mz = (z + zb) / 2;
        if (gates.some(([gx, gz, gw]) => Math.hypot(mx - gx, mz - gz) < gw / 2)) continue;
        for (const y of [.45, .95, 1.4]) scene.add(beam(wood, P3(x, z, y), P3(xb, zb, y), .09));
      }
    }
  };
  const fenceRect = (r, gates) => {
    const x0 = r.x - r.w / 2, x1 = r.x + r.w / 2, z0 = r.z - r.d / 2, z1 = r.z + r.d / 2;
    fenceLine(x0, z1, x1, z1, gates); fenceLine(x1, z1, x1, z0, gates); fenceLine(x1, z0, x0, z0, gates); fenceLine(x0, z0, x0, z1, gates);
  };
  fenceRect(OUTER, [[PENS.sheep.x, PENS.sheep.S, PENS.sheep.gate], [PENS.cow.x, PENS.cow.S, PENS.cow.gate]]);
  const dvx = PENS.sheep.x + PENS.sheep.w / 2;
  fenceLine(dvx, OUTER.z - OUTER.d / 2, dvx, OUTER.z + OUTER.d / 2, []);                 // дундах хуваалт
  // урт саравч хойд хананы дагуу
  const roof = std("#6e5438", { roughness: 1 }), hz = OUTER.d / 2, by = heightAt(OUTER.x, OUTER.z - hz);
  const back = new THREE.Mesh(BOX, wood); back.scale.set(OUTER.w, 2.2, .2); back.position.set(OUTER.x, by + .9, OUTER.z - hz); back.castShadow = true;
  const rf = new THREE.Mesh(BOX, roof); rf.scale.set(OUTER.w + .6, .14, 5.5); rf.position.set(OUTER.x, by + 2.0, OUTER.z - hz + 2.5); rf.rotation.x = .22; rf.castShadow = rf.receiveShadow = true;
  scene.add(back, rf);
  for (let x = OUTER.x - OUTER.w / 2 + 1; x <= OUTER.x + OUTER.w / 2 - 1; x += 4.5) scene.add(beam(wood, P3(x, OUTER.z - hz + 5, -.3), P3(x, OUTER.z - hz + 5, 1.5), .16));
  // адууны хашаа
  fenceRect(PENS.horse, [[PENS.horse.x, PENS.horse.S, PENS.horse.gate]]);
  // өвс тэжээлийн овоо
  for (const [ox, oz] of [[3, 22], [3, 31]]) {
    const y = heightAt(ox, oz), st = new THREE.Mesh(SPH, std("#c9b073", { roughness: 1 }));
    st.scale.set(4, 3.2, 3); st.position.set(ox, y + .9, oz); st.castShadow = true; scene.add(st);
  }
}

// ---------- Олон тоот мал (InstancedMesh) ----------
const SPECS = {
  horse: { len: 1.45, bh: .6, w: .48, leg: .78, legR: .065, neck: .8, neckAng: .85, head: [.6, .25, .22], speed: 1.2 },
  cow:   { len: 1.6, bh: .78, w: .68, leg: .6, legR: .085, neck: .4, neckAng: 1.05, head: [.48, .3, .28], speed: .7 },
  sheep: { len: .92, bh: .55, w: .55, leg: .36, legR: .045, neck: .24, neckAng: .85, head: [.32, .19, .17], speed: .5 },
  goat:  { len: .82, bh: .42, w: .34, leg: .46, legR: .04, neck: .32, neckAng: .45, head: [.3, .16, .13], speed: .6 },
};
const PAL = {
  horse: [
    { body: "#c08a4a", mane: "#d9b27a", leg: "#9a6a38" }, { body: "#b97f42", mane: "#caa06a" }, { body: "#c99456", mane: "#e0c08a", leg: "#a8763e" }, { body: "#ad7438", mane: "#c79a62" },   // хонгор
    { body: "#c9a86a", mane: "#231a12", leg: "#3a2a1c" }, { body: "#bf9c5e", mane: "#2a2018", leg: "#3a2a1c" }, { body: "#d2b47a", mane: "#1f1610", leg: "#4a3624" },  // хул
    { body: "#5e3420", mane: "#3a2014", leg: "#3a2014" }, { body: "#6a3a22", mane: "#2e1a10" }, { body: "#553019", mane: "#2a160c", leg: "#2a160c" },  // хүрэн
    { body: "#8a4b2a", mane: "#16100b", leg: "#16100b" },   // хээр
    { body: "#bdb8ae", mane: "#e6e2da" },                       // саарал
  ],
  stallion: [{ body: "#8a4a28", mane: "#120c08", leg: "#16100b" }],   // хээр азарга, хар дэл сүүл
  cow: [
    { body: "#8b3a1e", pat: ["shL", "hipR", "belly"] }, { body: "#8b3a1e", pat: ["shR", "hipL", "belly", "face"] }, { body: "#963f1f", pat: ["shL", "shR", "belly"] },   // улаан алаг
    { body: "#1d1a18", pat: ["shL", "hipR", "belly"] }, { body: "#1d1a18", pat: ["shR", "hipL", "belly", "face"] }, { body: "#221e1b", pat: ["hipL", "hipR", "belly"] },  // хар алаг
    { body: "#1d1a18", pat: ["belt"] }, { body: "#7a3219", pat: ["belt", "face"] },                                                                                   // бүслүүр алаг
    { body: "#8b3a1e", pat: ["face"] }, { body: "#933f20", pat: ["face", "belly"] },                                                                                  // улаан халзан
    { body: "#5a3420" },                                                                                                                                             // хүрэн
  ],
  sheep: [{ body: "#efe8d8", head: "#2a2420", leg: "#cfc5b2" }, { body: "#efe8d8", head: "#5a3a24", leg: "#cfc5b2" }, { body: "#e8e0cc", head: "#e8e0cc", leg: "#cfc5b2" }, { body: "#ece4d2", head: "#1e1a17", leg: "#cfc5b2" }],
  // ямаа: ихэвчлэн бор, шаргал; цөөн хар (давтамжаар жинлэсэн)
  goat: [
    { body: "#7d5636", leg: "#4a3322" }, { body: "#8a6440", head: "#5a3e26" }, { body: "#6e4a2e" },
    { body: "#b8864f", head: "#8a6440" }, { body: "#c9a46a", leg: "#8a6a44" }, { body: "#a97a48" }, { body: "#d1ad74", head: "#a07a4c" },
    { body: "#2e2621" },
  ],
};
const LEGS = [[.3, .26, 0], [.3, -.26, Math.PI], [-.3, .26, Math.PI], [-.3, -.26, 0]];
function buildRig(kind, opt = {}) {
  const S = SPECS[kind], root = new THREE.Object3D(), d = {};
  const node = (parent, x = 0, y = 0, z = 0) => { const o = new THREE.Object3D(); o.position.set(x, y, z); parent.add(o); return o; };
  const bodyY = S.leg + S.bh * .32;
  d.body = node(root, 0, bodyY, 0); d.body.scale.set(S.len, S.bh, S.w);
  d.legPiv = []; d.legs = [];
  for (const [fx, fz, ph] of LEGS) { const p = node(root, S.len * fx, S.leg + .02, S.w * fz); p.userData.ph = ph; const l = node(p, 0, -S.leg / 2, 0); l.scale.set(S.legR * 2, S.leg, S.legR * 2); d.legPiv.push(p); d.legs.push(l); }
  d.neckPiv = node(root, S.len * .4, bodyY + S.bh * .18, 0);
  d.neck = node(d.neckPiv, 0, S.neck / 2, 0); d.neck.scale.set(S.head[2] * 1.3, S.neck + .1, S.head[2] * 1.2);
  const hp = node(d.neckPiv, 0, S.neck, 0); hp.rotation.z = S.neckAng - .3;
  d.head = node(hp, S.head[0] * .35, 0, 0); d.head.scale.set(S.head[0], S.head[1], S.head[2]);
  d.tailPiv = node(root, -S.len * .48, bodyY + S.bh * .15, 0);
  if (kind === "sheep") { d.tail = node(d.tailPiv, -.02, -.12, 0); d.tail.scale.set(.32, .3, .34); }
  else { d.tailBase = kind === "horse" ? -.25 : -.15; d.tail = node(d.tailPiv, -.05, -.35, 0); d.tail.scale.set(kind === "horse" ? .1 : .05, kind === "horse" ? .75 : .7, kind === "horse" ? .1 : .05); }
  if (kind === "horse") {
    d.mane = node(d.neckPiv, -S.head[2] * (opt.stallion ? .62 : .5), S.neck / 2 + (opt.stallion ? -.04 : .02), 0);
    d.mane.scale.set(opt.stallion ? .2 : .08, S.neck + (opt.stallion ? .45 : .15), opt.stallion ? .17 : .1);   // азарганы урт өтгөн дэл
    if (opt.stallion) {
      d.tail.scale.set(.15, 1.05, .15); d.tail.position.set(-.07, -.5, 0);
      // хүзүүний хоёр талаар урт унжсан дэл (оройгоос хүзүүний доод захаас доош)
      d.maneSides = [1, -1].map((s) => {
        const m = node(d.neckPiv, .1, S.neck / 2 - .02, s * .13);
        m.scale.set(.62, S.neck + .4, .06); m.rotation.x = s * .12;
        return m;
      });
      d.forelock = node(d.neckPiv, .05, S.neck + .12, 0); d.forelock.scale.set(.22, .3, .14);   // хөхөл
    }
  }
  if (kind === "cow") {
    d.horns = [1, -1].map((s) => { const h = node(hp, .05 + S.head[0] * .1, S.head[1] * .5, s * .16); h.rotation.x = s * -.9; h.scale.set(.06, .22, .06); return h; });
    d.patches = {};
    const PT = (name, parent, x, y, z, sx, sy, sz) => { const n = node(parent, x, y, z); n.scale.set(sx, sy, sz); d.patches[name] = n; };
    PT("belt", root, 0, bodyY, 0, S.len * .32, S.bh * 1.05, S.w * 1.05);                          // бүслүүр
    PT("shL", root, S.len * .22, bodyY + .04, S.w * .3, .55, .5, .26); PT("shR", root, S.len * .22, bodyY + .04, -S.w * .3, .55, .5, .26);
    PT("hipL", root, -S.len * .26, bodyY + .08, S.w * .28, .5, .45, .28); PT("hipR", root, -S.len * .26, bodyY + .08, -S.w * .28, .5, .45, .28);
    PT("belly", root, 0, bodyY - S.bh * .28, 0, S.len * .62, S.bh * .42, S.w * .92);
    PT("face", hp, S.head[0] * .5, .03, 0, S.head[0] * .72, S.head[1] * .8, S.head[2] * 1.06);   // халзан
  }
  if (kind === "goat") {
    d.horns = [1, -1].map((s) => { const h = node(hp, -.02 + S.head[0] * .1, S.head[1] * .7, s * .05); h.rotation.z = .9; h.scale.set(.05, .3, .05); return h; });
    d.beard = node(hp, S.head[0] * .75, -S.head[1] * .7, 0); d.beard.scale.set(.05, .12, .05);
    d.tailPiv.rotation.z = .6; d.tailBase = .6; d.tail.position.set(0, .06, 0); d.tail.scale.set(.05, .14, .05);
  }
  return { root, d, S };
}
const GRAZE = -(Math.PI / 2 + .7);
function makeHerd(kind, count, spawn, youngFrac = .3, youngScale = .58, opt = {}) {
  const rig = buildRig(kind, opt), d = rig.d, parts = [];
  const add = (geo, flat, nodes, key) => {
    const im = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .9, flatShading: flat }), count * nodes.length);
    im.castShadow = true; im.frustumCulled = false; scene.add(im); parts.push({ im, nodes, key });
  };
  add(kind === "sheep" ? WOOL : SPH, kind === "sheep", [d.body], "body");
  add(CYL, false, d.legs, "leg");
  add(kind === "sheep" ? SPH : CYL, false, [d.neck], kind === "sheep" ? "body" : "head");
  add(SPH, false, [d.head], "head");
  add(kind === "sheep" ? SPH : CYL, false, [d.tail], kind === "sheep" ? "body" : kind === "horse" ? "mane" : "leg");
  if (d.mane) add(SPH, false, [d.mane], "mane");
  if (d.maneSides) add(SPH, false, d.maneSides.concat(d.forelock), "mane");
  if (d.horns) add(CONE, false, d.horns, "horn");
  if (d.beard) add(CONE, false, [d.beard], "head");
  if (d.patches) for (const [name, n] of Object.entries(d.patches)) { add(SPH, false, [n], "patch"); parts[parts.length - 1].patch = name; }
  const animals = [], col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const pl = PAL[opt.pal || kind], pal = pl[Math.floor(Math.random() * pl.length)];
    const p = spawn(i);
    animals.push({ x: p.x, z: p.z, yaw: Math.random() * 6.28, vx: 0, vz: 0, phase: Math.random() * 6, neck: GRAZE, speed: 0, wx: 0, wz: 0, wt: Math.random() * 4, penned: false, state: "graze", timer: Math.random() * 8, tx: 0, tz: 0, young: i < Math.round(count * youngFrac), scale: i < Math.round(count * youngFrac) ? youngScale * (.9 + Math.random() * .2) : (opt.scale || .92 + Math.random() * .16), baseNeck: -rig.S.neckAng, pat: new Set(pal.pat || []) });
    for (const pt of parts) for (let k = 0; k < pt.nodes.length; k++) {
      const c = pt.key === "patch" ? "#efebe2" : pal[pt.key] || (pt.key === "horn" ? (kind === "goat" ? "#4a4038" : "#e8e0cc") : pt.key === "mane" ? "#1f1712" : pal.body);
      pt.im.setColorAt(i * pt.nodes.length + k, col.set(c).convertSRGBToLinear());
    }
  }
  const adults = animals.filter((a) => !a.young);
  if (adults.length) for (const a of animals) if (a.young) {
    a.mother = adults[Math.floor(Math.random() * adults.length)]; a.offS = (Math.random() - .5) * 1.2;
    a.x = a.mother.x - 1.2 + Math.random() * .4; a.z = a.mother.z + (Math.random() - .5);
  }
  return { kind, rig, parts, animals, S: rig.S };
}
let frameNo = 0;
const ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
function poseHerd(h, t) {
  const { rig, parts, animals, S } = h, d = rig.d, cx = camera.position.x, cz = camera.position.z;
  for (let i = 0; i < animals.length; i++) {
    const a = animals[i];
    if ((a.x - cx) ** 2 + (a.z - cz) ** 2 > 260 * 260 && (i + frameNo) % 6) continue;
    rig.root.position.set(a.x, heightAt(a.x, a.z), a.z); rig.root.rotation.set(0, a.yaw, 0); rig.root.scale.setScalar(a.scale);
    if (a.rear > .01) { rig.root.rotateZ(a.rear); rig.root.position.y += a.rear * .5; }
    const sw = a.speed > .08 ? Math.min(.7, .3 + a.speed * .08) : 0;
    for (const p of d.legPiv) p.rotation.z = sw ? Math.sin(a.phase + p.userData.ph) * sw : 0;
    d.neckPiv.rotation.z = a.neck;
    d.tailPiv.rotation.set(Math.sin(t * 2.5 + a.phase) * .25, 0, d.tailBase || 0);
    rig.root.updateMatrixWorld(true);
    for (const p of parts) for (let k = 0; k < p.nodes.length; k++) p.im.setMatrixAt(i * p.nodes.length + k, p.patch && !a.pat.has(p.patch) ? ZERO : p.nodes[k].matrixWorld);
  }
  for (const p of parts) p.im.instanceMatrix.needsUpdate = true;
}
const around = (cx, cz, r) => () => { const a = Math.random() * 6.28, d = Math.sqrt(Math.random()) * r; return { x: cx + Math.cos(a) * d, z: cz + Math.sin(a) * d }; };
const SHEEP0 = { x: -90, z: -200 };
const WIN_N = 490;
const sheep = makeHerd("sheep", 300, around(SHEEP0.x, SHEEP0.z, 20));
const goats = makeHerd("goat", 200, around(SHEEP0.x + 6, SHEEP0.z - 4, 18), .3, .55);
goats.animals.forEach((a) => (a.goat = true));
const FLOCK = sheep.animals.concat(goats.animals);
const COWS0 = { x: 145, z: 560 }, GELD0 = { x: 609, z: 229 }, HAREM0 = { x: 680, z: 294 };
const cows = makeHerd("cow", 49, around(COWS0.x, COWS0.z, 35), 0);
const inRect = (r, m) => () => ({ x: r.x + (Math.random() - .5) * (r.w - m * 2), z: r.z + (Math.random() - .5) * (r.d - m * 2) });
const calves = makeHerd("cow", 21, inRect(CP, 1.2), 1, .55);
const geldings = makeHerd("horse", 10, around(GELD0.x, GELD0.z, 22), 0);                  // насанд хүрсэн морьд
const mares = makeHerd("horse", 24, around(HAREM0.x, HAREM0.z, 22), 7 / 24, .58);           // 17 гүү, 7 унага
const stallion = makeHerd("horse", 1, around(HAREM0.x, HAREM0.z, 6), 0, 1, { stallion: true, pal: "stallion", scale: 1.1 });
const horses = { animals: geldings.animals.concat(mares.animals, stallion.animals) };
const GROUPS = {
  cows:  { name: "Үхэр", pasture: COWS0, home: { x: CP.x, z: CP.z }, pen: CP, r: 45, hr: 13, state: "pasture", speed: 1.7, list: () => cows.animals },
  geld:  { name: "Морьд", pasture: GELD0, home: { x: 172, z: 74 }, r: 38, hr: 13, state: "pasture", speed: 3, list: () => geldings.animals },
  harem: { name: "Азаргын сүрэг", pasture: HAREM0, home: { x: PENS.horse.x, z: PENS.horse.z }, pen: PENS.horse, r: 30, hr: 15, state: "pasture", speed: 2.6, list: () => mares.animals.concat(stallion.animals) },
};
const GRAZERS = [{ h: cows, grp: "cows", flee: 9 }, { h: calves, rect: CP, flee: 0, calf: true }, { h: geldings, grp: "geld", flee: 14 }, { h: mares, grp: "harem", flee: 14 }, { h: stallion, grp: "harem", flee: 5 }];
$("total").textContent = FLOCK.length;

// ---------- Малчин морьтой ----------
const player = new THREE.Group();
const pRig = (() => {
  // энгийн мэш морь (тоглогчийнх)
  const S = SPECS.horse, g = new THREE.Group(), body = std("#6e3f22"), dark = std("#16100b"), leg = std("#2a1d15");
  const bodyY = S.leg + S.bh * .32, blob = (geo, mat, sx, sy, sz, x, y, z, parent = g) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  blob(SPH, body, S.len, S.bh, S.w, 0, bodyY, 0);
  const legs = LEGS.map(([fx, fz, ph]) => { const p = new THREE.Group(); p.position.set(S.len * fx, S.leg + .02, S.w * fz); p.userData.ph = ph; blob(CYL, leg, S.legR * 2, S.leg, S.legR * 2, 0, -S.leg / 2, 0, p); g.add(p); return p; });
  const neck = new THREE.Group(); neck.position.set(S.len * .4, bodyY + S.bh * .18, 0); neck.rotation.z = -S.neckAng; g.add(neck);
  blob(CYL, body, .29, S.neck + .1, .26, 0, S.neck / 2, 0, neck); blob(SPH, dark, .08, S.neck + .15, .1, -.11, S.neck / 2 + .02, 0, neck);
  const hd = new THREE.Group(); hd.position.y = S.neck; hd.rotation.z = S.neckAng - .3; neck.add(hd); blob(SPH, body, ...S.head, S.head[0] * .35, 0, 0, hd);
  const tail = new THREE.Group(); tail.position.set(-S.len * .48, bodyY + S.bh * .15, 0); tail.rotation.z = -.25; g.add(tail); blob(CYL, dark, .1, .75, .1, -.05, -.35, 0, tail);
  const r = new THREE.Group(), deel = std("#2f5c99"), skin = std("#c98e62");
  blob(CYL, deel, .44, .72, .34, 0, .36, 0, r); blob(CYL, deel, .62, .3, .7, -.02, -.02, 0, r); blob(CYL, std("#e6b04a"), .46, .09, .36, 0, .12, 0, r);
  blob(SPH, skin, .25, .27, .25, 0, .88, 0, r); blob(CYL, std("#3a2a20"), .44, .05, .44, 0, .99, 0, r); blob(CONE, std("#8a2a1f"), .3, .32, .3, 0, 1.16, 0, r); blob(SPH, std("#e6b04a"), .07, .07, .07, 0, 1.33, 0, r);
  for (const s of [1, -1]) { const arm = blob(CYL, deel, .11, .5, .11, .16, .46, s * .22, r); arm.rotation.z = -1.0; blob(CYL, std("#3a2418"), .12, .5, .12, .05, -.32, s * .33, r); }
  blob(BOX, std("#8a2a1f"), .7, .08, .62, -.05, -.12, 0, r);
  r.add(beam(std("#5a3a22"), new THREE.Vector3(.45, .3, .2), new THREE.Vector3(2.2, .6, .15), .025));
  r.position.set(-.05, 1.33, 0); g.add(r);
  player.add(g);
  return { legs, tail, rider: r, horse: g };
})();
scene.add(player);
const START = { x: 46, z: 46, heading: 2.4 };
const MOTO_HOME = { x: 54, z: 32, heading: 2.2 }, HITCH = { x: 18, z: 38, heading: 1.2 };
const moto = new THREE.Group();
const motoParts = (() => {
  const red = std("#b3261e", { roughness: .45, metalness: .3 }), blackM = std("#18181a", { roughness: .6 }), chrome = std("#c9ccd1", { roughness: .25, metalness: .8 }), tire = std("#121212", { roughness: .9 });
  const add = (geo, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; moto.add(m); return m; };
  const wheels = [.64, -.62].map((x) => {
    const w = new THREE.Group(); w.position.set(x, .34, 0); moto.add(w);
    const t = new THREE.Mesh(new THREE.TorusGeometry(.28, .075, 8, 22), tire); t.castShadow = true; w.add(t);
    for (let k = 0; k < 3; k++) { const sp = new THREE.Mesh(BOX, chrome); sp.scale.set(.52, .025, .02); sp.rotation.z = k * Math.PI / 3; w.add(sp); }
    return w;
  });
  moto.add(beam(red, new THREE.Vector3(-.62, .34, 0), new THREE.Vector3(.05, .62, 0), .07));        // арын хүрээ
  moto.add(beam(red, new THREE.Vector3(.05, .62, 0), new THREE.Vector3(.45, 1.0, 0), .08));          // гол хүрээ
  for (const z of [.07, -.07]) moto.add(beam(chrome, new THREE.Vector3(.64, .34, z), new THREE.Vector3(.45, 1.02, z), .045)); // салаа
  add(BOX, red, .5, .22, .3, .22, .84, 0);                     // шатахууны сав
  add(BOX, blackM, .62, .1, .26, -.22, .88, 0);                // суудал
  add(BOX, std("#3a3b3e", { metalness: .5, roughness: .4 }), .36, .32, .22, .05, .5, 0);   // хөдөлгүүр
  add(CYL, chrome, .06, .7, .06, -.2, .4, .16).rotation.z = Math.PI / 2 - .15;             // яндан
  const bar = add(CYL, blackM, .04, .78, .04, .44, 1.1, 0); bar.rotation.x = Math.PI / 2;  // жолоо
  add(SPH, std("#fff6cf", { emissive: new THREE.Color("#fff1b0"), emissiveIntensity: .6 }), .14, .14, .14, .55, .98, 0);   // гэрэл
  add(BOX, red, .34, .05, .18, .66, .66, 0);                   // урд хаалт
  add(BOX, red, .4, .05, .2, -.66, .68, 0);                    // хойд хаалт
  for (const z of [.36, -.36]) for (let k = 0; k < 3; k++) add(BOX, std(["#e6b04a", "#2f5c99", "#c33a2a"][k]), .02, .22, .02, .44, .98, z * (1 + k * .04));   // жолооны цацаг
  const lamp = new THREE.SpotLight("#fff1c8", 0, 60, .5, .5, 1.2); lamp.position.set(.6, 1, 0);
  const lt = new THREE.Object3D(); lt.position.set(8, -.5, 0); moto.add(lamp, lt); lamp.target = lt;
  return { wheels, lamp };
})();
moto.position.set(MOTO_HOME.x, heightAt(MOTO_HOME.x, MOTO_HOME.z), MOTO_HOME.z); moto.rotation.y = MOTO_HOME.heading;
scene.add(moto);
let VEH = "horse";
const P = { ...START, speed: 0, phase: 0 };

// ---------- Мөргөлдөөн ----------
function blocked(ox, oz, nx, nz, animal, calf) {
  if (calf && inPenP(CP, ox, oz, .3) && !inPenP(CP, nx, nz, .3)) return true;
  for (const g of gers) if (Math.hypot(nx - g.x, nz - g.z) < GR + (animal ? .6 : 1.3)) return true;
  for (const p of Object.values(PENS)) if (inPenP(p, ox, oz, -.3) !== inPenP(p, nx, nz, -.3)) {
    if (!(Math.abs(nx - p.x) < p.gate / 2 - .3 && Math.abs(nz - p.S) < 1.3)) return true;
  }
  return Math.abs(nx) > HALF - 20 || Math.abs(nz) > HALF - 20;
}

// ---------- Удирдлага ----------
const keys = {};
let joyF = 0, joyT = 0, gallop = false, whistleT = 0, camYaw = 0, camDist = 12, started = false;
addEventListener("keydown", (e) => { keys[e.code] = true; if (e.code === "KeyM" && !e.repeat) switchVehicle(); if (e.code === "Space" && started) { e.preventDefault(); whistle(); } if (e.code.startsWith("Arrow")) e.preventDefault(); });
addEventListener("keyup", (e) => { keys[e.code] = false; });
addEventListener("blur", () => { for (const k in keys) keys[k] = false; });
function switchVehicle() {
  if (!started) return;
  if (Math.hypot(P.x - CAMP.x, P.z - CAMP.z) > 45) { toast(VEH === "horse" ? "Мотоцикл гэрийн дэргэд байгаа. Гэртээ очоорой." : "Морь гэрийн уяанд байгаа. Гэртээ очоорой."); return; }
  const r = pRig.rider;
  if (VEH === "horse") {
    player.remove(pRig.horse); scene.add(pRig.horse);
    pRig.horse.position.set(HITCH.x, heightAt(HITCH.x, HITCH.z), HITCH.z); pRig.horse.rotation.set(0, HITCH.heading, 0);
    scene.remove(moto); player.add(moto); moto.position.set(0, 0, 0); moto.rotation.set(0, 0, 0);
    pRig.horse.remove(r); moto.add(r); r.position.set(-.16, .95, 0);
    Object.assign(P, { x: MOTO_HOME.x, z: MOTO_HOME.z, heading: MOTO_HOME.heading, speed: 0 });
    VEH = "moto"; $("vehBtn").textContent = "Морь унах"; $("gallopBtn").textContent = "Хурдлах"; toast("Мотоцикл унлаа. Морь уяан дээр үлдлээ.");
  } else {
    player.remove(moto); scene.add(moto);
    moto.position.set(MOTO_HOME.x, heightAt(MOTO_HOME.x, MOTO_HOME.z), MOTO_HOME.z); moto.rotation.set(0, MOTO_HOME.heading, 0);
    scene.remove(pRig.horse); player.add(pRig.horse); pRig.horse.position.set(0, 0, 0); pRig.horse.rotation.set(0, 0, 0);
    moto.remove(r); pRig.horse.add(r); r.position.set(-.05, 1.33, 0);
    Object.assign(P, { x: HITCH.x + 2, z: HITCH.z + 2, heading: HITCH.heading, speed: 0 });
    VEH = "horse"; $("vehBtn").textContent = "Мотоцикл"; $("gallopBtn").textContent = "Давхих"; toast("Морио унлаа.");
  }
}
$("vehBtn").onclick = () => switchVehicle();
{
  const el = document.documentElement, canFs = !!(el.requestFullscreen || el.webkitRequestFullscreen);
  if (!canFs) $("fsBtn").hidden = true;
  $("fsBtn").onclick = async () => {
    try {
      if (document.fullscreenElement || document.webkitFullscreenElement) { await (document.exitFullscreen || document.webkitExitFullscreen).call(document); return; }
      await (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(() => {});
    } catch { $("fsBtn").hidden = true; }
  };
  const rot = () => { $("rotateHint").hidden = !(coarse && innerHeight > innerWidth); };
  addEventListener("resize", rot); rot();
}
$("gallopBtn").onclick = () => { gallop = !gallop; $("gallopBtn").setAttribute("aria-pressed", String(gallop)); };
$("whistleBtn").onclick = () => whistle();
if (coarse) $("joy").hidden = false; else $("keys").hidden = false;
{
  const joy = $("joy"), knob = $("knob"); let id = null;
  const move = (e) => {
    const r = joy.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = e.clientX - cx, dy = e.clientY - cy; const m = Math.hypot(dx, dy), max = r.width / 2 - 10;
    if (m > max) { dx *= max / m; dy *= max / m; }
    knob.style.transform = `translate(${dx}px, ${dy}px)`; joyF = -dy / max; joyT = dx / max;
  };
  joy.addEventListener("pointerdown", (e) => { id = e.pointerId; joy.setPointerCapture(id); move(e); });
  joy.addEventListener("pointermove", (e) => { if (e.pointerId === id) move(e); });
  const end = (e) => { if (e.pointerId !== id) return; id = null; joyF = joyT = 0; knob.style.transform = ""; };
  joy.addEventListener("pointerup", end); joy.addEventListener("pointercancel", end);
}
{
  // нэг хуруу/хулгана: камер эргүүлэх; хоёр хуруу: чимхэж ойртуулах
  const cv = $("scene"), pts = new Map(); let drag = null, pinch = null;
  const pdist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  cv.addEventListener("pointerdown", (e) => {
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); try { cv.setPointerCapture(e.pointerId); } catch {}
    if (pts.size === 1) drag = { x: e.clientX, yaw: camYaw };
    if (pts.size === 2) { drag = null; pinch = { d: pdist(), cam: camDist }; }
  });
  cv.addEventListener("pointermove", (e) => {
    if (!pts.has(e.pointerId)) return;
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pts.size >= 2) camDist = Math.max(5, Math.min(60, pinch.cam * pinch.d / Math.max(20, pdist())));
    else if (drag) camYaw = drag.yaw - (e.clientX - drag.x) * .006;
  });
  const up = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 0) drag = null; };
  cv.addEventListener("pointerup", up); cv.addEventListener("pointercancel", up);
  cv.addEventListener("wheel", (e) => { camDist = Math.max(5, Math.min(60, camDist * (e.deltaY > 0 ? 1.1 : .9))); e.preventDefault(); }, { passive: false });
}

// ---------- Дуу ----------
let ac = null;
function initAudio() { if (!ac) try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch {} }
function whistle() {
  if (!started) return;
  whistleT = 1.6;
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(1900, t); o.frequency.linearRampToValueAtTime(2600, t + .18); o.frequency.linearRampToValueAtTime(2100, t + .45);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.15, t + .04); g.gain.exponentialRampToValueAtTime(.0001, t + .5);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .5);
}
let clopT = 0, eng = null;
function engineSound(on, sp) {
  if (!ac) return;
  if (!eng && on) {
    const o = ac.createOscillator(), o2 = ac.createOscillator(), lp = ac.createBiquadFilter(), g = ac.createGain();
    o.type = "sawtooth"; o2.type = "square"; lp.type = "lowpass"; lp.frequency.value = 700; g.gain.value = 0;
    o.connect(lp); o2.connect(lp); lp.connect(g).connect(ac.destination); o.start(); o2.start();
    eng = { o, o2, g };
  }
  if (!eng) return;
  const f = 38 + sp * 5.5;
  eng.o.frequency.setTargetAtTime(f, ac.currentTime, .08); eng.o2.frequency.setTargetAtTime(f * .5, ac.currentTime, .08);
  eng.g.gain.setTargetAtTime(on && started ? .035 + Math.min(.04, sp * .002) : 0, ac.currentTime, .1);
}
function clop(vol) {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = "triangle"; o.frequency.setValueAtTime(180 + Math.random() * 40, t); o.frequency.exponentialRampToValueAtTime(80, t + .06);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + .08);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .09);
}

// ---------- Жижиг газрын зураг (2 км) ----------
const mm = $("minimap"), mctx = mm.getContext("2d"), MM = mm.width;
const toMap = (x, z) => [(x + HALF) / (2 * HALF) * MM, (z + HALF) / (2 * HALF) * MM];
const mapBg = document.createElement("canvas"); mapBg.width = mapBg.height = MM;
{
  const g = mapBg.getContext("2d"), img = g.createImageData(MM, MM), c = new THREE.Color();
  for (let j = 0; j < MM; j++) for (let i = 0; i < MM; i++) {
    const x = -HALF + (i + .5) / MM * 2 * HALF, z = -HALF + (j + .5) / MM * 2 * HALF, h = heightAt(x, z);
    const sh = (heightAt(x - 6, z - 6) - h) * .06, contour = Math.abs(((h + 1000) % 10) - 5) < .5 ? -.08 : 0;
    const f = fieldAt(x, z);
    c.set(f ? (f.crop === "green" ? "#3f5f2a" : "#cdb47e") : "#7d9a4c");
    const k = (i + j * MM) * 4;
    img.data[k] = Math.max(0, Math.min(255, (c.r + sh + contour) * 255)); img.data[k + 1] = Math.max(0, Math.min(255, (c.g + sh + contour) * 255)); img.data[k + 2] = Math.max(0, Math.min(255, (c.b + sh + contour) * 255)); img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  g.fillStyle = "#2f4a20"; for (const [x, z] of F.trees) { const [a, b] = toMap(x, z); g.fillRect(a, b, 1.2, 1.2); }
  const line = (pts, color, w) => { g.strokeStyle = color; g.lineWidth = w; g.beginPath(); pts.forEach(([x, z], i) => { const [a, b] = toMap(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.stroke(); };
  if (DATA.road) line(DATA.road, "#555", 2.5);
  F.tracks.forEach((t) => line(t, "#b7a888", 1));
  F.creeks.forEach((c) => line(c.pts, "#3d6f9a", c.kind === "main" ? 2 : 1));
  if (F.landmarks) {
    const [a, b] = toMap(...F.landmarks.ovoo);
    g.fillStyle = "#7a3fb0"; g.beginPath(); g.moveTo(a, b - 4); g.lineTo(a + 3.5, b + 2.5); g.lineTo(a - 3.5, b + 2.5); g.closePath(); g.fill();
    g.fillStyle = "#1f3a12"; for (const [x, z] of F.landmarks.trees) { const [p, q] = toMap(x, z); g.beginPath(); g.arc(p, q, 2.2, 0, 7); g.fill(); }
  }
}
function drawMap() {
  mctx.drawImage(mapBg, 0, 0);
  mctx.strokeStyle = "#3a2410"; mctx.lineWidth = 1.5;
  const [hx0, hz0] = toMap(H.x - H.w / 2, H.z - H.d / 2), [hx1, hz1] = toMap(H.x + H.w / 2, H.z + H.d / 2);
  mctx.strokeRect(hx0, hz0, hx1 - hx0, hz1 - hz0);
  for (const p of [PENS.cow, PENS.horse]) { const [p0, q0] = toMap(p.x - p.w / 2, p.z - p.d / 2), [p1, q1] = toMap(p.x + p.w / 2, p.z + p.d / 2); mctx.strokeRect(p0, q0, p1 - p0, q1 - q0); }
  for (const g of gers) { const [x, z] = toMap(g.x, g.z); mctx.fillStyle = "#fff"; mctx.beginPath(); mctx.arc(x, z, 2.5, 0, 7); mctx.fill(); }
  mctx.fillStyle = "#6b3b24"; for (const a of cows.animals) { const [x, z] = toMap(a.x, a.z); mctx.fillRect(x - 1, z - 1, 2, 2); }
  mctx.fillStyle = "#2b1d14"; for (const a of horses.animals) { const [x, z] = toMap(a.x, a.z); mctx.fillRect(x - 1, z - 1, 2, 2); }
  mctx.fillStyle = "#c9a46a"; for (const a of goats.animals) { const [x, z] = toMap(a.x, a.z); mctx.fillRect(x - 1, z - 1, 2, 2); }
  mctx.fillStyle = "#fffdf5"; for (const a of sheep.animals) { const [x, z] = toMap(a.x, a.z); mctx.fillRect(x - 1, z - 1, 2, 2); }
  const [px, pz] = toMap(P.x, P.z);
  mctx.save(); mctx.translate(px, pz); mctx.rotate(-P.heading);
  mctx.fillStyle = "#e6b04a"; mctx.strokeStyle = "#1d1405"; mctx.lineWidth = 1.5;
  mctx.beginPath(); mctx.moveTo(10, 0); mctx.lineTo(-6, 6); mctx.lineTo(-3, 0); mctx.lineTo(-6, -6); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
}

// ---------- Тоглогч ----------
let elapsed = 0, won = false;
function updatePlayer(dt) {
  const fwd = Math.max(-1, Math.min(1, (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0) + joyF));
  const turn = Math.max(-1, Math.min(1, (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0) + joyT));
  const fast = gallop || keys.ShiftLeft || keys.ShiftRight;
  const isMoto = VEH === "moto";
  const target = fwd > .05 ? (isMoto ? (fast ? 19.5 : 8.5) : (fast ? 12 : 4.5)) * fwd : fwd < -.05 ? (isMoto ? -2.5 : -1.6) : 0;
  P.speed += (target - P.speed) * Math.min(1, dt * (target > P.speed ? (isMoto ? 1.1 : 1.6) : 3));
  P.heading -= turn * dt * (isMoto ? (Math.abs(P.speed) > .3 ? 1.5 - Math.min(.8, Math.abs(P.speed) * .035) : 0) : 1.9 - Math.min(.9, Math.abs(P.speed) * .06));
  P.lean = (P.lean || 0) + ((isMoto ? Math.max(-.4, Math.min(.4, -turn * Math.abs(P.speed) * .03)) : 0) - (P.lean || 0)) * Math.min(1, dt * 5);
  const nx = P.x + Math.cos(P.heading) * P.speed * dt, nz = P.z - Math.sin(P.heading) * P.speed * dt;
  if (!blocked(P.x, P.z, nx, nz, false)) { P.x = nx; P.z = nz; } else P.speed *= .3;
  if (P.kx || P.kz) {   // азарга мөргөсний түлхэлт
    const kx = P.x + P.kx * dt, kz = P.z + P.kz * dt;
    if (!blocked(P.x, P.z, kx, kz, false)) { P.x = kx; P.z = kz; }
    const k = 1 - Math.min(1, dt * 3.5); P.kx *= k; P.kz *= k; if (Math.hypot(P.kx, P.kz) < .2) P.kx = P.kz = 0;
  }
  const y = heightAt(P.x, P.z);
  player.position.set(P.x, y, P.z);
  const ahead = heightAt(P.x + Math.cos(P.heading) * 1.2, P.z - Math.sin(P.heading) * 1.2) - heightAt(P.x - Math.cos(P.heading) * 1.2, P.z + Math.sin(P.heading) * 1.2);
  player.rotation.set(0, P.heading, 0); player.rotateZ(Math.atan2(ahead, 2.4)); if (P.lean) player.rotateX(P.lean);
  const sp = Math.abs(P.speed); P.phase += dt * sp * 6.5;
  if (isMoto) motoParts.wheels.forEach((w) => (w.rotation.z -= P.speed * dt / .34));
  if (!isMoto) pRig.legs.forEach((l) => (l.rotation.z = sp > .08 ? Math.sin(P.phase + l.userData.ph) * Math.min(.75, .3 + sp * .07) : l.rotation.z * .85));
  $("speed").textContent = `${Math.round(sp * 3.6)} км/ц`;
  engineSound(isMoto, sp);
  if (!isMoto && sp > .5 && (clopT -= dt) <= 0) { clop(Math.min(.12, .03 + sp * .008)); clopT = Math.max(.11, 1.08 / sp); }
}

// ---------- Хонины сүрэг (орон зайн хэш) ----------
const cells = new Map(), CS = 2;
const key = (x, z) => (Math.floor(x / CS) * 92837111) ^ (Math.floor(z / CS) * 689287499);
function updateSheep(dt, t) {
  cells.clear();
  for (const a of FLOCK) { const k = key(a.x, a.z); let arr = cells.get(k); if (!arr) cells.set(k, (arr = [])); arr.push(a); }
  let cx = 0, cz = 0, n = 0, penned = 0;
  for (const a of FLOCK) { a.penned = inPen(a.x, a.z, .6); if (a.penned) penned++; else { cx += a.x; cz += a.z; n++; } }
  if (n) { cx /= n; cz /= n; }
  const fleeR = whistleT > 0 ? 48 : VEH === "moto" ? 24 : 18, spread = Math.max(6, Math.sqrt(n) * .9);
  for (const a of FLOCK) {
    let sx = 0, sz = 0, alert = false, out = false, follow = false;
    if (a.young && a.mother) {   // хурга, ишиг эхээсээ салахгүй
      const m = a.mother, c = Math.cos(m.yaw), s2 = Math.sin(m.yaw);
      const tx = m.x - c * 1.1 + s2 * a.offS, tz = m.z + s2 * 1.1 + c * a.offS, fx = tx - a.x, fz = tz - a.z;
      if (Math.hypot(fx, fz) > 12) { a.x = tx; a.z = tz; a.vx = a.vz = 0; }
      sx += fx * 2.5; sz += fz * 2.5; follow = true;
    } else if (!a.penned) {
      const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);
      if (d < fleeR) {   // туухад: голдуу гэр (хашааны хаалга) зүг рүү, бага зэрэг таниас холдоно
        const k = (1 - d / fleeR) * 7, hx = H.x - a.x, hz = H_S + 5 - a.z, hd = Math.hypot(hx, hz) || 1;
        sx += (dx / d * .35 + hx / hd) * k; sz += (dz / d * .35 + hz / hd) * k; alert = true;
      } else if (DAY.out) {   // өглөө бэлчээр лүүгээ
        const px = SHEEP0.x - a.x, pz = SHEEP0.z - a.z, pd = Math.hypot(px, pz);
        if (pd > 25) { sx += px / pd * 1.6; sz += pz / pd * 1.6; out = true; }
      }
      const ex = cx - a.x, ez = cz - a.z, de = Math.hypot(ex, ez);
      const nearPen = !DAY.out && (FLOCK_DRIVEN || Math.hypot(a.x - H.x, a.z - H.z) < 55);   // орой туувал өөрсдөө гэр лүүгээ
      if (de > spread && !nearPen) { const k = Math.min(1.4, (de - spread) * .1); sx += ex / de * k; sz += ez / de * k; }
      const dg = Math.hypot(H.x - a.x, H_S + 2 - a.z);
      if (nearPen) {   // хашааны ойр: өөрсдөө хаалгаар орно (хажуу, ар талаас бол тойрч)
        const r = penRoute(a, H, true);
        if (r) { const gx2 = r[0] - a.x, gz2 = r[1] - a.z, gd2 = Math.hypot(gx2, gz2) || 1; sx += gx2 / gd2 * 2.4; sz += gz2 / gd2 * 2.4; out = true; }
      }
    } else if (DAY.out) {   // өглөө хашаанаас хаалгаар гарна
      sx += (H.x + (a.phase % 3 - 1.5) - a.x) * .3; sz += (H_S + 4 - a.z) * .3; out = true;
    } else {
      if (!a.tx) { a.tx = H.x + (Math.random() - .5) * (H.w - 4); a.tz = H.z + (Math.random() - .5) * (H.d - 4); }
      sx += (a.tx - a.x) * .06; sz += (a.tz - a.z) * .06;
    }
    const gx = Math.floor(a.x / CS), gz = Math.floor(a.z / CS);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const arr = cells.get(((gx + ox) * 92837111) ^ ((gz + oz) * 689287499)); if (!arr) continue;
      for (const b of arr) {
        if (b === a) continue;
        const dx = a.x - b.x, dz = a.z - b.z, d2 = dx * dx + dz * dz;
        if (d2 < 1.1 && d2 > 1e-4) { const d = Math.sqrt(d2), k = (1.05 - d) * 4; sx += dx / d * k; sz += dz / d * k; }
      }
    }
    if (!alert && !follow) {
      if ((a.wt -= dt) <= 0) { const ang = Math.random() * 6.28, m = Math.random() < .45 ? .5 : 0; a.wx = Math.cos(ang) * m; a.wz = Math.sin(ang) * m; a.wt = 2 + Math.random() * 5; }
      sx += a.wx; sz += a.wz;
      if (DAY.phase === "day" && !a.penned && !DAY.out) sz -= .35;   // өдөр аажмаар хойшоо бэлчинэ
    }
    a.vx += sx * dt; a.vz += sz * dt;
    const damp = 1 - Math.min(1, 1.8 * dt); a.vx *= damp; a.vz *= damp;
    const sp = Math.hypot(a.vx, a.vz), max = (follow ? 4.5 : alert ? 3.6 : out ? 1.5 : .7) * (a.goat ? 1.15 : 1);
    if (sp > max) { a.vx *= max / sp; a.vz *= max / sp; }
    const nx = a.x + a.vx * dt, nz = a.z + a.vz * dt;
    if (blocked(a.x, a.z, nx, nz, true)) { a.vx *= -.4; a.vz *= -.4; } else { a.x = nx; a.z = nz; }
    a.speed = Math.hypot(a.vx, a.vz);
    if (a.speed > .06) { let df = Math.atan2(-a.vz, a.vx) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 5); }
    a.phase += dt * a.speed * 6.5;
    const nt = a.speed < .15 && !alert ? GRAZE + Math.sin(t * 2 + a.phase) * .05 : a.baseNeck;
    a.neck += (nt - a.neck) * Math.min(1, dt * 2.5);
  }
  $("penned").textContent = penned;
  PENNED = penned; if (n) { FLOCK_C.x = cx; FLOCK_C.z = cz; }
}
function updateGrazers(dt, t) {
  for (const G of GRAZERS) for (const a of G.h.animals) {
    if (a === ST && updateStallion(dt, t)) continue;
    if (a.young && a.mother) {   // унага эхээсээ салахгүй
      const m = a.mother, c = Math.cos(m.yaw), s2 = Math.sin(m.yaw);
      const tx = m.x - c * 1.6 + s2 * a.offS * 1.4, tz = m.z + s2 * 1.6 + c * a.offS * 1.4, fx = tx - a.x, fz = tz - a.z, fd = Math.hypot(fx, fz);
      if (fd > 14) { a.x = tx; a.z = tz; }
      let sp = 0;
      if (fd > .5) {
        sp = Math.min(8, fd * 1.6);
        let df = Math.atan2(-fz, fx) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 5);
        const nx = a.x + Math.cos(a.yaw) * sp * dt, nz = a.z - Math.sin(a.yaw) * sp * dt;
        if (!blocked(a.x, a.z, nx, nz, true)) { a.x = nx; a.z = nz; } else if (fd > 5) { a.x = tx; a.z = tz; }
      } else { let df = m.yaw - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 2); }
      a.speed = sp; a.phase += dt * sp * 6.5;
      const nt = sp < .2 && m.state === "graze" ? GRAZE + Math.sin(t * 2 + a.phase) * .05 : -G.h.S.neckAng;
      a.neck += (nt - a.neck) * Math.min(1, dt * 2.5);
      continue;
    }
    let speed = G.h.S.speed, moving = false;
    const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);
    const gs = G.grp && GROUPS[G.grp], atHome = gs && (gs.state === "driven" || gs.state === "home");
    const ccx = gs ? (atHome ? gs.home.x : gs.pasture.x) : 0, ccz = gs ? (atHome ? gs.home.z : gs.pasture.z) : 0, rr = gs ? (atHome ? gs.hr : gs.r) : 0;
    if (gs && (gs.state === "driven" || gs.state === "outing")) {
      const r = gs.pen ? penRoute(a, gs.pen, gs.state === "driven") : null;
      if (r) { a.state = "walk"; a.tx = r[0]; a.tz = r[1]; }
      else if (!(gs.pen && gs.state === "driven") && Math.hypot(a.x - ccx, a.z - ccz) > rr && (a.state === "graze" || Math.hypot(a.tx - ccx, a.tz - ccz) > rr)) { const p = around(ccx, ccz, rr * .8)(); a.state = "walk"; a.tx = p.x; a.tz = p.z; }
      if (a.state === "walk") speed = gs.speed * (d < 30 ? 1.4 : 1);
    } else if (G.flee && d < G.flee * (VEH === "moto" ? 1.4 : 1)) { a.state = "walk"; a.tx = a.x + dx / d * 18; a.tz = a.z + dz / d * 18; speed = 3.2; }
    if (a.fleeT > 0) { a.fleeT -= dt; a.state = "walk"; speed = 5.5; }
    if (a.state === "graze") { if ((a.timer -= dt) <= 0) { a.state = "walk"; const p = G.rect ? inRect(G.rect, 1.2)() : atHome && gs.pen && inPenP(gs.pen, a.x, a.z, .3) ? inRect(gs.pen, 1.5)() : around(ccx, ccz, rr)(); a.tx = p.x; a.tz = p.z; } }
    else {
      const tx = a.tx - a.x, tz = a.tz - a.z;
      if (Math.hypot(tx, tz) < .4) { a.state = "graze"; a.timer = 5 + Math.random() * 12; }
      else {
        let df = Math.atan2(-tz, tx) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 2.5);
        if (Math.abs(df) < .8) {
          const nx = a.x + Math.cos(a.yaw) * speed * dt, nz = a.z - Math.sin(a.yaw) * speed * dt;
          if (!blocked(a.x, a.z, nx, nz, true, G.calf) && !fieldAt(nx, nz)) { a.x = nx; a.z = nz; }
          else if (!blocked(a.x, a.z, nx, a.z, true, G.calf) && !fieldAt(nx, a.z)) a.x = nx;      // хананы дагуу гулсана
          else if (!blocked(a.x, a.z, a.x, nz, true, G.calf) && !fieldAt(a.x, nz)) a.z = nz;
          else { a.state = "graze"; a.timer = .4; }
        }
        moving = true;
      }
    }
    a.speed = moving ? speed : 0; a.phase += dt * a.speed * 6.5;
    const nt = a.state === "graze" ? GRAZE + Math.sin(t * 2 + a.phase) * .05 : -G.h.S.neckAng;
    a.neck += (nt - a.neck) * Math.min(1, dt * 2.5);
  }
}

// ---------- Азарга: сүрэгтээ ойртоход урдаас дайрна ----------
let shakeT = 0, toastT = 0;
function toast(msg) { const el = $("toast"); el.textContent = msg; el.hidden = false; toastT = 2.8; }
function neigh() {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), lfo = ac.createOscillator(), lg = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(380, t + .9);
  lfo.frequency.value = 22; lg.gain.value = 60; lfo.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.09, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + 1);
  o.connect(g).connect(ac.destination); o.start(t); lfo.start(t); o.stop(t + 1); lfo.stop(t + 1);
}
const ST = stallion.animals[0];
Object.assign(ST, { mode: "guard", cool: 30, rear: 0 });
function updateStallion(dt, t) {
  const a = ST;
  // шөнө, эсвэл адууны хашаан дотор байхдаа дайрахгүй (бусад үед байнга)
  if (DAY.phase === "night" || (a.mode === "guard" && inPenP(PENS.horse, a.x, a.z, -.3))) { a.mode = "guard"; a.rear = 0; return false; }
  // азаргын сүргийн голч
  let hx = 0, hz = 0; for (const m of mares.animals) { hx += m.x; hz += m.z; } hx /= mares.animals.length; hz /= mares.animals.length;
  const dP = Math.hypot(P.x - a.x, P.z - a.z), dH = Math.hypot(P.x - hx, P.z - hz);
  a.cool -= dt;
  if (a.mode === "guard" && started && dH < 38 && a.cool <= 0) { a.mode = "charge"; neigh(); toast("Азарга дайрч ирлээ!"); }
  if (a.mode === "guard" && a.cool <= 0) {
    let best = null, bd = 1e9;
    for (const g of geldings.animals) if (!inPenP(PENS.horse, g.x, g.z, 0) && Math.hypot(g.x - hx, g.z - hz) < 75) { const dd = Math.hypot(g.x - a.x, g.z - a.z); if (dd < bd) { bd = dd; best = g; } }
    if (best) { a.mode = "raid"; a.target = best; if (dP < 150) { neigh(); toast("Азарга морьдыг хөөж байна"); } }
  }
  let speed = 0, tx = a.x, tz = a.z;
  if (a.mode === "charge") {
    speed = 9.5; tx = P.x; tz = P.z;
    if (dP < 3.2) {                                     // мөргөлт: морь ухарч, азарга шогшино
      a.mode = "rear"; a.rearT = 1.3; a.cool = 9;
      const ux = (P.x - a.x) / (dP || 1), uz = (P.z - a.z) / (dP || 1);
      P.kx = ux * 9; P.kz = uz * 9; P.speed = 0; shakeT = .45; neigh();
      toast("Азарга дайрлаа! Сүргээс нь холдоорой.");
    } else if (dH > 75) { a.mode = "return"; a.cool = 6; }
  } else if (a.mode === "raid") {
    speed = 9; tx = a.target.x; tz = a.target.z;
    if (Math.hypot(tx - a.x, tz - a.z) < 3.5) {
      for (const g of geldings.animals) {
        const gx = g.x - a.x, gz = g.z - a.z, gd = Math.hypot(gx, gz) || 1;
        if (gd < 40) {
          g.fleeT = 6 + Math.random() * 3; g.state = "walk";
          const gs = GROUPS.geld, dest = gs.state === "driven" ? gs.home : gs.state === "outing" ? gs.pasture : null;
          if (dest) { g.tx = dest.x + (Math.random() - .5) * gs.hr; g.tz = dest.z + (Math.random() - .5) * gs.hr; }   // гэр лүүгээ зугтана
          else { g.tx = g.x + gx / gd * 45 + (Math.random() - .5) * 15; g.tz = g.z + gz / gd * 45 + (Math.random() - .5) * 15; }
        }
      }
      a.mode = "rear"; a.rearT = 1; a.cool = 14 + Math.random() * 10; if (dP < 150) neigh();
    } else if (Math.hypot(a.x - hx, a.z - hz) > 140) { a.mode = "return"; a.cool = 8; }
  } else if (a.mode === "rear") {
    a.rearT -= dt; if (a.rearT <= 0) a.mode = "return";
  } else if (a.mode === "return") {
    speed = 3.5; tx = hx; tz = hz;
    if (GROUPS.harem.state === "driven") { const r = penRoute(a, PENS.horse, true); if (r) { tx = r[0]; tz = r[1]; } else a.mode = "guard"; }
    if (Math.hypot(hx - a.x, hz - a.z) < 6) a.mode = "guard";
  }
  a.rear += ((a.mode === "rear" ? .62 : 0) - a.rear) * Math.min(1, dt * 8);
  if (a.mode === "guard") return false;                 // ердийн бэлчээрийн логик ажиллана
  if (speed) {
    let df = Math.atan2(-(tz - a.z), tx - a.x) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 4);
    const nx = a.x + Math.cos(a.yaw) * speed * dt, nz = a.z - Math.sin(a.yaw) * speed * dt;
    if (!blocked(a.x, a.z, nx, nz, true)) { a.x = nx; a.z = nz; }
    else if (!blocked(a.x, a.z, nx, a.z, true)) a.x = nx;
    else if (!blocked(a.x, a.z, a.x, nz, true)) a.z = nz;
  }
  a.speed = speed; a.phase += dt * speed * 6.5;
  a.neck += (-.55 - a.neck) * Math.min(1, dt * 4);     // толгойгоо өргөсөн
  return true;
}

// ---------- Банхар нохойнууд ----------
const dogs = [];
{
  const black = std("#1c1815"), tan = std("#9a6233"), dark = std("#0e0c0a");
  const mk = (geo, mat, sx, sy, sz, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  const homes = [[26.5, 15.5], [37.5, 18.5]];
  for (const [hx, hz] of homes) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    mk(SPH, black, 1.0, .5, .42, 0, .62, 0, body);                         // бие (өтгөн үстэй)
    mk(SPH, black, .5, .5, .46, .42, .7, 0, body);                         // цээж
    const legs = [[.32, .14], [.32, -.14], [-.32, .14], [-.32, -.14]].map(([x, z], i) => {
      const p = new THREE.Group(); p.position.set(x, .5, z); p.userData.ph = i === 0 || i === 3 ? 0 : Math.PI;
      mk(CYL, tan, .1, .5, .1, 0, -.25, 0, p); body.add(p); return p;
    });
    const head = new THREE.Group(); head.position.set(.62, .92, 0); body.add(head);
    mk(SPH, black, .34, .3, .3, 0, 0, 0, head);
    mk(SPH, tan, .22, .14, .15, .2, -.05, 0, head);                       // хошуу
    mk(SPH, dark, .06, .05, .06, .31, -.03, 0, head);                      // хамар
    for (const s of [1, -1]) {
      mk(SPH, tan, .05, .04, .05, .12, .07, s * .08, head);               // "дөрвөн нүд" шар толбо
      const ear = mk(CONE, black, .1, .14, .05, -.02, .12, s * .12, head); ear.rotation.x = s * .5; ear.rotation.z = .8;
    }
    const tail = new THREE.Group(); tail.position.set(-.5, .8, 0); body.add(tail);
    const tm = mk(SPH, black, .18, .38, .16, 0, .15, 0, tail); tail.rotation.z = -.9;   // цомцойсон сүүл
    g.position.set(hx, heightAt(hx, hz), hz); scene.add(g);
    dogs.push({ g, body, legs, head, tail, x: hx, z: hz, hx, hz, yaw: Math.random() * 6, mode: "lie", phase: Math.random() * 6, side: dogs.length ? -1 : 1, barkT: 0 });
  }
}
function bark() {
  if (!ac) return;
  const t = ac.currentTime;
  for (const off of [0, .22]) {
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
    o.type = "sawtooth"; o.frequency.setValueAtTime(320, t + off); o.frequency.exponentialRampToValueAtTime(170, t + off + .12);
    f.type = "bandpass"; f.frequency.value = 700; f.Q.value = 2;
    g.gain.setValueAtTime(.0001, t + off); g.gain.exponentialRampToValueAtTime(.14, t + off + .02); g.gain.exponentialRampToValueAtTime(.0001, t + off + .15);
    o.connect(f).connect(g).connect(ac.destination); o.start(t + off); o.stop(t + off + .16);
  }
}
const CAMP = { x: 20, z: 20 };
function updateDogs(dt, t) {
  const pd = Math.hypot(P.x - CAMP.x, P.z - CAMP.z);
  for (const d of dogs) {
    let tx, tz, speed = 0;
    if (started && pd < 90) {
      if (d.mode === "lie") { d.mode = "follow"; d.barkT = .2 + Math.random() * .4; }
      // морины хажууд, арай ард
      const fx = Math.cos(P.heading), fz = -Math.sin(P.heading);
      tx = P.x - fx * 3 + fz * 2.6 * d.side; tz = P.z - fz * 3 - fx * 2.6 * d.side;
      const dd = Math.hypot(tx - d.x, tz - d.z);
      speed = dd < .6 ? 0 : Math.min(13, Math.max(2.5, dd * 1.8));
    } else {
      tx = d.hx; tz = d.hz;
      const dd = Math.hypot(tx - d.x, tz - d.z);
      if (dd < .6) { d.mode = "lie"; speed = 0; } else { d.mode = "home"; speed = Math.min(7, Math.max(2, dd)); }
    }
    if (d.barkT > 0 && (d.barkT -= dt) <= 0) bark();
    if (speed) {
      let df = Math.atan2(-(tz - d.z), tx - d.x) - d.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); d.yaw += df * Math.min(1, dt * 6);
      const nx = d.x + Math.cos(d.yaw) * speed * dt, nz = d.z - Math.sin(d.yaw) * speed * dt;
      if (!blocked(d.x, d.z, nx, nz, true)) { d.x = nx; d.z = nz; }
      d.phase += dt * speed * 4;
    }
    const lying = d.mode === "lie" && !speed;
    d.g.position.set(d.x, heightAt(d.x, d.z), d.z); d.g.rotation.y = d.yaw;
    d.body.position.y += ((lying ? -.42 : 0) - d.body.position.y) * Math.min(1, dt * 5);
    for (const l of d.legs) { l.visible = !lying || d.body.position.y > -.3; l.rotation.z = speed ? Math.sin(d.phase + l.userData.ph) * .7 : 0; }
    d.head.rotation.z = lying ? -.2 : Math.sin(t * 3 + d.phase) * .05;
    d.tail.rotation.x = Math.sin(t * (speed ? 14 : 4)) * .35;
  }
}

// ---------- Өдөр шөнийн мөчлөг ----------
const DAY = { t: 450, len: 720, n: 1, phase: "day", out: false,   // эхний өдөр 16:00-оос эхэлнэ
  nightT: 0, warnT: 0, farWarned: false };
const PH_NAME = { morning: "Өглөө", day: "Өдөр", evening: "Орой", night: "Шөнө" };
let PENNED = 0, FLOCK_DRIVEN = false; const FLOCK_C = { x: SHEEP0.x, z: SHEEP0.z };
const hourNow = () => DAY.phase === "night" ? 22 : Math.min(22, 6 + DAY.t / DAY.len * 16);
function groupHome(g) { let k = 0; for (const a of g.list()) if (g.pen ? inPenP(g.pen, a.x, a.z, 0) : Math.hypot(a.x - g.home.x, a.z - g.home.z) < g.hr + 12) k++; return k; }
function setPhase(p) {
  DAY.phase = p;
  if (p === "morning") { DAY.out = true; FLOCK_DRIVEN = false; for (const g of Object.values(GROUPS)) g.state = "outing"; toast(`${DAY.n}-р өдөр. Өглөө боллоо, мал бэлчээр лүүгээ гарлаа.`); toastT = 4; }
  if (p === "evening") { toast("Орой боллоо! Бүх малаа гэртээ туугаад ир."); toastT = 5; }
  if (p === "night") { DAY.nightT = 0; $("sleepBtn").hidden = false; toast("Бүх мал гэртээ ирлээ! Гэртээ очоод «Унтах» товчийг дарна уу."); toastT = 6; }
}
const SKY = { day: ["#4d7fc0", "#e3dcc4"], dusk: ["#3a4f86", "#f0a068"], night: ["#060b1c", "#18233c"] };
const skyC = Object.fromEntries(Object.entries(SKY).map(([k, v]) => [k, v.map((c) => new THREE.Color(c))]));
const cTop = new THREE.Color(), cBot = new THREE.Color(), sunCol = new THREE.Color(), WARM = new THREE.Color("#ff9a55"), WHITE = new THREE.Color("#ffe2b8"), MOON = new THREE.Color("#8ea6d8");
function applyLight(h) {
  const t = Math.min(1, Math.max(0, (h - 6) / 14)), elev = Math.sin(Math.PI * t);
  const night = h >= 20 ? Math.min(1, (h - 20) / 1.5) : 0;
  const dusk = Math.max(0, 1 - Math.abs(h - 19) / 2.2, 1 - (h - 6) / 2) * (1 - night);
  cTop.copy(skyC.day[0]).lerp(skyC.dusk[0], dusk).lerp(skyC.night[0], night);
  cBot.copy(skyC.day[1]).lerp(skyC.dusk[1], dusk).lerp(skyC.night[1], night);
  skyU.top.value.copy(cTop); skyU.bottom.value.copy(cBot); scene.fog.color.copy(cBot);
  SUN_OFF.set(Math.cos(Math.PI * t) * 110, 10 + elev * 100, 40 + elev * 25);
  sun.color.copy(sunCol.copy(WHITE).lerp(WARM, dusk * .8).lerp(MOON, night));
  sun.intensity = 1.35 * (1 - night * .8) * (.75 + elev * .25);
  hemi.intensity = .55 * (1 - night * .75);
  renderer.toneMappingExposure = 1.05 - night * .15;
  motoParts.lamp.intensity = VEH === "moto" ? Math.max(night, dusk * .4) * 3 : 0;
}
let hudT = 0, sleeping = false;
function sleep() {
  if (DAY.phase !== "night" || sleeping) return;
  if (Math.hypot(P.x - CAMP.x, P.z - CAMP.z) > 45) { toast("Гэртээ очиж унтаарай."); return; }
  sleeping = true; $("sleepBtn").hidden = true; $("fade").classList.add("on");
  setTimeout(() => {
    DAY.n++; DAY.t = 0; setPhase("morning");
    setTimeout(() => { $("fade").classList.remove("on"); sleeping = false; }, 900);
  }, 1300);
}
$("sleepBtn").onclick = () => sleep();
addEventListener("keydown", (e) => { if (e.code === "KeyU" && !e.repeat) sleep(); });
function updateDay(dt) {
  if (started) {
    if (DAY.phase === "night") DAY.nightT += dt;
    else DAY.t = Math.min(DAY.t + dt, DAY.len);
    const h = hourNow();
    for (const g of Object.values(GROUPS)) if (g.state === "outing") { const L = g.list(); let k = 0; for (const a of L) if (Math.hypot(a.x - g.pasture.x, a.z - g.pasture.z) < g.r) k++; if (k > L.length * .8) g.state = "pasture"; }
    if (DAY.out && PENNED < 10 && Math.hypot(FLOCK_C.x - SHEEP0.x, FLOCK_C.z - SHEEP0.z) < 45) DAY.out = false;
    if (DAY.phase === "morning" && h >= 8) setPhase("day");
    if (DAY.phase === "day" && h >= 17) { DAY.out = false; setPhase("evening"); }
    if (DAY.phase === "day" && !DAY.out) {
      const far = Math.hypot(FLOCK_C.x - CAMP.x, FLOCK_C.z - CAMP.z);
      if ((DAY.warnT -= dt) <= 0 && far > 300) { toast("Хонь ямаа хол явчихлаа! Ойртуулаад ир."); toastT = 4; DAY.warnT = 25; DAY.farWarned = true; }
      if (far < 240 && DAY.farWarned) { DAY.farWarned = false; toast("Сайн байна, хонь ямаа ойртлоо."); }
    }
    if (DAY.phase === "evening") {
      if (!FLOCK_DRIVEN && FLOCK.some((a) => !a.penned && Math.hypot(a.x - P.x, a.z - P.z) < 30)) { FLOCK_DRIVEN = true; toast("Хонь ямаа гэр лүүгээ явлаа"); }
      for (const g of Object.values(GROUPS)) if (g.state === "pasture" || g.state === "outing")
        if (g.list().some((a) => Math.hypot(a.x - P.x, a.z - P.z) < 30)) { g.state = "driven"; toast(`${g.name} гэр лүүгээ явлаа`); }
      const homeC = groupHome(GROUPS.cows), homeH = groupHome(GROUPS.geld) + groupHome(GROUPS.harem);
      if (PENNED >= WIN_N && homeC >= cows.animals.length - 2 && homeH >= geldings.animals.length + mares.animals.length - 1) setPhase("night");
    }
  }
  const h = hourNow();
  applyLight(h);
  if ((hudT -= dt) <= 0) {
    hudT = .25;
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 6) * 10;
    $("clock").textContent = `${DAY.n}-р өдөр · ${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")} · ${PH_NAME[DAY.phase]}`;
    const nh = geldings.animals.length + mares.animals.length + 1;
    $("homeInfo").textContent = DAY.phase === "evening" || DAY.phase === "night" ? ` · Үхэр ${groupHome(GROUPS.cows)}/${cows.animals.length} · Адуу ${groupHome(GROUPS.geld) + groupHome(GROUPS.harem)}/${nh}` : "";
  }
}

// ---------- Камер ----------
const camPos = new THREE.Vector3(), look = new THREE.Vector3(), want = new THREE.Vector3(), lookWant = new THREE.Vector3();
function updateCamera(dt, snap) {
  const yaw = P.heading + Math.PI + camYaw;
  want.set(P.x + Math.cos(yaw) * camDist, 0, P.z - Math.sin(yaw) * camDist);
  want.y = Math.max(heightAt(want.x, want.z) + 1.5, player.position.y + camDist * .38 + 1.2);
  camPos.lerp(want, snap ? 1 : Math.min(1, dt * 3.5)); camera.position.copy(camPos);
  if (shakeT > 0) { shakeT -= dt; camera.position.x += (Math.random() - .5) * shakeT * 1.2; camera.position.y += (Math.random() - .5) * shakeT * 1.2; }
  look.lerp(lookWant.set(P.x, player.position.y + 1.8, P.z), snap ? 1 : Math.min(1, dt * 6)); camera.lookAt(look);
  sun.position.copy(player.position).add(SUN_OFF); sun.target.position.copy(player.position);
}

// ---------- Эхлэх ----------
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener("resize", resize); resize();
updatePlayer(0); updateCamera(0, true);
$("goBtn").onclick = () => { $("intro").hidden = true; started = true; initAudio(); if (ac && ac.state === "suspended") ac.resume(); };
$("againBtn").onclick = () => {
  $("win").hidden = true; won = false; elapsed = 0; Object.assign(P, START, { speed: 0 });
  const sp = around(SHEEP0.x, SHEEP0.z, 22);
  for (const a of FLOCK) { const p = sp(); Object.assign(a, { x: p.x, z: p.z, vx: 0, vz: 0, tx: 0, tz: 0, penned: false }); }
};

const clock = new THREE.Clock();
let mapT = 0;
function frame() {
  const dt = Math.min(.05, clock.getDelta()), t = clock.elapsedTime;
  frameNo++;
  if (started && $("win").hidden) { elapsed += dt; updatePlayer(dt); }
  updateDay(dt); updateSheep(dt, t); updateGrazers(dt, t); updateDogs(dt, t);
  if (toastT > 0 && (toastT -= dt) <= 0) $("toast").hidden = true;
  whistleT = Math.max(0, whistleT - dt);
  updateCamera(dt, false);
  poseHerd(sheep, t); poseHerd(goats, t); poseHerd(cows, t); poseHerd(calves, t); poseHerd(geldings, t); poseHerd(mares, t); poseHerd(stallion, t);
  for (const s of smoke) {
    s.userData.t += dt; const p = (s.userData.t % 5) / 5, ch = s.userData.ch;
    s.position.set(ch.x + p * 3, ch.y + p * 6, ch.z + p * 1.2); s.scale.setScalar(.4 + p * 2.2); s.material.opacity = .4 * Math.sin(p * Math.PI);
  }
  if ((mapT -= dt) <= 0) { drawMap(); mapT = .12; }
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
})();

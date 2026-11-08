// A1001 засмал зам дээр хоёр чиглэлд машинууд явна
const fs = require("fs"), path = require("path");
const f = path.join(__dirname, "..", "src", "page.html");
let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 90)); s = s.replace(a, b); };

rep("// ---------- Гэрүүд ----------", `// ---------- Засмал зам дээрх машинууд ----------
const ROAD = (() => {
  const pts = DATA.road || [], cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  return { pts, cum, len: cum[cum.length - 1] || 0 };
})();
function roadAt(sv) {   // замын дагуух байрлал ба чиглэл
  const { pts, cum } = ROAD; let i = 1;
  while (i < cum.length - 1 && cum[i] < sv) i++;
  const t = Math.max(0, Math.min(1, (sv - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1)));
  const [x0, z0] = pts[i - 1], [x1, z1] = pts[i], l = Math.hypot(x1 - x0, z1 - z0) || 1;
  return { x: x0 + (x1 - x0) * t, z: z0 + (z1 - z0) * t, dx: (x1 - x0) / l, dz: (z1 - z0) / l };
}
const CAR_TYPES = [
  { n: "sedan", len: 4.5, w: 1.8, h: .75, cab: [2.3, .6, 1.6, -.1], v: [19, 25] },
  { n: "suv", len: 4.8, w: 1.95, h: 1.0, cab: [2.8, .75, 1.8, -.3], v: [18, 24] },
  { n: "van", len: 4.9, w: 1.9, h: 1.7, cab: [4.0, .3, 1.85, -.3], v: [16, 21] },
  { n: "porter", len: 5.0, w: 1.75, h: .55, cab: [1.4, 1.0, 1.7, 1.6], box: [3.2, 1.0, 1.8, -.9], v: [15, 19] },
  { n: "truck", len: 8.5, w: 2.5, h: .8, cab: [2.2, 1.6, 2.4, 3.0], box: [6.0, 2.4, 2.5, -1.2], v: [12, 16] },
];
const CAR_COLORS = ["#e9e9ea", "#b9bcc2", "#1d1f24", "#9c2a22", "#2f5c99", "#e9e9ea", "#7a7d82", "#d6c9a6"];
const pickCar = (arr) => arr[Math.floor(Math.random() * arr.length)];
const cars = [];
const nightMats = [];   // шөнө гэрэлтэх материал
if (ROAD.len > 100) {
  const glass = std("#1e2a33", { roughness: .2, metalness: .4 }), tire = std("#151515"), rim = std("#a7a9ad", { metalness: .7, roughness: .3 });
  const headM = new THREE.MeshStandardMaterial({ color: "#fff6d8", emissive: new THREE.Color("#fff1c0"), emissiveIntensity: .2 });
  const tailM = new THREE.MeshStandardMaterial({ color: "#7a1010", emissive: new THREE.Color("#ff2a1a"), emissiveIntensity: .2 });
  nightMats.push(headM, tailM);
  const add = (g, mat, sx, sy, sz, x, y, z) => { const m = new THREE.Mesh(BOX, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  for (let i = 0; i < 14; i++) {
    const T = CAR_TYPES[i % 7 === 6 ? 4 : i % 5 === 4 ? 3 : i % 3], col = std(T.n === "truck" ? pickCar(["#2f5c99", "#9c2a22", "#e9e9ea"]) : pickCar(CAR_COLORS), { roughness: .35, metalness: .4 });
    const g = new THREE.Group(), wy = .34;
    add(g, col, T.len, T.h, T.w, 0, wy + .2 + T.h / 2, 0);                                    // их бие
    add(g, T.n === "van" ? col : glass, T.cab[0], T.cab[1], T.cab[2], T.cab[3], wy + .2 + T.h + T.cab[1] / 2, 0);   // кабин
    if (T.n === "van") add(g, glass, T.cab[0] * .9, .45, T.cab[2] * 1.01, T.cab[3], wy + .2 + T.h + .1, 0);
    if (T.box) add(g, T.n === "truck" ? std("#5d5348") : col, T.box[0], T.box[1], T.box[2], T.box[3], wy + .2 + T.h + T.box[1] / 2, 0);
    for (const z of [T.w / 2 - .3, -T.w / 2 + .3]) { add(g, headM, .06, .14, .3, T.len / 2 + .01, wy + .2 + T.h * .55, z); add(g, tailM, .06, .12, .28, -T.len / 2 - .01, wy + .2 + T.h * .55, z); }
    const wheels = [];
    for (const x of [T.len / 2 - .9, -T.len / 2 + .9]) for (const z of [T.w / 2 - .05, -T.w / 2 + .05]) {
      const wgrp = new THREE.Group(); wgrp.position.set(x, wy, z);
      const tr = new THREE.Mesh(CYL, tire); tr.scale.set(wy * 2, .26, wy * 2); tr.rotation.x = Math.PI / 2; wgrp.add(tr);
      const rm = new THREE.Mesh(CYL, rim); rm.scale.set(wy * 1.1, .28, wy * 1.1); rm.rotation.x = Math.PI / 2; wgrp.add(rm);
      g.add(wgrp); wheels.push(wgrp);
    }
    scene.add(g);
    const dir = i % 2 ? 1 : -1;
    cars.push({ g, wheels, T, dir, s: Math.random() * ROAD.len, v: T.v[0] + Math.random() * (T.v[1] - T.v[0]), cur: 0, honkT: 0 });
  }
}
function honk() {
  if (!ac) return;
  const t = ac.currentTime;
  for (const fr of [370, 440]) { const o = ac.createOscillator(), g = ac.createGain(); o.type = "square"; o.frequency.value = fr; g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.035, t + .03); g.gain.setValueAtTime(.035, t + .35); g.gain.exponentialRampToValueAtTime(.0001, t + .45); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + .5); }
}
function updateCars(dt) {
  for (const c of cars) {
    const p = roadAt(c.s), fx = p.dx * c.dir, fz = p.dz * c.dir;
    // урдаа замд малчин/мал байвал удаашраад дохио өгнө
    const ax = P.x - p.x, az = P.z - p.z, ahead = ax * fx + az * fz, side = Math.abs(ax * -fz + az * fx);
    const blockedAhead = ahead > 0 && ahead < 22 && side < 5;
    const target = blockedAhead ? Math.max(0, (ahead - 6) * .6) : c.v;
    c.cur += (target - c.cur) * Math.min(1, dt * (blockedAhead ? 3 : .8));
    if (blockedAhead && ahead < 18 && (c.honkT -= dt) <= 0 && Math.hypot(ax, az) < 60) { honk(); c.honkT = 2.5; }
    c.s += c.cur * dt * c.dir;
    if (c.s > ROAD.len || c.s < 0) {   // замын төгсгөлд хүрвэл нөгөө үзүүрээс дахин гарна
      c.s = c.dir > 0 ? 0 : ROAD.len; c.v = c.T.v[0] + Math.random() * (c.T.v[1] - c.T.v[0]); c.cur = c.v;
    }
    const q = roadAt(c.s), lx = q.dx * c.dir, lz = q.dz * c.dir;
    const x = q.x + (-lz) * 2.3, z = q.z + lx * 2.3;   // баруун гар талын эгнээ
    const yaw = Math.atan2(-lz, lx);
    const y0 = heightAt(x, z), y1 = heightAt(x + lx * 2, z + lz * 2), y2 = heightAt(x - lx * 2, z - lz * 2);
    c.g.position.set(x, y0 + .3, z); c.g.rotation.set(0, yaw, 0); c.g.rotateZ(Math.atan2(y1 - y2, 4));
    for (const w of c.wheels) w.rotation.z -= c.cur * dt / .34;
  }
}

// ---------- Гэрүүд ----------`);
rep("updateDogs(dt, t); updateWolves(dt, t);", "updateDogs(dt, t); updateWolves(dt, t); updateCars(dt);");
rep("  motoParts.lamp.intensity", "  for (const m of nightMats) m.emissiveIntensity = .2 + Math.max(night, dusk * .5) * 2.2;\n  motoParts.lamp.intensity");
rep('  mctx.fillStyle = "#e23b2e"; for (const w of wolves)', '  mctx.fillStyle = "#f2f2f2"; for (const c of cars) { const [cx2, cz2] = toMap(c.g.position.x, c.g.position.z); mctx.fillRect(cx2 - 1.5, cz2 - 1.5, 3, 3); }\n  mctx.fillStyle = "#e23b2e"; for (const w of wolves)');
fs.writeFileSync(f, s);
new Function("(() => {" + s.split("<script>\n(() => {")[1].split("</script>")[0]);
console.log("cars patched");

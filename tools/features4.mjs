// 4×4 км: тариалангийн хүрээг өргөтгөж, ±1 км-ээс гадуурх ойг хиймэл дагуулаас илрүүлнэ.
// ±1 км доторх (хэрэглэгчийн тэмдэглэснээр шүүсэн) мод хэвээр үлдэнэ.
import fs from "node:fs";
const [rgbPath, featPath, terrainPath] = process.argv.slice(2);
const N = 800, CELL = 5, HALFW = 2000;
const rgb = fs.readFileSync(rgbPath);
const feat = JSON.parse(fs.readFileSync(featPath, "utf8"));
const terr = JSON.parse(fs.readFileSync(terrainPath, "utf8"));
const road = (terr.features.find((f) => f.kind.startsWith("road")) || { pts: [] }).pts;

// тариалан (4 км-ийн зургаас тойм)
feat.fields = [
  { crop: "wheat", pts: [[-490, 178], [-356, 178], [-200, 205], [-120, 260], [-50, 350], [10, 440], [60, 560], [40, 700], [-20, 1000], [-90, 1340], [-620, 1340], [-600, 500]] },
  { crop: "green", pts: [[-1220, 330], [-700, 330], [-760, 1280], [-1220, 1280]] },
  { crop: "wheat", pts: [[260, 820], [880, 1000], [880, 1160], [260, 1000]] },
  { crop: "wheat", pts: [[-2000, -2000], [-540, -2000], [-560, -1820], [-660, -1580], [-1320, -1740], [-2000, -1880]] },
  { crop: "wheat", pts: [[-620, -1580], [-480, -1880], [-120, -2000], [240, -2000], [-120, -1200], [-320, -1100], [-440, -1320]] },
  { crop: "wheat", pts: [[-2000, -1040], [-1480, -1260], [-960, -1360], [-780, -1300], [-920, -1040], [-1080, -720], [-1320, -240], [-1640, 240], [-2000, 640]] },
  { crop: "wheat", pts: [[-1200, 1280], [-960, 1280], [-960, 2000], [-1200, 2000]] },
  { crop: "wheat", pts: [[-2000, 640], [-1600, 400], [-1240, 320], [-1220, 560], [-1520, 1040], [-2000, 1320]] },
  { crop: "wheat", pts: [[-740, 1280], [-480, 1280], [-480, 2000], [-740, 2000]] },
];
const NOT_FOREST = [[[-2000, -1840], [-680, -1560], [-800, -1300], [-2000, -1040]], [[-2000, 1000], [-1300, 1000], [-1300, 2000], [-2000, 2000]]];
const inPoly = (x, z, pts) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, zi] = pts[i], [xj, zj] = pts[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c; } return c; };
const segDist = (x, z, pts) => { let b = 1e9; for (let i = 0; i < pts.length - 1; i++) { const [ax, az] = pts[i], [bx, bz] = pts[i + 1]; const dx = bx - ax, dz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); b = Math.min(b, Math.hypot(x - ax - t * dx, z - az - t * dz)); } return b; };

const lum = new Float32Array(N * N);
for (let i = 0; i < N * N; i++) lum[i] = .299 * rgb[i * 3] + .587 * rgb[i * 3 + 1] + .114 * rgb[i * 3 + 2];
const sorted = [...lum].sort((a, b) => a - b), p12 = sorted[Math.floor(.12 * sorted.length)];
const R = 6, local = new Float32Array(N * N);
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  let s = 0, c = 0;
  for (let j = Math.max(0, y - R); j <= Math.min(N - 1, y + R); j += 2) for (let i = Math.max(0, x - R); i <= Math.min(N - 1, x + R); i += 2) { s += lum[j * N + i]; c++; }
  local[y * N + x] = s / c;
}
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const keep = feat.trees.filter(([x, z]) => Math.abs(x) <= 1000 && Math.abs(z) <= 1000);
const added = [];
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const wx = -HALFW + (x + .5) * CELL, wz = -HALFW + (y + .5) * CELL;
  if (Math.abs(wx) <= 1000 && Math.abs(wz) <= 1000) continue;            // дотор хэсэг: хэрэглэгчийн тохируулсан хэвээр
  if (Math.abs(wx) > 1950 || Math.abs(wz) > 1950) continue;
  const i = y * N + x;
  if (!(lum[i] < p12 && lum[i] < local[i] - 9)) continue;
  if (feat.fields.some((f) => inPoly(wx, wz, f.pts))) continue;
  if (NOT_FOREST.some((p) => inPoly(wx, wz, p))) continue;   // бараан нойтон нуга, бут — ой биш
  if (segDist(wx, wz, road) < 20) continue;
  if (feat.creeks.some((c) => segDist(wx, wz, c.pts) < 24)) continue;
  if (feat.camps.some((c) => Math.hypot(wx - c.x, wz - c.z) < c.r + 15)) continue;
  const k = 1 + (rnd() < .4 ? 1 : 0);
  for (let t = 0; t < k; t++) added.push([Math.round(-HALFW + (x + rnd()) * CELL), Math.round(-HALFW + (y + rnd()) * CELL)]);
}
feat.trees = keep.concat(added);
fs.writeFileSync(featPath, JSON.stringify(feat));
console.log("kept inner", keep.length, "added outer", added.length, "total", feat.trees.length);

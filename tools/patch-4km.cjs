// 4×4 км талбай, 12 км алсын уулс, хад чулуу, адууны сүргийн нүүдэл ба сануулга
// node tools/patch-4km.cjs <dem4k.json>
const fs = require("fs"), path = require("path");
const root = path.join(__dirname, "..");
const f = path.join(root, "src", "page.html");
let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 90)); s = s.replace(a, b); };

// ---- өгөгдөл ----
const dem = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const terr = JSON.parse(fs.readFileSync(path.join(root, "data", "terrain-data.json"), "utf8"));
const feat = JSON.parse(fs.readFileSync(path.join(root, "data", "features.json"), "utf8"));
const roadAll = (terr.features.find((x) => x.kind.startsWith("road")) || { pts: [] }).pts;
const inside = (p) => p && Math.abs(p[0]) < 5900 && Math.abs(p[1]) < 5900;
const road = roadAll.filter((p, i) => inside(p) || inside(roadAll[i + 1]) || inside(roadAll[i - 1])).map((p) => p.map(Math.round));
const DATA = { center: terr.center, near4: dem.near4, far: dem.far12, road, features: feat };
const m = s.match(/const DATA = .*;\n<\/script>/);
if (!m) throw new Error("DATA not found");
s = s.replace(m[0], () => "const DATA = " + JSON.stringify(DATA) + ";\n</script>");

// ---- газрын гадарга: 3 давхар ----
rep("const NEAR = DATA.near2, HALF = NEAR.size / 2;", "const NEAR = DATA.near4, HALF = NEAR.size / 2;");
rep("function terrainMesh(size, seg, sink, near) {", "function terrainMesh(size, seg, sinkHalf, near) {");
rep("    if (sink && Math.max(Math.abs(x), Math.abs(z)) < HALF - 8) y -= 5;", "    if (sinkHalf && Math.max(Math.abs(x), Math.abs(z)) < sinkHalf - 8) y -= 4;   // доторх нарийн давхаргын доор нуугдана");
rep("scene.add(terrainMesh(NEAR.size, 300, false, true));\nscene.add(terrainMesh(DATA.far.size, 170, true, false));",
    "scene.add(terrainMesh(2000, 300, 0, true));                 // гэрийн орчим 2 км: нарийн\nscene.add(terrainMesh(NEAR.size, LOW ? 200 : 280, 1000, true)); // 4 км\nscene.add(terrainMesh(DATA.far.size, 170, HALF, false));        // алсын уулс 12 км");
rep('scene.fog = new THREE.Fog("#d6cfb8", 450, 3400);', 'scene.fog = new THREE.Fog("#d6cfb8", 700, 7000);');
rep("new THREE.PerspectiveCamera(55, 1, .2, 9000);", "new THREE.PerspectiveCamera(55, 1, .2, 16000);");
rep("new THREE.SphereGeometry(6000, 32, 16)", "new THREE.SphereGeometry(12000, 32, 16)");

// ---- мод: утсанд гадна талынхыг хагасална ----
rep("  const N = F.trees.length;", "  const TREES = LOW ? F.trees.filter(([x, z], i) => (Math.abs(x) <= 1000 && Math.abs(z) <= 1000) || i % 2 === 0) : F.trees;\n  const N = TREES.length;");
rep("  F.trees.forEach(([x, z], i) => {\n    const h = 7 + hash(i * 3.1) * 7, y = heightAt(x, z);", "  TREES.forEach(([x, z], i) => {\n    const h = 7 + hash(i * 3.1) * 7, y = heightAt(x, z);");

// ---- хад чулуу: эгц энгэр, оройд ----
rep("// ---------- Туслах дүрсүүд ----------", `// ---------- Хад чулуу (бодит налуу, оройгоор) ----------
{
  const spots = [];
  const lim = HALF - 60, step = LOW ? 16 : 11;
  for (let x = -lim; x <= lim; x += step) for (let z = -lim; z <= lim; z += step) {
    const jx = x + (hash(x * 7.1 + z) - .5) * step, jz = z + (hash(z * 3.3 - x) - .5) * step;
    if (Math.hypot(jx - 10, jz - 20) < 90 || fieldAt(jx, jz)) continue;
    const h = heightAt(jx, jz), e = 6;
    const sl = Math.hypot(heightAt(jx + e, jz) - heightAt(jx - e, jz), heightAt(jx, jz + e) - heightAt(jx, jz - e)) / (2 * e);
    const ridge = h - (heightAt(jx + 40, jz) + heightAt(jx - 40, jz) + heightAt(jx, jz + 40) + heightAt(jx, jz - 40)) / 4;
    const p = Math.max(0, sl - .32) * 2.2 + Math.max(0, ridge - 3) * .06;
    if (hash(jx * 1.7 + jz * 9.1) < p) spots.push([jx, jz, Math.min(1, sl * 1.5 + ridge * .05)]);
  }
  const rocks = spots.slice(0, LOW ? 1400 : 3200);
  const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 1, flatShading: true }), rocks.length * 2);
  const mm = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), col = new THREE.Color(), eu = new THREE.Euler();
  let k = 0;
  rocks.forEach(([x, z, big], i) => {
    for (let n = 0; n < 2; n++) {
      const r = (.6 + hash(i * 3 + n) * 1.6) * (1 + big * 2.2), ox = n ? (hash(i + 7) - .5) * r * 2 : 0, oz = n ? (hash(i + 9) - .5) * r * 2 : 0;
      q.setFromEuler(eu.set(hash(i) * 3, hash(i * 2 + n) * 6, hash(i * 5) * 3));
      mm.compose(v.set(x + ox, heightAt(x + ox, z + oz) + r * .25, z + oz), q, sc.set(r * (1 + hash(i * 11) * .6), r * (.55 + hash(i * 13) * .5), r * (1 + hash(i * 17) * .5)));
      im.setMatrixAt(k, mm); im.setColorAt(k, col.setHSL(.08 + hash(i) * .04, .08 + hash(i * 3) * .08, .36 + hash(i * 7) * .16).convertSRGBToLinear()); k++;
    }
  });
  im.castShadow = im.receiveShadow = true; scene.add(im);
}

// ---------- Туслах дүрсүүд ----------`);

// ---- адууны сүрэг нүүдэллэнэ, холдоход сануулна, орой давхиж ирнэ ----
rep('if (a.state === "walk") speed = gs.speed * (d < 30 ? 1.4 : 1);',
    'if (a.state === "walk") speed = gs.state === "outing" && gs.roaming ? 1.5 : gs.speed * (d < 30 ? 1.4 : 1) * (gs.state === "driven" && Math.hypot(a.x - gs.home.x, a.z - gs.home.z) > 300 ? 1.8 : 1);');
rep('  if (p === "morning") { scheduleBirths(8, 16);',
    '  if (p === "morning") { for (const g of HORSE_GROUPS) { g.pasture = { ...g.pasture0 }; g.roaming = false; g.roamT = 50 + Math.random() * 40; } scheduleBirths(8, 16);');
rep('    if (DAY.phase === "day" && !DAY.out) {', `    if (DAY.phase === "day") for (const g of HORSE_GROUPS) {   // адуу санамсаргүй хол нүүнэ
      if (g.state === "outing" && g.roaming) { const L = g.list(); let k = 0; for (const a of L) if (Math.hypot(a.x - g.pasture.x, a.z - g.pasture.z) < g.r) k++; if (k > L.length * .7) { g.state = "pasture"; g.roaming = false; } }
      if (g.state === "pasture" && (g.roamT -= dt) <= 0) {
        g.roamT = 60 + Math.random() * 70;
        for (let tries = 0; tries < 12; tries++) {
          const ang = g.roamDir + (Math.random() - .5) * 2.4, dist = 220 + Math.random() * 380;
          const nx = Math.max(-HALF + 120, Math.min(HALF - 120, g.pasture.x + Math.cos(ang) * dist)), nz = Math.max(-HALF + 120, Math.min(HALF - 120, g.pasture.z + Math.sin(ang) * dist));
          if (!fieldAt(nx, nz) && Math.hypot(nx - CAMP.x, nz - CAMP.z) > 250) { g.pasture = { x: nx, z: nz }; g.state = "outing"; g.roaming = true; break; }
        }
      }
      let cx = 0, cz = 0; const L = g.list(); for (const a of L) { cx += a.x; cz += a.z; } cx /= L.length; cz /= L.length;
      if ((g.warnT = (g.warnT || 0) - dt) <= 0 && Math.hypot(cx - CAMP.x, cz - CAMP.z) > 1000) { toast(\`🐎 \${g.name} холдлоо шүү! (\${(Math.hypot(cx - CAMP.x, cz - CAMP.z) / 1000).toFixed(1)} км)\`); toastT = 5; g.warnT = 30; }
    }
    if (DAY.phase === "day" && !DAY.out) {`);
rep("const GRAZERS = [", `const HORSE_GROUPS = [GROUPS.geld, GROUPS.harem];
GROUPS.geld.roamDir = -.5; GROUPS.harem.roamDir = .5;          // ихэвчлэн зүүн хойш / зүүн урагш
for (const g of HORSE_GROUPS) { g.pasture0 = { ...g.pasture }; g.roamT = 50 + Math.random() * 40; }
const GRAZERS = [`);
fs.writeFileSync(f, s);
new Function("(() => {" + s.split("<script>\n(() => {")[1].split("</script>")[0]);
console.log("4km patched; data", (JSON.stringify(DATA).length / 1024).toFixed(0), "KB");

// Хашаанаас гарах засвар, хурд нэмэх, шөнийн чоно (2 удаа), нохой хөөх, буудаж үргээх
const fs = require("fs"), path = require("path");
const f = path.join(__dirname, "..", "src", "page.html");
let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 90)); s = s.replace(a, b); };

// ---- 1. Өглөө хашаанаас: эхлээд хаалганы өмнө, дараа нь гадагш ----
rep("      sx += (H.x + (a.phase % 3 - 1.5) - a.x) * .3; sz += (H_S + 4 - a.z) * .3; out = true;",
`      const r = penRoute(a, H, false) || [H.x, H_S + 5];
      const ex = r[0] + (r[1] > H_S ? (a.phase % 3 - 1.5) : 0) - a.x, ez = r[1] - a.z, ed = Math.hypot(ex, ez) || 1;
      sx += ex / ed * 3; sz += ez / ed * 3; out = true;`);
// ---- 2. Хурдан болгох ----
rep("max = (follow ? 4.5 : alert ? 3.6 : out ? 1.5 : .7)", "max = (follow ? 4.5 : alert ? 3.8 : out ? 2.4 : .7)");
rep("state: \"pasture\", speed: 1.7, list: () => cows.animals", "state: \"pasture\", speed: 2.4, list: () => cows.animals");
rep("state: \"pasture\", speed: 3, list: () => geldings.animals", "state: \"pasture\", speed: 3.8, list: () => geldings.animals");
rep("state: \"pasture\", speed: 2.6, list: () => mares.animals.concat(stallion.animals)", "state: \"pasture\", speed: 3.4, list: () => mares.animals.concat(stallion.animals)");

// ---- 3. Шөнө: чоно ирэх хүртэл унтахгүй ----
rep('  if (p === "night") { DAY.nightT = 0; $("sleepBtn").hidden = false; toast("Бүх мал гэртээ ирлээ! Гэртээ очоод «Унтах» товчийг дарна уу."); toastT = 6; }',
    '  if (p === "night") { DAY.nightT = 0; startWolfNight(); toast("Бүх мал гэртээ ирлээ. Анхаар, шөнө чоно ирж магадгүй!"); toastT = 6; }');
rep('  if (DAY.phase !== "night" || sleeping) return;', '  if (DAY.phase !== "night" || sleeping) return;\n  if (!WOLF.done) { toast("Чоно ирж магадгүй, сэрэмжтэй бай."); return; }');

// ---- 4. Нохой: чоно байвал хуцаж хөөнө ----
rep("    let tx, tz, speed = 0;\n    if (started && pd < 90) {",
`    let tx, tz, speed = 0;
    const wolf = wolfTarget(d);
    if (wolf) {   // чоно руу хуцаж хөөнө
      tx = wolf.x; tz = wolf.z; d.mode = "chase";
      speed = Math.hypot(tx - d.x, tz - d.z) < 3 ? 2 : 12;
      if ((d.barkCd = (d.barkCd || 0) - dt) <= 0) { bark(); d.barkCd = .7 + Math.random() * .6; }
    } else if (started && pd < 90) {`);

// ---- 5. Чонын систем ----
rep("// ---------- Төллөлт: өдөр бүр нэг хонь", `// ---------- Шөнийн чоно ----------
const WOLF = { waves: 0, done: true, phase: "idle", t: 0, losses: 0 };
const wolves = [];
{
  const grey = std("#8b857a"), dark = std("#4f4a43"), light = std("#c9c2b4"), eye = new THREE.MeshBasicMaterial({ color: "#ffd34d" });
  const mk = (geo, mat, sx, sy, sz, x, y, z, parent) => { const m = new THREE.Mesh(geo, mat); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = true; parent.add(m); return m; };
  for (let k = 0; k < 2; k++) {
    const g = new THREE.Group(), body = new THREE.Group(); g.add(body);
    mk(SPH, grey, 1.15, .5, .42, 0, .72, 0, body);
    mk(SPH, light, .7, .3, .36, .1, .6, 0, body);
    const legs = [[.36, .13], [.36, -.13], [-.36, .13], [-.36, -.13]].map(([x, z], i) => {
      const p = new THREE.Group(); p.position.set(x, .6, z); p.userData.ph = i === 0 || i === 3 ? 0 : Math.PI;
      mk(CYL, grey, .1, .62, .1, 0, -.31, 0, p); body.add(p); return p;
    });
    const head = new THREE.Group(); head.position.set(.7, .92, 0); body.add(head);
    mk(SPH, grey, .36, .3, .3, 0, 0, 0, head);
    mk(CONE, grey, .2, .38, .2, .3, -.05, 0, head).rotation.z = -Math.PI / 2;      // хошуу
    for (const sd of [1, -1]) { mk(CONE, dark, .1, .2, .06, -.04, .2, sd * .1, head); mk(SPH, eye, .06, .05, .06, .14, .06, sd * .1, head); }
    const tail = new THREE.Group(); tail.position.set(-.58, .78, 0); tail.rotation.z = -2.2; body.add(tail);
    mk(SPH, dark, .2, .55, .2, 0, .25, 0, tail);
    g.visible = false; scene.add(g);
    wolves.push({ g, body, legs, x: 0, z: 0, yaw: 0, phase: 0, state: "off", t: 0 });
  }
}
function howl() {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(680, t + .8); o.frequency.linearRampToValueAtTime(560, t + 2.2);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.08, t + .4); g.gain.exponentialRampToValueAtTime(.0001, t + 2.4);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 2.5);
}
function gunshot() {
  if (!ac) return;
  const t = ac.currentTime, len = Math.floor(ac.sampleRate * .35), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = ac.createBufferSource(), lp = ac.createBiquadFilter(), g = ac.createGain();
  src.buffer = buf; lp.type = "lowpass"; lp.frequency.value = 2200; g.gain.value = .5;
  src.connect(lp).connect(g).connect(ac.destination); src.start(t);
}
const flash = new THREE.PointLight("#ffd28a", 0, 40, 2); scene.add(flash);
function startWolfNight() { Object.assign(WOLF, { waves: 0, done: false, phase: "wait", t: 6 + Math.random() * 4 }); }
function wolfTarget(dog) {
  if (WOLF.phase !== "come" && WOLF.phase !== "eat") return null;
  let best = null, bd = 1e9;
  for (const w of wolves) if (w.state === "come" || w.state === "eat") { const dd = Math.hypot(w.x - dog.x, w.z - dog.z); if (dd < bd) { bd = dd; best = w; } }
  return best;
}
function spawnWolves() {
  const a = -Math.PI / 2 + (Math.random() - .5) * 2.2, r = 170;   // ихэвчлэн хойд зүгийн ойноос
  wolves.forEach((w, i) => {
    Object.assign(w, { x: H.x + Math.cos(a) * r + i * 4, z: H.z + Math.sin(a) * r + i * 3, state: "come", t: 0 });
    w.g.visible = true;
  });
  WOLF.phase = "come"; WOLF.waves++;
  howl(); setTimeout(howl, 900);
  toast(\`🐺 Чоно ирж байна! (\${WOLF.waves}-р удаа) Нохой хуцаж байна. «Буудах» товчоор үргээ!\`); toastT = 5;
}
function scareWolves(msg) {
  for (const w of wolves) if (w.state !== "off") { const dx = w.x - H.x, dz = w.z - H.z, d = Math.hypot(dx, dz) || 1; w.state = "flee"; w.fx = w.x + dx / d * 220; w.fz = w.z + dz / d * 220; }
  WOLF.phase = "flee"; toast(msg); toastT = 4;
}
function shoot() {
  if (!started) return;
  gunshot(); flash.position.set(P.x, player.position.y + 2, P.z); flash.intensity = 6;
  if (WOLF.phase === "come" || WOLF.phase === "eat") {
    const near = wolves.some((w) => w.state !== "off" && Math.hypot(w.x - P.x, w.z - P.z) < 90);
    if (near) scareWolves("💥 Буудлаа! Чоно үргээд зугтлаа.");
    else { toast("Чоно хэтэрхий хол байна. Ойртоод буудаарай."); toastT = 3; }
  }
}
function wolfKill() {
  const inside = FLOCK.filter((a) => a.penned);
  if (!inside.length) return;
  let best = inside[0], bd = 1e9;
  for (const a of inside) { const dd = Math.hypot(a.x - wolves[0].x, a.z - wolves[0].z); if (dd < bd) { bd = dd; best = a; } }
  best.hidden = true; FLOCK.splice(FLOCK.indexOf(best), 1); WOLF.losses++;
  $("total").textContent = FLOCK.length;
  scareWolves(\`🐺 Чоно \${best.goat ? "1 ямаа" : "1 хонь"} бариад явчихлаа! (Алдагдал: \${WOLF.losses})\`); toastT = 5;
}
function updateWolves(dt, t) {
  if (WOLF.done) return;
  flash.intensity = Math.max(0, flash.intensity - dt * 30);
  if (WOLF.phase === "wait") { if ((WOLF.t -= dt) <= 0) spawnWolves(); return; }
  let active = 0;
  for (const w of wolves) {
    if (w.state === "off") continue;
    active++;
    let tx = w.x, tz = w.z, sp = 0;
    const dogNear = dogs.some((d) => Math.hypot(d.x - w.x, d.z - w.z) < 6);
    if (w.state === "come") {
      tx = H.x + (w === wolves[0] ? -6 : 6); tz = H.z - H.d / 2 - 3;   // хашааны ард талаас
      sp = dogNear ? 3 : 7;
      if (Math.hypot(tx - w.x, tz - w.z) < 2) { w.state = "eat"; w.t = 9; WOLF.phase = "eat"; toast("🐺 Чоно хашаанд ирлээ! Яаралтай буудаарай!"); toastT = 4; }
    } else if (w.state === "eat") {
      w.t -= dt * (dogNear ? .4 : 1);
      if (w.t <= 0 && WOLF.phase === "eat") wolfKill();
    } else if (w.state === "flee") {
      tx = w.fx; tz = w.fz; sp = 11;
      if (Math.hypot(tx - w.x, tz - w.z) < 3) { w.state = "off"; w.g.visible = false; active--; }
    }
    if (sp) {
      let df = Math.atan2(-(tz - w.z), tx - w.x) - w.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); w.yaw += df * Math.min(1, dt * 5);
      w.x += Math.cos(w.yaw) * sp * dt; w.z -= Math.sin(w.yaw) * sp * dt; w.phase += dt * sp * 3.5;
    }
    w.g.position.set(w.x, heightAt(w.x, w.z), w.z); w.g.rotation.y = w.yaw;
    for (const l of w.legs) l.rotation.z = sp ? Math.sin(w.phase + l.userData.ph) * .8 : 0;
  }
  if (WOLF.phase === "flee" && active === 0) {
    if (WOLF.waves < 2) { WOLF.phase = "wait"; WOLF.t = 18 + Math.random() * 12; }
    else { WOLF.done = true; WOLF.phase = "idle"; $("sleepBtn").hidden = false; toast("Чоно дахиж ирэхгүй бололтой. Гэртээ очоод «Унтах» дарна уу."); toastT = 6; }
  }
  $("shootBtn").hidden = !(WOLF.phase === "come" || WOLF.phase === "eat");
}
$("shootBtn").onclick = () => shoot();
addEventListener("keydown", (e) => { if (e.code === "KeyF" && !e.repeat) shoot(); });

// ---------- Төллөлт: өдөр бүр нэг хонь`);
rep("updateBirths(); updateSheep(dt, t); updateGrazers(dt, t); updateDogs(dt, t);", "updateBirths(); updateSheep(dt, t); updateGrazers(dt, t); updateDogs(dt, t); updateWolves(dt, t);");
rep("  for (const b of NEWBORNS) {", "  mctx.fillStyle = \"#e23b2e\"; for (const w of wolves) if (w.state !== \"off\") { const [wx, wz] = toMap(w.x, w.z); mctx.beginPath(); mctx.arc(wx, wz, 3.5, 0, 7); mctx.fill(); }\n  for (const b of NEWBORNS) {");

// ---- 6. HTML ----
rep('<button class="act sleep" id="tolBtn" hidden>🍼 Төл авах</button>', '<button class="act sleep" id="tolBtn" hidden>🍼 Төл авах</button>\n  <button class="act shoot" id="shootBtn" hidden>💥 Буудах</button>');
rep(".act.fs { padding: 10px 14px; font-size: 18px; }", ".act.fs { padding: 10px 14px; font-size: 18px; }\n.act.shoot { background: #b3261e; color: #fff; border-color: #b3261e; font-size: 17px; padding: 14px 22px; }");
rep("<kbd>E</kbd> — төл авах<br>", "<kbd>E</kbd> — төл авах · <kbd>F</kbd> — буудах<br>");
rep("<li>Бүх малаа хашаалсны дараа", "<li>🐺 Бүх мал хашаанд орсны дараа шөнө 2 чоно 2 удаа ирнэ. Нохой хуцаж хөөнө. Чоно ойртоход <b>Буудах</b> (F) дарж үргээ. Үргээхгүй бол чоно мал бариад явна.</li>\n      <li>Бүх малаа хашаалсны дараа");
fs.writeFileSync(f, s);
new Function("(() => {" + s.split("<script>\n(() => {")[1].split("</script>")[0]);
console.log("wolves patched");

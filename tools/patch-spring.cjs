// Хаврын хувилбар: шар газар, ногоорсон жалга; хашаанд төл; өдөр бүр төллөлт
const fs = require("fs"), path = require("path");
const f = path.join(__dirname, "..", "src", "page.html");
let s = fs.readFileSync(f, "utf8");
const rep = (a, b) => { if (!s.includes(a)) throw new Error("missing: " + a.slice(0, 90)); s = s.replace(a, b); };

// ---- 1. Хаврын өнгө ----
rep("  buuts: new THREE.Color(\"#4e4030\"),", "  spr: new THREE.Color(\"#b9a66a\"), spr2: new THREE.Color(\"#a38d58\"), sprG: new THREE.Color(\"#76a043\"),\n  buuts: new THREE.Color(\"#4e4030\"),");
rep("  c.copy(C.lush).lerp(C.dry, n * .8).lerp(C.north, Math.min(.6, northFacing)).lerp(C.steep, Math.max(0, slope - .25) * .9);",
`  // хавар: дов толгод хуурай шар, жалга хөндий ногоорсон
  const valley = Math.max(0, Math.min(1, ((heightAt(x + 35, z) + heightAt(x - 35, z) + heightAt(x, z + 35) + heightAt(x, z - 35)) / 4 - heightAt(x, z)) / 2.5));
  c.copy(C.spr).lerp(C.spr2, n * .9).lerp(C.steep, Math.max(0, slope - .25) * .9).lerp(C.sprG, valley * .9);`);
rep("crown.setColorAt(i, col.setHSL(.27 + hash(i * 7) * .06, .38, .17 + hash(i * 5) * .08).convertSRGBToLinear());",
    "crown.setColorAt(i, col.setHSL(.24 + hash(i * 7) * .05, .42, .24 + hash(i * 5) * .08).convertSRGBToLinear());   // хаврын шинэс");
rep("im.setMatrixAt(i, m); im.setColorAt(i, col.setHSL(.2 + Math.random() * .06, .35 + Math.random() * .2, .3 + Math.random() * .12).convertSRGBToLinear());",
`const vl = ((heightAt(x + 30, z) + heightAt(x - 30, z) + heightAt(x, z + 30) + heightAt(x, z - 30)) / 4 - heightAt(x, z)) / 2.5;
    im.setMatrixAt(i, m); im.setColorAt(i, (vl > .35 ? col.setHSL(.22 + Math.random() * .05, .45, .3 + Math.random() * .1) : col.setHSL(.11 + Math.random() * .04, .35 + Math.random() * .15, .4 + Math.random() * .1)).convertSRGBToLinear());`);
rep('    c.set(f ? (f.crop === "green" ? "#3f5f2a" : "#cdb47e") : "#7d9a4c");',
`    c.set(f ? (f.crop === "green" ? "#3f5f2a" : "#cdb47e") : "#b3a066");
    if (!f) c.lerp(new THREE.Color("#76a043"), Math.max(0, Math.min(1, ((heightAt(x + 35, z) + heightAt(x - 35, z) + heightAt(x, z + 35) + heightAt(x, z - 35)) / 4 - h) / 2.5)) * .9);`);

// ---- 2. Сүрэг: насанд хүрсэн; төл хашаанд ----
rep("const sheep = makeHerd(\"sheep\", 300, around(SHEEP0.x, SHEEP0.z, 20));", "const sheep = makeHerd(\"sheep\", 300, around(SHEEP0.x, SHEEP0.z, 20), 0);");
rep("const goats = makeHerd(\"goat\", 200, around(SHEEP0.x + 6, SHEEP0.z - 4, 18), .3, .55);", "const goats = makeHerd(\"goat\", 200, around(SHEEP0.x + 6, SHEEP0.z - 4, 18), 0);");
rep("const calves = makeHerd(\"cow\", 21, inRect(CP, 1.2), 1, .55);",
`// хашаандаа байгаа төл (шинэ төлд нөөц байр)
const TOL0 = { lamb: 58, kid: 39, calf: 5 }, TOL_SPARE = 30;
const calves = makeHerd("cow", TOL0.calf + TOL_SPARE, inRect(CP, 1.2), 1, .55);
const lambs = makeHerd("sheep", TOL0.lamb + TOL_SPARE, inRect(H, 1.5), 1, .5);
const kids = makeHerd("goat", TOL0.kid + TOL_SPARE, inRect(H, 1.5), 1, .5);
for (const [h, n] of [[calves, TOL0.calf], [lambs, TOL0.lamb], [kids, TOL0.kid]]) h.animals.slice(n).forEach((a) => (a.hidden = true));`);
rep("{ h: calves, rect: CP, flee: 0, calf: true }", "{ h: calves, rect: CP, flee: 0, confine: CP }, { h: lambs, rect: H, flee: 0, confine: H }, { h: kids, rect: H, flee: 0, confine: H }");
rep("function blocked(ox, oz, nx, nz, animal, calf) {\n  if (calf && inPenP(CP, ox, oz, .3) && !inPenP(CP, nx, nz, .3)) return true;",
    "function blocked(ox, oz, nx, nz, animal, confine) {\n  if (confine && inPenP(confine, ox, oz, .3) && !inPenP(confine, nx, nz, .3)) return true;   // төл хашаанаасаа гарахгүй");
s = s.split("true, G.calf)").join("true, G.confine)");

// ---- 3. Дүрслэл: нуугдсан, хэвтсэн нярай, тэвэрсэн төл ----
rep("    const a = animals[i];\n    if ((a.x - cx) ** 2 + (a.z - cz) ** 2 > 260 * 260 && (i + frameNo) % 6) continue;\n    rig.root.position.set(a.x, heightAt(a.x, a.z), a.z);",
`    const a = animals[i];
    if (a.hidden) { if (!a.zeroed) { for (const p of parts) for (let k = 0; k < p.nodes.length; k++) p.im.setMatrixAt(i * p.nodes.length + k, ZERO); a.zeroed = true; } continue; }
    a.zeroed = false;
    if (!a.cy && (a.x - cx) ** 2 + (a.z - cz) ** 2 > 260 * 260 && (i + frameNo) % 6) continue;
    rig.root.position.set(a.x, a.cy || heightAt(a.x, a.z), a.z);`);
rep("    if (a.rear > .01) { rig.root.rotateZ(a.rear); rig.root.position.y += a.rear * .5; }",
    "    if (a.rear > .01) { rig.root.rotateZ(a.rear); rig.root.position.y += a.rear * .5; }\n    if (a.lie) rig.root.position.y -= S.leg * a.scale * .75;   // шинэ төрсөн нярай хэвтэнэ");

// ---- 4. Эх нь нярайныхаа дэргэд, төлөө авахад таныг дагана ----
rep("    } else if (!a.penned) {\n      const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);",
`    } else if (a.baby && (a.stay || a.followP)) {   // нярайныхаа дэргэд / төлөө авсан малчныг дагана
      const tx = a.stay ? a.baby.x : P.x, tz = a.stay ? a.baby.z : P.z, fd = Math.hypot(tx - a.x, tz - a.z), keep = a.stay ? 1.2 : 5;
      if (fd > keep) { sx += (tx - a.x) / fd * 3; sz += (tz - a.z) / fd * 3; }
      follow = true;
    } else if (!a.penned) {
      const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);`);
rep("    if (a === ST && updateStallion(dt, t)) continue;\n",
`    if (a === ST && updateStallion(dt, t)) continue;
    if (a.hidden || a.state === "newborn" || a.state === "carried") continue;
    if (a.baby && (a.stay || a.followP)) {   // үнээ тугалынхаа дэргэд / малчныг дагана
      const tx = a.stay ? a.baby.x : P.x, tz = a.stay ? a.baby.z : P.z, fx = tx - a.x, fz = tz - a.z, fd = Math.hypot(fx, fz), keep = a.stay ? 1.8 : 6;
      let sp = 0;
      if (fd > keep) {
        sp = Math.min(4, fd); let df = Math.atan2(-fz, fx) - a.yaw; df = Math.atan2(Math.sin(df), Math.cos(df)); a.yaw += df * Math.min(1, dt * 4);
        const nx = a.x + Math.cos(a.yaw) * sp * dt, nz = a.z - Math.sin(a.yaw) * sp * dt;
        if (!blocked(a.x, a.z, nx, nz, true)) { a.x = nx; a.z = nz; } else if (!blocked(a.x, a.z, nx, a.z, true)) a.x = nx; else if (!blocked(a.x, a.z, a.x, nz, true)) a.z = nz;
      }
      a.speed = sp; a.phase += dt * sp * 6.5;
      a.neck += ((sp < .2 ? GRAZE : -G.h.S.neckAng) - a.neck) * Math.min(1, dt * 2.5);
      continue;
    }
`);

// ---- 5. Төллөлтийн систем ----
rep("// ---------- Өдөр шөнийн мөчлөг ----------", `// ---------- Төллөлт: өдөр бүр нэг хонь, нэг ямаа, нэг үхэр ----------
const BIRTH_KIND = {
  sheep: { herd: () => lambs, moms: () => sheep.animals, pen: () => H, verb: "Хонь хурагалжээ", young: "Хурга", acc: "Хургыг" },
  goat:  { herd: () => kids, moms: () => goats.animals, pen: () => H, verb: "Ямаа ишиглэжээ", young: "Ишиг", acc: "Ишгийг" },
  cow:   { herd: () => calves, moms: () => cows.animals, pen: () => CP, verb: "Үнээ тугаллажээ", young: "Тугал", acc: "Тугалыг" },
};
const NEWBORNS = []; let carrying = null, tolNear = null, tolAtPen = false;
const tolCount = () => [lambs, kids].reduce((s, h) => s + h.animals.filter((a) => !a.hidden && a.state !== "newborn" && a.state !== "carried").length, 0);
const calfCount = () => calves.animals.filter((a) => !a.hidden && a.state !== "newborn" && a.state !== "carried").length;
function scheduleBirths(from, to) { DAY.births = Object.keys(BIRTH_KIND).map((k) => ({ k, h: from + Math.random() * (to - from) })).sort((a, b) => a.h - b.h); }
function bleat() {
  if (!ac) return;
  const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), l = ac.createOscillator(), lg = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(520, t); o.frequency.linearRampToValueAtTime(440, t + .5);
  l.frequency.value = 9; lg.gain.value = 40; l.connect(lg).connect(o.frequency);
  g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(.07, t + .05); g.gain.exponentialRampToValueAtTime(.0001, t + .6);
  o.connect(g).connect(ac.destination); o.start(t); l.start(t); o.stop(t + .6); l.stop(t + .6);
}
function giveBirth(k) {
  const B = BIRTH_KIND[k], baby = B.herd().animals.find((a) => a.hidden);
  const moms = B.moms().filter((m) => !m.baby && !inPenP(PENS.sheep, m.x, m.z, -.3) && !inPenP(CP, m.x, m.z, -.3));
  if (!baby || !moms.length) return;
  const m = moms[Math.floor(Math.random() * moms.length)];
  Object.assign(baby, { hidden: false, state: "newborn", kind: k, mom: m, lie: true, speed: 0, neck: -.3, cy: 0,
    x: m.x - Math.cos(m.yaw) * 1.5, z: m.z + Math.sin(m.yaw) * 1.5, yaw: m.yaw + 1.3 });
  m.baby = baby; m.stay = true; m.followP = false;
  NEWBORNS.push(baby);
  toast(\`🍼 \${B.verb}! \${B.acc} нь авч хашаандаа хийгээрэй.\`); toastT = 6; bleat();
}
function tolAction() {
  if (!started) return;
  if (tolNear && !carrying) {
    carrying = tolNear; tolNear = null;
    Object.assign(carrying, { state: "carried", lie: false });
    carrying.mom.stay = false; carrying.mom.followP = true;
    bleat(); toast(\`\${BIRTH_KIND[carrying.kind].young} авлаа. Хашаандаа аваачаарай, эх нь араас дагана.\`); toastT = 4;
  } else if (carrying && tolAtPen) {
    const B = BIRTH_KIND[carrying.kind], p = inRect(B.pen(), 1.5)();
    Object.assign(carrying, { state: "graze", timer: 2, x: p.x, z: p.z, cy: 0, lie: false });
    carrying.mom.followP = false; carrying.mom.baby = null;
    NEWBORNS.splice(NEWBORNS.indexOf(carrying), 1);
    toast(\`\${B.young} хашаанд орлоо. Төл: \${tolCount()} хурга ишиг, \${calfCount()} тугал\`); toastT = 4;
    carrying = null;
  }
}
function updateBirths() {
  tolNear = null;
  if (!carrying) for (const b of NEWBORNS) if (b.state === "newborn" && Math.hypot(b.x - P.x, b.z - P.z) < 4.5) { tolNear = b; break; }
  tolAtPen = false;
  if (carrying) {
    const pen = BIRTH_KIND[carrying.kind].pen();
    tolAtPen = Math.abs(P.x - pen.x) < pen.w / 2 + 8 && Math.abs(P.z - pen.z) < pen.d / 2 + 8;
    const fx = Math.cos(P.heading), fz = -Math.sin(P.heading);
    carrying.x = P.x + fx * .5; carrying.z = P.z + fz * .5; carrying.yaw = P.heading + Math.PI / 2;
    carrying.cy = player.position.y + (VEH === "moto" ? .9 : 1.2); carrying.neck = -.4;
  }
  const btn = $("tolBtn"), show = !!(tolNear || (carrying && tolAtPen));
  if (btn.hidden === show) btn.hidden = !show;
  const label = tolNear ? \`🍼 \${BIRTH_KIND[tolNear.kind].young} авах\` : "Хашаанд хийх";
  if (show && btn.textContent !== label) btn.textContent = label;
}
$("tolBtn").onclick = () => tolAction();
addEventListener("keydown", (e) => { if (e.code === "KeyE" && !e.repeat) tolAction(); });

// ---------- Өдөр шөнийн мөчлөг ----------`);
rep("  nightT: 0, warnT: 0, farWarned: false };", "  nightT: 0, warnT: 0, farWarned: false, births: [] };");
rep('  if (p === "morning") { DAY.out = true; FLOCK_DRIVEN = false;', '  if (p === "morning") { scheduleBirths(8, 16); DAY.out = true; FLOCK_DRIVEN = false;');
rep("    const h = hourNow();\n    for (const g of Object.values(GROUPS)) if (g.state === \"outing\")",
    "    const h = hourNow();\n    if (DAY.phase !== \"night\") while (DAY.births.length && h >= DAY.births[0].h) giveBirth(DAY.births.shift().k);\n    for (const g of Object.values(GROUPS)) if (g.state === \"outing\")");
rep("    $(\"homeInfo\").textContent =", "    $(\"tolInfo\").textContent = ` · Төл ${tolCount()} + ${calfCount()} тугал`;\n    $(\"homeInfo\").textContent =");
rep("updateDay(dt); updateSheep(dt, t);", "updateDay(dt); updateBirths(); updateSheep(dt, t);");
rep("poseHerd(sheep, t); poseHerd(goats, t);", "poseHerd(sheep, t); poseHerd(goats, t); poseHerd(lambs, t); poseHerd(kids, t);");
// эхний өдөр (16:00) удахгүй төллөнө
rep("goBtn\").onclick = () => {", "goBtn\").onclick = () => { if (!DAY.births.length) scheduleBirths(hourNow() + .15, Math.min(16.9, hourNow() + .9));");

// ---- 6. Жижиг газрын зурагт нярай ----
rep("  const [px, pz] = toMap(P.x, P.z);", `  for (const b of NEWBORNS) {
    const [bx, bz] = toMap(b.x, b.z), r = 4 + Math.sin(performance.now() / 200) * 1.5;
    mctx.strokeStyle = "#ff4fa0"; mctx.lineWidth = 2; mctx.beginPath(); mctx.arc(bx, bz, r, 0, 7); mctx.stroke();
  }
  const [px, pz] = toMap(P.x, P.z);`);

// ---- 7. HTML ----
rep('<button class="act" id="whistleBtn">Исгэрэх</button>', '<button class="act" id="whistleBtn">Исгэрэх</button>');
rep('<div class="actions">', '<div class="actions">\n  <button class="act sleep" id="tolBtn" hidden>🍼 Төл авах</button>');
rep('<b id="penned">0</b>/<span id="total">0</span><span id="homeInfo"></span>', '<b id="penned">0</b>/<span id="total">0</span><span id="tolInfo"></span><span id="homeInfo"></span>');
rep("<kbd>M</kbd> — морь/мотоцикл<br>", "<kbd>M</kbd> — морь/мотоцикл · <kbd>E</kbd> — төл авах<br>");
s = s.replace(/<p>Та өвөлжөөний малчин\..*?<\/p>/s, "<p>Хавар боллоо. Хонь, ямаа, үхэр төллөж байна. Өдөр бүр нэг хонь, нэг ямаа, нэг үнээ төллөнө: очиж төлийг нь авчраад хашаандаа хий. Орой бүх малаа гэртээ туугаад ир.</p>");
rep("<li>Хурга, ишиг, унага эхээсээ салахгүй дагаж явна.</li>", "<li>🍼 Мал төллөхөд мэдэгдэл гарч, газрын зураг дээр ягаан цагираг анивчина. Очоод <b>Төл авах</b> (E) дарж эмээлийн бүүрэгтээ авна. Эх нь дагаж ирнэ. Хашааны дэргэд <b>Хашаанд хийх</b> дарна.</li>\n      <li>Хурга, ишиг, тугал хашаандаа байна. Унага эхээ дагаж явна.</li>");
s = s.replace(/Өвөлжөө: 2 гэр, 2 банхар нохой;.*?<\/p>/s, "Хавар. Өвөлжөө: 2 гэр, 2 банхар нохой; 300 хонь, 200 ямаа, хашаанд 97 хурга ишиг; 49 үхэр, 5 тугал; тусдаа бэлчих 10 морь; 1 хээр азарга, 17 гүү, 7 унагатай азаргын сүрэг.</p>");
fs.writeFileSync(f, s);
new Function(s.split("<script>\n(() => {")[1].split("</script>")[0].replace(/^/, "(() => {"));
console.log("spring patched");

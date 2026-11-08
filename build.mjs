// src/page.html (Claude artifact хувилбар) → public/index.html (бие даасан вэб хуудас, PWA)
import fs from "node:fs";
const page = fs.readFileSync("src/page.html", "utf8").replace('<meta name="claude:viewport-fit-sides" content="cover">\n', "");
const cut = page.indexOf("</style>\n") + "</style>\n".length;
const head = page.slice(0, cut), body = page.slice(cut);
const html = `<!doctype html>
<html lang="mn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover">
<meta name="description" content="Монгол өвөлжөөний бодит газар дээр морь, мотоцикл унаж мал хариулах 3D тоглоом.">
<meta name="theme-color" content="#10150f">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="Мал хариулах">
<link rel="manifest" href="manifest.webmanifest">
<link rel="icon" type="image/png" href="icon-192.png">
<link rel="apple-touch-icon" href="icon-180.png">
<style>html,body{margin:0;height:100%;overscroll-behavior:none;-webkit-tap-highlight-color:transparent}body{font:14px system-ui,sans-serif}[hidden]{display:none!important}</style>
${head}</head>
<body>
${body}<script>if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));</script>
</body>
</html>
`;
fs.writeFileSync("public/index.html", html);
console.log("public/index.html", (html.length / 1024).toFixed(0) + " KB");

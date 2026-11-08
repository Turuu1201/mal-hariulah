// Энгийн дотоод сервер: node server.mjs  →  http://localhost:5190 (нэг Wi-Fi-д байгаа утаснаас LAN хаягаар)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
const ROOT = path.resolve("public"), PORT = Number(process.env.PORT) || 5190;
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".webmanifest": "application/manifest+json", ".png": "image/png", ".json": "application/json", ".css": "text/css" };
http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (p.endsWith("/")) p += "index.html";
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end("Not found"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream", "Cache-Control": "no-cache" }).end(data);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`🐎 Мал хариулах: http://localhost:${PORT}`);
  for (const list of Object.values(os.networkInterfaces())) for (const n of list || [])
    if (n.family === "IPv4" && !n.internal) console.log(`📱 Утаснаас (нэг Wi-Fi): http://${n.address}:${PORT}`);
});

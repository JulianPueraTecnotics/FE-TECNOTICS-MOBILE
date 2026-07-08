/**
 * Servidor estático para turnstile-verify.html (puerto 8099).
 * Turnstile exige HTTPS o localhost; úsalo con `npm run turnstile:tunnel`.
 */
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const htmlPath = path.join(root, "public/turnstile-verify.html");
const port = Number(process.env.TURNSTILE_VERIFY_PORT || 8099);

const html = fs.readFileSync(htmlPath, "utf8");

const server = http.createServer((req, res) => {
  const pathname = (req.url ?? "/").split("?")[0];
  if (pathname === "/" || pathname === "/turnstile-verify.html" || pathname === "/turnstile-verify") {
    res.writeHead(200, {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(html);
    return;
  }
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.log(`[turnstile-verify] Puerto ${port} ya en uso — reutilizando servidor existente.`);
    process.exit(0);
    return;
  }
  console.error("[turnstile-verify] Error:", err.message);
  process.exit(1);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`[turnstile-verify] http://127.0.0.1:${port}/turnstile-verify.html`);
  console.log(`[turnstile-verify] Para HTTPS en el móvil: npm run turnstile:tunnel`);
});

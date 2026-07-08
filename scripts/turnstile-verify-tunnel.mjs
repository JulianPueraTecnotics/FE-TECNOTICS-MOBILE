/**
 * Arranca turnstile-verify-server + cloudflared (HTTPS trycloudflare.com).
 * Escribe EXPO_PUBLIC_TURNSTILE_VERIFY_ORIGIN en .env.local.turnstile
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const originFile = path.join(root, ".env.local.turnstile");
const port = process.env.TURNSTILE_VERIFY_PORT || "8099";

function writeOrigin(origin) {
  fs.writeFileSync(originFile, `EXPO_PUBLIC_TURNSTILE_VERIFY_ORIGIN=${origin}\n`, "utf8");
  console.log(`\n[turnstile:tunnel] Origen guardado: ${origin}`);
  const sync = spawn(process.execPath, [path.join(__dirname, "sync-expo-env.mjs")], {
    stdio: "inherit",
    cwd: root,
  });
  sync.on("exit", () => {
    console.log("[turnstile:tunnel] Recarga la app en Expo Go (sacude → Reload)\n");
  });
}

const server = spawn(process.execPath, [path.join(__dirname, "turnstile-verify-server.mjs")], {
  stdio: "inherit",
  env: process.env,
});

server.on("error", (err) => {
  console.warn("[turnstile:tunnel] Servidor:", err.message, "— continuando con cloudflared…");
});

server.on("exit", (code) => {
  if (code === 0) {
    console.log(`[turnstile:tunnel] Servidor en :${port} listo (nuevo o ya existente).`);
  } else if (code !== null) {
    console.warn(`[turnstile:tunnel] Servidor terminó (${code}). Si :${port} responde, cloudflared seguirá.`);
  }
});

const cf = spawn("npx", ["--yes", "cloudflared", "tunnel", "--url", `http://127.0.0.1:${port}`], {
  stdio: ["inherit", "pipe", "pipe"],
  shell: process.platform === "win32",
});

let originWritten = false;

function tryCaptureUrl(text) {
  const match = text.match(/https:\/\/[^\s|]+\.trycloudflare\.com/i);
  if (!match || originWritten) return;
  originWritten = true;
  const origin = match[0].replace(/\/$/, "");
  writeOrigin(origin);
  console.log(`[turnstile:tunnel] Captcha HTTPS: ${origin}/turnstile-verify.html`);
}

cf.stdout?.on("data", (chunk) => {
  const text = chunk.toString();
  process.stdout.write(text);
  tryCaptureUrl(text);
});

cf.stderr?.on("data", (chunk) => {
  const text = chunk.toString();
  process.stderr.write(text);
  tryCaptureUrl(text);
});

cf.on("error", (err) => {
  console.error("[turnstile:tunnel] cloudflared:", err.message);
});

function shutdown() {
  cf.kill("SIGTERM");
  server.kill("SIGTERM");
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

cf.on("exit", (code) => {
  console.log(`[turnstile:tunnel] cloudflared terminó (${code ?? "?"}).`);
  server.kill("SIGTERM");
});

setTimeout(() => {
  if (!originWritten) {
    console.log("\n[turnstile:tunnel] No se detectó URL. Prueba manualmente:");
    console.log(`  npx cloudflared tunnel --url http://127.0.0.1:${port}`);
    console.log("  Copia la URL .trycloudflare.com a EXPO_PUBLIC_TURNSTILE_VERIFY_ORIGIN en .env\n");
  }
}, 20000);

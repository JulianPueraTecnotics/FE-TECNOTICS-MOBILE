/**
 * Sincroniza VITE_* (.env del portal) → EXPO_PUBLIC_* (.env.local) para Metro.
 * Solo edita .env; .env.local se regenera automáticamente.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

dotenv.config({ path: path.join(root, ".env") });

const PAIRS = [
  ["EXPO_PUBLIC_API_BASE_URL", "VITE_APP_BACK_URL"],
  ["EXPO_PUBLIC_FE_URL", "VITE_APP_FE_URL"],
  ["EXPO_PUBLIC_EPAYCO_PUBLIC_KEY", "VITE_APP_EPAYCO_PUBLIC_KEY"],
  ["EXPO_PUBLIC_EPAYCO_CUSTOMER_ID", "VITE_APP_EPAYCO_CUSTOMER_ID"],
  ["EXPO_PUBLIC_TURNSTILE_SITE_KEY", "VITE_TURNSTILE_SITE_KEY"],
];

const out = {};
for (const [expoKey, viteKey] of PAIRS) {
  const value = (process.env[viteKey] || process.env[expoKey] || "").trim();
  if (value) {
    out[expoKey] = value;
    out[viteKey] = value;
  }
}

const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`);
const localPath = path.join(root, ".env.local");

if (lines.length === 0) {
  console.log("[sync-expo-env] Sin variables en .env para sincronizar");
} else {
  fs.writeFileSync(localPath, `${lines.join("\n")}\n`, "utf8");
  console.log("[sync-expo-env] Escrito .env.local desde .env");
}

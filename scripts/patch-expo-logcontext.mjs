/**
 * Parche @expo/metro-runtime LogContext — evita crash cuando _expo-static-error no trae logs[].
 * Idempotente: se ejecuta en prestart.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const target = path.join(
  __dirname,
  "..",
  "node_modules",
  "@expo",
  "metro-runtime",
  "src",
  "error-overlay",
  "Data",
  "LogContext.tsx",
);

if (!fs.existsSync(target)) {
  console.warn("[patch-expo-logcontext] LogContext.tsx no encontrado — omitiendo");
  process.exit(0);
}

const src = fs.readFileSync(target, "utf8");
const broken = "logs: raw.logs.map((raw: any) => new LogBoxLog(raw)),";
const fixed = "logs: (raw.logs ?? []).map((raw: any) => new LogBoxLog(raw)),";

if (src.includes(fixed)) {
  console.log("[patch-expo-logcontext] Ya parcheado");
  process.exit(0);
}

if (!src.includes(broken)) {
  console.warn("[patch-expo-logcontext] Patrón no reconocido — revisar versión de @expo/metro-runtime");
  process.exit(0);
}

fs.writeFileSync(target, src.replace(broken, fixed), "utf8");
console.log("[patch-expo-logcontext] LogContext.tsx parcheado");

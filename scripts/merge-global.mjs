import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const portalPath = path.resolve(root, "../FE_TECNOTICS_PORTAL/src/utils/global.ts");
const outPath = path.resolve(root, "web/src/utils/global.ts");

const portal = fs.readFileSync(portalPath, "utf8");
const match = portal.match(/export const API_ROUTES = \{[\s\S]*?\n\};/);
if (!match) {
  throw new Error("API_ROUTES block not found in portal global.ts");
}

const header = `import Constants from "expo-constants";

interface ExpoExtra {
  apiBaseUrl?: string;
  feUrl?: string;
  epaycoPublicKey?: string;
  epaycoCustomerId?: string;
}

function readExtra(): ExpoExtra {
  return (Constants.expoConfig?.extra ?? {}) as ExpoExtra;
}

function strip(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\\/$/, "") : "";
}

/** Paridad portal: VITE_* en .env → extra vía app.config.js */
const extra = readExtra();

export const ENV = {
  API_URL: strip(extra.apiBaseUrl),
  FE_URL: strip(extra.feUrl),
  EPAYCO_PUBLIC_KEY: strip(extra.epaycoPublicKey),
  EPAYCO_CUSTOMER_ID: strip(extra.epaycoCustomerId),
};

`;

fs.writeFileSync(outPath, header + match[0] + "\n");
console.log("Wrote", outPath);

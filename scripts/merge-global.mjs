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

function env(key: string, extraKey: keyof ExpoExtra): string {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim().replace(/\\/$/, "");
  }
  const fromExtra = readExtra()[extraKey];
  if (typeof fromExtra === "string" && fromExtra.trim()) {
    return fromExtra.trim().replace(/\\/$/, "");
  }
  return "";
}

/** URLs del back — leídas por Expo (EXPO_PUBLIC_* + app.config.js extra). */
export const ENV = {
  API_URL: env("EXPO_PUBLIC_API_BASE_URL", "apiBaseUrl") || "https://facturacionelectronicatt.tecnotics.co",
  FE_URL: env("EXPO_PUBLIC_FE_URL", "feUrl") || "https://facturacionelectronicatt.tecnotics.co",
  EPAYCO_PUBLIC_KEY: env("EXPO_PUBLIC_EPAYCO_PUBLIC_KEY", "epaycoPublicKey"),
  EPAYCO_CUSTOMER_ID: env("EXPO_PUBLIC_EPAYCO_CUSTOMER_ID", "epaycoCustomerId"),
};

`;

fs.writeFileSync(outPath, header + match[0] + "\n");
console.log("Wrote", outPath);

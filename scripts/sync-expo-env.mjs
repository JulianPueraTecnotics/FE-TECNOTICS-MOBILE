/**

 * Sincroniza variables entre .env y .env.local para Metro/Expo.

 * Metro solo embebe EXPO_PUBLIC_*; Vite usa VITE_*.

 */

import dotenv from "dotenv";

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");



// .env.local primero; .env gana (fuente de verdad para desarrollo local).
dotenv.config({ path: path.join(root, ".env.local") });

dotenv.config({ path: path.join(root, ".env"), override: true });



const PAIRS = [

  ["EXPO_PUBLIC_API_BASE_URL", "VITE_APP_BACK_URL"],

  ["EXPO_PUBLIC_FE_URL", "VITE_APP_FE_URL"],

  ["EXPO_PUBLIC_EPAYCO_PUBLIC_KEY", "VITE_APP_EPAYCO_PUBLIC_KEY"],

  ["EXPO_PUBLIC_EPAYCO_CUSTOMER_ID", "VITE_APP_EPAYCO_CUSTOMER_ID"],

  ["EXPO_PUBLIC_TURNSTILE_SITE_KEY", "VITE_TURNSTILE_SITE_KEY"],

];



const out = {};

for (const [expoKey, viteKey] of PAIRS) {

  const value = (process.env[expoKey] || process.env[viteKey] || "").trim();

  if (value) {

    out[expoKey] = value;

    out[viteKey] = value;

  }

}



const lines = Object.entries(out).map(([k, v]) => `${k}=${v}`);

const localPath = path.join(root, ".env.local");



if (lines.length === 0) {

  console.log("[sync-expo-env] Sin variables para sincronizar");

} else {

  fs.writeFileSync(localPath, `${lines.join("\n")}\n`, "utf8");

  console.log("[sync-expo-env] Escrito .env.local:", Object.keys(out).join(", "));

}



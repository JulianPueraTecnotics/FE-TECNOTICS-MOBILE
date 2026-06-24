/**
 * Sincroniza EXPO_PUBLIC_* del .env (app.config.js las lee igual que EnkodeKids).
 * Metro/Expo embebe EXPO_PUBLIC_* en el bundle automáticamente.
 */
import dotenv from "dotenv";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
dotenv.config({ path: path.join(root, ".env") });

const keys = [
  "EXPO_PUBLIC_API_BASE_URL",
  "EXPO_PUBLIC_FE_URL",
  "EXPO_PUBLIC_EPAYCO_PUBLIC_KEY",
  "EXPO_PUBLIC_EPAYCO_CUSTOMER_ID",
];

const found = keys.filter((k) => process.env[k]);
console.log("[sync-expo-env] Variables Expo:", found.join(", ") || "(ninguna en .env)");

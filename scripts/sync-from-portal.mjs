/**
 * Copia src/ del portal master → web/src del mobile.
 * Preserva archivos exclusivos de Expo/native.
 *
 * Uso: node scripts/sync-from-portal.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const portalSrc = path.join(root, "..", "FE_TECNOTICS_PORTAL", "src");
const mobileSrc = path.join(root, "web", "src");

const SKIP_REL = new Set([
  "utils/global.ts",
  "router/index.route.tsx",
  "router/platformPages.ts",
  "router/lazyPlatformPage.ts",
  "PortalApp.tsx",
  "main.tsx",
  "mobile-overrides.css",
  "mobile-shell.css",
  "features/dashboard/page/Dashboard.tsx",
  "features/dashboard/page/Dashboard.native.tsx",
  "features/dashboard/page/Dashboard.web.tsx",
  "features/dashboard/page/Facturar.web.tsx",
  "features/dashboard/page/Facturar.native.tsx",
  "features/tec/components/TecAssistant.tsx",
  "features/tec/components/TecAssistant.native.tsx",
  "features/tec/components/TecChat.native.tsx",
  "features/tec/components/TecMessage.native.tsx",
  "features/register/page/ContinueMandato.tsx",
  "features/register/page/ContinueMandato.native.tsx",
  "features/register/page/ContinueMandato.web.tsx",
  "features/profile/page/Profile.tsx",
  "features/accounting/page/Configuration.tsx",
  "features/coming-soon/page/ComingSoon.tsx",
  "features/coming-soon/page/ComingSoon.native.tsx",
  "features/coming-soon/page/ComingSoon.web.tsx",
  "components/ui/PagoButton.tsx",
  "components/ui/PagoButton.web.tsx",
  "components/ui/PagoButton.native.tsx",
  "components/ui/pagoCheckout.shared.ts",
  "features/login/page/Turnstile.tsx",
  "shims/fixExpoStaticError.ts",
  "shims/expo/LogContext.tsx",
]);

const SKIP_DIR_PREFIX = [
  "components/mobile/",
  "components/design-system-native/",
  "components/native/",
  "features/billing/",
  "shims/",
];

function shouldSkip(relPosix) {
  if (SKIP_REL.has(relPosix)) return true;
  if (relPosix.includes(".native.")) return true;
  if (SKIP_DIR_PREFIX.some((p) => relPosix.startsWith(p))) return true;
  return false;
}

function walk(dir, base = "") {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  let copied = 0;
  let skipped = 0;
  for (const ent of entries) {
    const rel = base ? `${base}/${ent.name}` : ent.name;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      const r = walk(full, rel);
      copied += r.copied;
      skipped += r.skipped;
      continue;
    }
    if (!/\.(ts|tsx|css|json|png|jpg|jpeg|svg|webp|gif)$/.test(ent.name)) continue;
    const relPosix = rel.replace(/\\/g, "/");
    if (shouldSkip(relPosix)) {
      skipped++;
      continue;
    }
    const dest = path.join(mobileSrc, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(full, dest);
    copied++;
  }
  return { copied, skipped };
}

if (!fs.existsSync(portalSrc)) {
  console.error("[sync-from-portal] No existe:", portalSrc);
  process.exit(1);
}

const { copied, skipped } = walk(portalSrc);
console.log(`[sync-from-portal] Copiados: ${copied} · Omitidos: ${skipped}`);

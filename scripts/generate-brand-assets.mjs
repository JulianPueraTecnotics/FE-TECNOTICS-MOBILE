/**

 * Genera splash.png, adaptive-icon.png y favicon desde assets/icon.png.

 * Uso: node scripts/generate-brand-assets.mjs

 */

import fs from "node:fs";

import path from "node:path";

import { fileURLToPath } from "node:url";

import sharp from "sharp";



const __dirname = path.dirname(fileURLToPath(import.meta.url));

const root = path.join(__dirname, "..");

const source = path.join(root, "assets", "icon.png");

const outDir = path.join(root, "assets");

const BRAND_BG = { r: 0, g: 39, b: 55, alpha: 1 };



async function composeSquare(size, logoScale, outPath) {

  const maxSide = Math.round(size * logoScale);

  const resized = await sharp(source)

    .resize(maxSide, maxSide, { fit: "inside", withoutEnlargement: false, background: BRAND_BG })

    .png()

    .toBuffer();



  const rMeta = await sharp(resized).metadata();

  const left = Math.max(0, Math.round((size - (rMeta.width ?? 0)) / 2));

  const top = Math.max(0, Math.round((size - (rMeta.height ?? 0)) / 2));



  await sharp({

    create: { width: size, height: size, channels: 4, background: BRAND_BG },

  })

    .composite([{ input: resized, left, top }])

    .png()

    .toFile(outPath);

}



async function main() {

  if (!fs.existsSync(source)) {

    console.error("[generate-brand-assets] No existe:", source);

    process.exit(1);

  }



  fs.mkdirSync(outDir, { recursive: true });



  const iconPath = path.join(outDir, "icon.png");

  const adaptivePath = path.join(outDir, "adaptive-icon.png");

  const splashPath = path.join(outDir, "splash.png");



  const meta = await sharp(source).metadata();
  if ((meta.width ?? 0) < 1024) {
    await composeSquare(1024, 1, iconPath);
  } else {
    console.log("[generate-brand-assets] icon.png OK (sin cambios)");
  }



  await composeSquare(1024, 0.72, adaptivePath);



  const splashW = 1284;

  const splashH = 2778;

  const splashLogoMax = Math.round(Math.min(splashW, splashH) * 0.38);

  const splashLogo = await sharp(source)

    .resize(splashLogoMax, splashLogoMax, { fit: "inside", withoutEnlargement: false, background: BRAND_BG })

    .png()

    .toBuffer();

  const sMeta = await sharp(splashLogo).metadata();

  const sLeft = Math.max(0, Math.round((splashW - (sMeta.width ?? 0)) / 2));

  const sTop = Math.max(0, Math.round((splashH - (sMeta.height ?? 0)) / 2));



  await sharp({

    create: { width: splashW, height: splashH, channels: 4, background: BRAND_BG },

  })

    .composite([{ input: splashLogo, left: sLeft, top: sTop }])

    .png()

    .toFile(splashPath);



  await sharp(source)

    .resize(192, 192, { fit: "contain", background: BRAND_BG })

    .png()

    .toFile(path.join(root, "web", "public", "favicon.png"));



  console.log("[generate-brand-assets] Generados desde assets/icon.png:");

  console.log(" -", iconPath);

  console.log(" -", adaptivePath);

  console.log(" -", splashPath);

  console.log(" -", path.join(root, "web", "public", "favicon.png"));

}



main().catch((err) => {

  console.error(err);

  process.exit(1);

});



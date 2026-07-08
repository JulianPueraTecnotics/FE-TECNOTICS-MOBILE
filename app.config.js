/* eslint-disable @typescript-eslint/no-require-imports */
const path = require("path");

/** Mismo .env que FE_TECNOTICS_PORTAL (solo VITE_*). */
require("dotenv").config({ path: path.join(__dirname, ".env") });

/**
 * Variables de entorno al estilo portal: VITE_* en .env → extra de Expo.
 * sync-expo-env.mjs genera .env.local (EXPO_PUBLIC_*) automáticamente en prestart.
 *
 * @param {{ config: import('expo/config').ExpoConfig }} ctx
 */
/** Proyecto EAS compartido con Facturacion_mobile (reemplaza la app publicada). */
const EAS_PROJECT_ID = "51f6f6e2-0869-4190-bd66-a661850d4512";

module.exports = ({ config }) => {
  const strip = (s) => String(s ?? "").trim().replace(/\/$/, "");

  const apiRaw = process.env.VITE_APP_BACK_URL || "";
  const feRaw = process.env.VITE_APP_FE_URL || apiRaw;

  const projectId = config.extra?.eas?.projectId ?? EAS_PROJECT_ID;

  return {
    ...config,
    ios: {
      ...config.ios,
      bundleIdentifier:
        config.ios?.bundleIdentifier ?? "com.tecnotics.facturacion.mobile",
    },
    android: {
      ...config.android,
      package: config.android?.package ?? "com.tecnotics.facturacion.mobile",
      softwareKeyboardLayoutMode: "resize",
    },
    runtimeVersion: config.runtimeVersion ?? { policy: "appVersion" },
    updates: {
      ...config.updates,
      url: config.updates?.url ?? `https://u.expo.dev/${projectId}`,
    },
    extra: {
      ...config.extra,
      eas: {
        ...(config.extra?.eas || {}),
        projectId,
      },
      apiBaseUrl: strip(apiRaw),
      feUrl: strip(feRaw),
      epaycoPublicKey: strip(process.env.VITE_APP_EPAYCO_PUBLIC_KEY),
      epaycoCustomerId: strip(process.env.VITE_APP_EPAYCO_CUSTOMER_ID),
    },
  };
};

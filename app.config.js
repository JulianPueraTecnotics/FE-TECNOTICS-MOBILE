/* eslint-disable @typescript-eslint/no-require-imports */
require("dotenv").config();

/**
 * Variables de entorno al estilo EnkodeKids (dotenv + extra).
 * Metro embebe EXPO_PUBLIC_* en el bundle automáticamente.
 *
 * @param {{ config: import('expo/config').ExpoConfig }} ctx
 */
module.exports = ({ config }) => {
  const strip = (s) => String(s ?? "").trim().replace(/\/$/, "");

  const apiRaw =
    process.env.EXPO_PUBLIC_API_BASE_URL ||
    process.env.VITE_APP_BACK_URL ||
    config.extra?.apiBaseUrl ||
    "https://facturacionelectronicatt.tecnotics.co";

  const feRaw =
    process.env.EXPO_PUBLIC_FE_URL ||
    process.env.VITE_APP_FE_URL ||
    config.extra?.feUrl ||
    apiRaw;

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
    extra: {
      ...config.extra,
      apiBaseUrl: strip(apiRaw),
      feUrl: strip(feRaw),
      epaycoPublicKey:
        process.env.EXPO_PUBLIC_EPAYCO_PUBLIC_KEY ||
        process.env.VITE_APP_EPAYCO_PUBLIC_KEY ||
        "",
      epaycoCustomerId:
        process.env.EXPO_PUBLIC_EPAYCO_CUSTOMER_ID ||
        process.env.VITE_APP_EPAYCO_CUSTOMER_ID ||
        "",
    },
  };
};

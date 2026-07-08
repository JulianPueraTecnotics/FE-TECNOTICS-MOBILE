import Constants from "expo-constants";
import { makeRedirectUri } from "expo-auth-session";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { ENV } from "../../../utils/global";

/** Clave pública Turnstile — misma regla que el portal (test key si no hay env). */
export const TURNSTILE_SITE_KEY =
  (typeof process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY === "string"
    ? process.env.EXPO_PUBLIC_TURNSTILE_SITE_KEY.trim()
    : "") || "1x00000000000000000000AA";

/** Deep link de retorno compatible con Expo Go y builds nativos. */
export function resolveTurnstileRedirectUrl(): string {
  if (Constants.appOwnership === "expo") {
    return Linking.createURL("turnstile-callback");
  }
  return makeRedirectUri({
    scheme: "tecnoticsmobile",
    path: "turnstile-callback",
  });
}

/** Origen HTTPS del servidor turnstile-verify (cloudflared). */
export function getTurnstileVerifyOrigin(): string | null {
  const extra = Constants.expoConfig?.extra as { turnstileVerifyOrigin?: string } | undefined;
  const fromExtra = extra?.turnstileVerifyOrigin?.trim();
  if (fromExtra) return fromExtra.replace(/\/$/, "");

  const fromEnv = process.env.EXPO_PUBLIC_TURNSTILE_VERIFY_ORIGIN?.trim();
  return fromEnv ? fromEnv.replace(/\/$/, "") : null;
}

function parseHostPort(raw: string): { host: string; port: string } | null {
  const hostPort = raw.replace(/^exp:\/\//, "").split("/")[0].trim();
  if (!hostPort) return null;
  const [host, port = "8081"] = hostPort.split(":");
  if (!host) return null;
  return { host, port };
}

function parseDebuggerHost(): { host: string; port: string } | null {
  const candidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoGo?.debuggerHost as string | undefined,
    Constants.manifest2?.extra?.expoClient?.hostUri as string | undefined,
  ];
  for (const value of candidates) {
    if (typeof value === "string" && value.trim()) {
      const parsed = parseHostPort(value);
      if (parsed) return parsed;
    }
  }
  return null;
}

function isPrivateLanHost(host: string): boolean {
  return (
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
}

function isTunnelHost(host: string): boolean {
  return (
    host.includes("exp.direct") ||
    host.includes("ngrok") ||
    host.includes("tunnel") ||
    host.endsWith(".exp.dev") ||
    host.includes("u.expo.dev") ||
    host.endsWith(".loca.lt") ||
    host.includes("trycloudflare.com")
  );
}

function originFromLinkingUrl(): string | null {
  try {
    const sample = Linking.createURL("turnstile-verify");
    const parsed = Linking.parse(sample);
    const host = parsed.hostname;
    if (!host) return null;

    if (isTunnelHost(host)) {
      const port = parsed.port && parsed.port !== "443" ? `:${parsed.port}` : "";
      return `https://${host}${port}`;
    }

    if (isPrivateLanHost(host)) return null;
    if (host === "localhost" || host === "127.0.0.1") {
      const port = parsed.port ?? "8099";
      return `http://${host}:${port}`;
    }
  } catch {
    /* noop */
  }
  return null;
}

/**
 * Origen HTTP(S) para turnstile-verify.html.
 * Prioridad: env explícito → túnel Expo → FE HTTPS → localhost (adb reverse).
 */
function resolveVerifyOrigin(): string | null {
  const envOrigin = getTurnstileVerifyOrigin();
  if (envOrigin) return envOrigin;

  if (Platform.OS === "web" && typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }

  const parsed = parseDebuggerHost();
  if (parsed?.host && isTunnelHost(parsed.host)) {
    const portSuffix =
      parsed.port && parsed.port !== "443" && parsed.port !== "80" ? `:${parsed.port}` : "";
    return `https://${parsed.host}${portSuffix}`;
  }

  const fromLinking = originFromLinkingUrl();
  if (fromLinking) return fromLinking;

  const fe = ENV.FE_URL?.trim().replace(/\/$/, "");
  if (fe && /^https:\/\//i.test(fe)) {
    return fe;
  }

  if (Platform.OS === "android" || Platform.OS === "ios") {
    const port = process.env.EXPO_PUBLIC_TURNSTILE_VERIFY_PORT?.trim() || "8099";
    return `http://127.0.0.1:${port}`;
  }

  if (parsed && !isPrivateLanHost(parsed.host)) {
    return `http://${parsed.host}:${parsed.port}`;
  }

  return null;
}

function buildVerifyQuery(): string {
  const sitekey = encodeURIComponent(TURNSTILE_SITE_KEY);
  const redirect = encodeURIComponent(resolveTurnstileRedirectUrl());
  return `sitekey=${sitekey}&redirect=${redirect}`;
}

/** URL de verificación Turnstile (HTML estático HTTPS). */
export function resolveTurnstileVerifyPageUrl(): string | null {
  const origin = resolveVerifyOrigin();
  if (!origin) return null;
  return `${origin}/turnstile-verify.html?${buildVerifyQuery()}`;
}

export type TurnstileVerifyMode = "https" | "localhost" | "lan" | "unknown";

export function getTurnstileVerifyMode(): TurnstileVerifyMode {
  const origin = resolveVerifyOrigin();
  if (!origin) return "unknown";
  if (origin.startsWith("https://")) return "https";
  if (origin.includes("127.0.0.1") || origin.includes("localhost")) return "localhost";
  if (/^http:\/\/192\.168\.|^http:\/\/10\./.test(origin)) return "lan";
  return "unknown";
}

export function needsAdbReverseForTurnstile(): boolean {
  if (Platform.OS === "web") return false;
  return getTurnstileVerifyMode() === "localhost" && !getTurnstileVerifyOrigin();
}

export function getTurnstileVerifyHelpMessage(): string | null {
  if (getTurnstileVerifyOrigin()) return null;

  const mode = getTurnstileVerifyMode();
  if (mode === "localhost") {
    return "En otra terminal: npm run turnstile:tunnel → recarga la app → reintenta.";
  }
  if (mode === "lan") {
    return "Turnstile no funciona con IP LAN. Ejecuta: npm run turnstile:tunnel";
  }
  if (mode === "https" && ENV.FE_URL?.includes("tecnotics.co")) {
    return "Si el captcha no carga, ejecuta npm run turnstile:tunnel en otra terminal.";
  }
  return "Ejecuta npm run turnstile:tunnel en otra terminal y recarga la app.";
}

export function parseTurnstileCallbackToken(url: string): string | null {
  const match = url.match(/[?&]token=([^&#]+)/);
  if (match?.[1]) {
    try {
      return decodeURIComponent(match[1]).trim() || null;
    } catch {
      return match[1].trim() || null;
    }
  }

  try {
    const parsed = Linking.parse(url);
    if (!parsed.path?.includes("turnstile-callback") && !url.includes("turnstile-callback")) {
      return null;
    }
    const raw = parsed.queryParams?.token;
    const token = Array.isArray(raw) ? raw[0] : raw;
    return typeof token === "string" && token.trim() ? token.trim() : null;
  } catch {
    return null;
  }
}

import Constants from "expo-constants";
import { Platform } from "react-native";
import { TURNSTILE_SITE_KEY } from "./turnstileSiteKey";

export type TurnstileWebViewSource =
  | { kind: "uri"; uri: string; label: string }
  | { kind: "inline"; html: string; baseUrl: string; label: string };

const CHROME_MOBILE_UA =
  "Mozilla/5.0 (Linux; Android 13; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";

export { CHROME_MOBILE_UA };

function parseHostPort(raw: string | undefined): { host: string; port: string } | null {
  if (!raw?.trim()) return null;
  const hostPort = raw.replace(/^exp:\/\//, "").split("/")[0].trim();
  if (!hostPort) return null;
  const [host, port = "8081"] = hostPort.split(":");
  if (!host) return null;
  return { host, port };
}

function readDebuggerHost(): { host: string; port: string } | null {
  const candidates = [
    Constants.expoGoConfig?.debuggerHost,
    Constants.expoConfig?.hostUri,
    Constants.manifest2?.extra?.expoGo?.debuggerHost as string | undefined,
    Constants.manifest2?.extra?.expoClient?.hostUri as string | undefined,
  ];
  for (const value of candidates) {
    const parsed = parseHostPort(typeof value === "string" ? value : undefined);
    if (parsed) return parsed;
  }
  return null;
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

function isPrivateLanHost(host: string): boolean {
  return (
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
  );
}

/** Origen HTTPS del túnel Expo (no requiere adb reverse). */
export function resolveExpoTunnelOrigin(): string | null {
  if (Platform.OS === "web") return null;
  const dbg = readDebuggerHost();
  if (!dbg?.host || !isTunnelHost(dbg.host)) return null;
  const portSuffix =
    dbg.port && dbg.port !== "443" && dbg.port !== "80" ? `:${dbg.port}` : "";
  return `https://${dbg.host}${portSuffix}`;
}

/** Origen loopback hacia Metro (adb reverse 8081 en Android físico). */
export function resolveMetroLoopbackOrigin(): string | null {
  if (Platform.OS === "web") return null;
  const tunnel = resolveExpoTunnelOrigin();
  if (tunnel) return null;
  const dbg = readDebuggerHost();
  const port = dbg?.port ?? "8081";

  if (Platform.OS === "android" && Constants.isDevice === false) {
    return `http://10.0.2.2:${port}`;
  }
  if (Platform.OS === "android") {
    return `http://127.0.0.1:${port}`;
  }
  return `http://localhost:${port}`;
}

/** Origen LAN del dev server (API local; Turnstile no funciona aquí). */
export function resolveMetroLanOrigin(): string | null {
  if (Platform.OS === "web") return null;
  const dbg = readDebuggerHost();
  if (!dbg?.host || isTunnelHost(dbg.host) || isPrivateLanHost(dbg.host)) return null;
  return `http://${dbg.host}:${dbg.port ?? "8081"}`;
}

function buildVerifyQuery(): string {
  return new URLSearchParams({
    sitekey: TURNSTILE_SITE_KEY,
    embedded: "1",
  }).toString();
}

function buildUri(base: string, label: string): TurnstileWebViewSource {
  return {
    kind: "uri",
    uri: `${base.replace(/\/$/, "")}/turnstile-verify.html?${buildVerifyQuery()}`,
    label,
  };
}

/** Fuentes en orden de preferencia para la WebView del captcha. */
export function buildTurnstileWebViewSources(apiBase: string): TurnstileWebViewSource[] {
  const sources: TurnstileWebViewSource[] = [];
  const tunnel = resolveExpoTunnelOrigin();
  const metro = resolveMetroLoopbackOrigin();

  if (tunnel) {
    sources.push(buildUri(tunnel, `tunnel ${tunnel}`));
  }
  if (metro) {
    sources.push(buildUri(metro, metro));
  }
  if (apiBase && !apiBase.includes("192.168.") && !apiBase.includes("10.")) {
    sources.push(buildUri(apiBase, apiBase));
  }
  const inlineBase = tunnel ?? metro ?? (apiBase ? `${apiBase}/` : "https://localhost/");
  sources.push({
    kind: "inline",
    html: "",
    baseUrl: inlineBase.endsWith("/") ? inlineBase : `${inlineBase}/`,
    label: "inline",
  });
  return sources;
}

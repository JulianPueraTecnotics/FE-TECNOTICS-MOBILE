import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { ENV } from "../../../utils/global";
import {
  buildTurnstileHtml,
  TURNSTILE_SITE_KEY,
  TURNSTILE_WIDGET_HEIGHT,
} from "./turnstile.shared";
import { CHROME_MOBILE_UA } from "./turnstileWebViewSource";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

const FALLBACK_ORIGIN = "https://facturacion.tecnotics.co";

/**
 * Origen HTTPS registrado en Cloudflare Turnstile. Se usa como `baseUrl` de la
 * WebView para que el widget se cargue directamente (sin adb reverse, túnel ni
 * HTML servido por el backend). Prioridad: FE_URL → API_URL → dominio de prod.
 */
function resolveTurnstileBaseUrl(): string {
  const candidates = [ENV.FE_URL, ENV.API_URL];
  for (const raw of candidates) {
    const value = raw?.trim().replace(/\/$/, "");
    if (value && /^https:\/\//i.test(value)) return `${value}/`;
  }
  return `${FALLBACK_ORIGIN}/`;
}

/**
 * Turnstile nativo: HTML inline cargado sobre el dominio HTTPS de producción.
 * No depende de adb reverse, túnel ni de que el backend sirva el HTML.
 */
export default function TurnstileNative({ onVerify, onExpire }: TurnstileProps) {
  const baseUrl = useMemo(() => resolveTurnstileBaseUrl(), []);
  const html = useMemo(() => buildTurnstileHtml(TURNSTILE_SITE_KEY), []);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [key, setKey] = useState(0);
  const [failHint, setFailHint] = useState("");
  const [statusHint, setStatusHint] = useState("");

  useEffect(() => {
    console.log("[Turnstile] componente montado. baseUrl:", baseUrl, "siteKey:", TURNSTILE_SITE_KEY);
  }, [baseUrl]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase((p) => {
        if (p !== "loading") return p;
        setFailHint("Verifica tu conexión a internet e inténtalo de nuevo.");
        return "failed";
      });
    }, 30000);
    return () => clearTimeout(timer);
  }, [key]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          token?: string;
          detail?: string;
        };
        console.log("[Turnstile] mensaje del captcha:", data);
        if (data.type === "status" && data.detail) {
          setStatusHint(data.detail);
          return;
        }
        if (data.type === "ready") {
          setPhase("ready");
          setFailHint("");
          setStatusHint("");
          return;
        }
        if (data.type === "verify" && data.token) {
          setPhase("ready");
          console.log("[Turnstile] token recibido:", data.token);
          onVerify(data.token);
          return;
        }
        if (data.type === "expire") {
          onExpire?.();
          return;
        }
        if (data.type === "error") {
          setPhase("failed");
          setFailHint(data.detail || "No se pudo cargar la verificación de seguridad.");
          onExpire?.();
        }
      } catch {
        /* noop */
      }
    },
    [onExpire, onVerify]
  );

  const onLoadError = useCallback(() => {
    setPhase("failed");
    setFailHint("No se pudo cargar el captcha. Revisa tu conexión.");
  }, []);

  const retry = useCallback(() => {
    setPhase("loading");
    setFailHint("");
    setStatusHint("");
    setKey((k) => k + 1);
    onExpire?.();
  }, [onExpire]);

  return (
    <View style={styles.wrap} collapsable={false}>
      {phase === "loading" ? (
        <View style={styles.loading} pointerEvents="none">
          <ActivityIndicator size="small" color="#0077b6" />
          {statusHint ? <Text style={styles.statusHint}>{statusHint}</Text> : null}
        </View>
      ) : null}
      {phase === "failed" ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorText}>No se pudo cargar el captcha.</Text>
          {failHint ? <Text style={styles.errorHint}>{failHint}</Text> : null}
          <Pressable onPress={retry} hitSlop={8}>
            <Text style={styles.retry}>Reintentar</Text>
          </Pressable>
        </View>
      ) : null}
      {phase !== "failed" ? (
        <WebView
          key={`turnstile-${key}`}
          source={{ html, baseUrl }}
          style={styles.webview}
          onMessage={onMessage}
          onLoadStart={() => console.log("[Turnstile] WebView onLoadStart")}
          onLoadEnd={() => console.log("[Turnstile] WebView onLoadEnd")}
          onError={(e) => {
            console.log("[Turnstile] WebView onError:", e.nativeEvent);
            onLoadError();
          }}
          onHttpError={(e) => {
            console.log("[Turnstile] WebView onHttpError:", e.nativeEvent.statusCode, e.nativeEvent.url);
            if (e.nativeEvent.statusCode >= 400) onLoadError();
          }}
          originWhitelist={["*"]}
          javaScriptEnabled
          domStorageEnabled
          thirdPartyCookiesEnabled
          sharedCookiesEnabled
          mixedContentMode="always"
          scrollEnabled={false}
          setSupportMultipleWindows
          nestedScrollEnabled
          cacheEnabled={false}
          userAgent={Platform.OS === "android" ? CHROME_MOBILE_UA : undefined}
          onShouldStartLoadWithRequest={() => true}
          {...(Platform.OS === "android"
            ? {
                allowFileAccess: true,
                allowUniversalAccessFromFileURLs: true,
                setBuiltInZoomControls: false,
              }
            : {})}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    height: TURNSTILE_WIDGET_HEIGHT,
    backgroundColor: "#fff",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
  },
  webview: { flex: 1, backgroundColor: "#fff", opacity: 0.99 },
  loading: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.9)",
    zIndex: 1,
    gap: 6,
    paddingHorizontal: 8,
  },
  statusHint: { fontSize: 10, color: "#64748b", textAlign: "center" },
  errorRow: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#fff",
    padding: 8,
    gap: 2,
    zIndex: 2,
  },
  errorText: { fontSize: 12, color: "#b91c1c", textAlign: "center", fontWeight: "600" },
  errorHint: { fontSize: 10, color: "#64748b", textAlign: "center", paddingHorizontal: 4 },
  retry: { fontSize: 12, color: "#0077b6", fontWeight: "600", marginTop: 2 },
});

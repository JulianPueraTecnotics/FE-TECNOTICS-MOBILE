import { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { ENV } from "../../../utils/global";
import {
  buildTurnstileHtml,
  TURNSTILE_SITE_KEY,
  TURNSTILE_WIDGET_HEIGHT,
} from "./turnstile.shared";
import {
  buildTurnstileWebViewSources,
  CHROME_MOBILE_UA,
  type TurnstileWebViewSource,
} from "./turnstileWebViewSource";

interface TurnstileProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

function toWebViewSource(entry: TurnstileWebViewSource) {
  if (entry.kind === "uri") {
    return { uri: entry.uri };
  }
  return { html: buildTurnstileHtml(TURNSTILE_SITE_KEY), baseUrl: entry.baseUrl };
}

/**
 * Turnstile nativo: Metro (8081) → backend (3001) → HTML inline.
 */
export default function TurnstileNative({ onVerify, onExpire }: TurnstileProps) {
  const apiBase = useMemo(() => ENV.API_URL?.trim().replace(/\/$/, "") ?? "", []);
  const sources = useMemo(() => buildTurnstileWebViewSources(apiBase), [apiBase]);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [phase, setPhase] = useState<"loading" | "ready" | "failed">("loading");
  const [key, setKey] = useState(0);
  const [failHint, setFailHint] = useState("");
  const [statusHint, setStatusHint] = useState("");

  const current = sources[sourceIndex] ?? sources[0];
  const source = useMemo(() => {
    if (!current) {
      return { html: buildTurnstileHtml(TURNSTILE_SITE_KEY), baseUrl: "https://localhost/" };
    }
    return toWebViewSource(current);
  }, [current, key]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setPhase((p) => {
        if (p !== "loading") return p;
        setFailHint("Ejecuta: npm run adb-reverse (puertos 8081 y 3001) y recarga la app.");
        return "failed";
      });
    }, 38000);
    return () => clearTimeout(timer);
  }, [key, sourceIndex]);

  const tryNextSource = useCallback(() => {
    setSourceIndex((idx) => {
      const next = idx + 1;
      if (next < sources.length) {
        setPhase("loading");
        setFailHint("");
        setStatusHint("");
        setKey((k) => k + 1);
        return next;
      }
      setPhase("failed");
      setFailHint("Sin más modos de carga. Verifica internet y adb reverse.");
      return idx;
    });
  }, [sources.length]);

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const data = JSON.parse(event.nativeEvent.data) as {
          type?: string;
          token?: string;
          detail?: string;
        };
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
          onVerify(data.token);
          return;
        }
        if (data.type === "expire") {
          onExpire?.();
          return;
        }
        if (data.type === "error") {
          setFailHint(data.detail || "Error al cargar Turnstile.");
          if (sourceIndex < sources.length - 1) {
            tryNextSource();
            onExpire?.();
            return;
          }
          setPhase("failed");
          onExpire?.();
        }
      } catch {
        /* noop */
      }
    },
    [onExpire, onVerify, sourceIndex, sources.length, tryNextSource]
  );

  const onLoadError = useCallback(() => {
    if (sourceIndex < sources.length - 1) {
      tryNextSource();
      return;
    }
    setPhase("failed");
    setFailHint("No se pudo cargar ninguna fuente del captcha.");
  }, [sourceIndex, sources.length, tryNextSource]);

  const retry = useCallback(() => {
    setSourceIndex(0);
    setPhase("loading");
    setFailHint("");
    setStatusHint("");
    setKey((k) => k + 1);
    onExpire?.();
  }, [onExpire]);

  if (!current) {
    return (
      <View style={styles.wrap}>
        <Text style={styles.errorText}>No hay fuente Turnstile disponible</Text>
      </View>
    );
  }

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
          key={`${current.label}-${key}`}
          source={source}
          style={styles.webview}
          onMessage={onMessage}
          onError={onLoadError}
          onHttpError={(e) => {
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
      {Platform.OS !== "web" ? (
        <Text style={styles.debug} numberOfLines={2}>
          {current.label}
        </Text>
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
  debug: {
    position: "absolute",
    bottom: 2,
    left: 4,
    right: 4,
    fontSize: 8,
    color: "#94a3b8",
    textAlign: "center",
  },
});

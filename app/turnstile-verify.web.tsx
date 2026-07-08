import { useCallback } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useGlobalSearchParams } from "expo-router";
import Turnstile from "../web/src/features/login/page/Turnstile";

function readParam(value: string | string[] | undefined): string {
  const raw = Array.isArray(value) ? value[0] : value;
  if (!raw?.trim()) return "";
  try {
    return decodeURIComponent(raw.trim());
  } catch {
    return raw.trim();
  }
}

/** Captcha Turnstile en navegador (HTTPS / localhost). Nativo abre esta ruta en Chrome. */
export default function TurnstileVerifyWebScreen() {
  const params = useGlobalSearchParams<{ redirect?: string | string[] }>();
  const redirect = readParam(params.redirect);

  const onVerify = useCallback(
    (token: string) => {
      if (!redirect || typeof window === "undefined") return;
      const sep = redirect.includes("?") ? "&" : "?";
      const target = `${redirect}${sep}token=${encodeURIComponent(token)}`;
      window.location.replace(target);
      setTimeout(() => {
        window.location.href = target;
      }, 200);
    },
    [redirect]
  );

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Verificación de seguridad</Text>
      <View style={styles.widget}>
        <Turnstile onVerify={onVerify} />
      </View>
      <Text style={styles.hint}>Completa el captcha. Al terminar volverás automáticamente a la app.</Text>
      {!redirect ? (
        <Text style={styles.error}>Falta el parámetro redirect en la URL.</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  title: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
    marginBottom: 16,
    textAlign: "center",
  },
  widget: {
    minHeight: 72,
    width: "100%",
    maxWidth: 320,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    marginTop: 16,
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    maxWidth: 320,
    lineHeight: 20,
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    color: "#b91c1c",
    textAlign: "center",
  },
});

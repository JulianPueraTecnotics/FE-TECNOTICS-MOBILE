import Constants from "expo-constants";
import { Platform } from "react-native";

function strip(value: string | undefined): string {
  return typeof value === "string" ? value.trim().replace(/\/$/, "") : "";
}

/**
 * En dispositivo nativo, localhost apunta al teléfono/emulador, no al PC.
 * - Android emulador: 10.0.2.2
 * - Android físico + adb reverse: 127.0.0.1
 * - iOS simulador: localhost funciona hacia el Mac host
 */
export function resolveNativeApiBase(url: string | undefined): string {
  const base = strip(url);
  if (!base || Platform.OS === "web") return base;
  if (!/\blocalhost\b|127\.0\.0\.1/i.test(base)) return base;

  if (Platform.OS === "android" && Constants.isDevice === false) {
    return base.replace(/\blocalhost\b|127\.0\.0\.1/gi, "10.0.2.2");
  }

  if (Platform.OS === "android") {
    return base.replace(/\blocalhost\b/gi, "127.0.0.1");
  }

  return base;
}

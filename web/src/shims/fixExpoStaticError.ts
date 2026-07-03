/**
 * Expo LogBox (web): `_expo-static-error` a veces llega sin `logs[]` y revienta
 * `useLogs()` en @expo/metro-runtime (LogContext.tsx:27).
 */
if (typeof document !== "undefined") {
  const el = document.getElementById("_expo-static-error");
  if (el?.textContent) {
    try {
      const raw = JSON.parse(el.textContent) as { logs?: unknown };
      if (!Array.isArray(raw.logs)) {
        raw.logs = [];
        el.textContent = JSON.stringify(raw);
      }
    } catch {
      /* payload inválido — no bloquear el arranque */
    }
  }
}

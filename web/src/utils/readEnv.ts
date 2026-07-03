/** Lee variables VITE_* / EXPO_PUBLIC_* vía process.env (Metro/Expo y web). */
export function readEnv(key: string): string {
  const fromProcess = process.env[key];
  if (typeof fromProcess === "string" && fromProcess.trim()) {
    return fromProcess.trim();
  }
  return "";
}

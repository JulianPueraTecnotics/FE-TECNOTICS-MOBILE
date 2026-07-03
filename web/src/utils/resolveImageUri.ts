import resolveAssetSource from "expo-asset/build/resolveAssetSource";

type ImageImport =
  | string
  | number
  | { uri?: string; width?: number; height?: number }
  | { default?: unknown };

function normalizeSource(source: unknown): string | number | { uri: string } | null {
  if (source == null) return null;
  if (typeof source === "string") return source;
  if (typeof source === "number") return source;
  if (typeof source === "object") {
    const obj = source as Record<string, unknown>;
    if (typeof obj.uri === "string") return { uri: obj.uri };
    if ("default" in obj) return normalizeSource(obj.default);
  }
  return null;
}

/** Convierte un import de imagen Metro/Expo a URL usable en `<img src>` o CSS `url()`. */
export function resolveImageUri(source: ImageImport): string {
  const normalized = normalizeSource(source);
  if (normalized == null) return "";
  if (typeof normalized === "string") return normalized;
  if (typeof normalized === "object" && "uri" in normalized) return normalized.uri;
  if (typeof normalized === "number") {
    try {
      const resolved = resolveAssetSource(normalized);
      if (typeof resolved === "string") return resolved;
      if (resolved && typeof resolved === "object" && typeof resolved.uri === "string") {
        return resolved.uri;
      }
    } catch {
      return "";
    }
  }
  return "";
}

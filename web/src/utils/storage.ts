import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const memory = new Map<string, string>();
let hydrated = false;
let hydratePromise: Promise<void> | null = null;

export function hasWebStorage(): boolean {
  return Platform.OS === "web" && typeof localStorage !== "undefined";
}

/** Carga AsyncStorage en memoria (nativo) para lecturas sync seguras. */
export async function ensureStorageHydrated(): Promise<void> {
  if (hasWebStorage() || hydrated) return;
  if (!hydratePromise) {
    hydratePromise = (async () => {
      try {
        const keys = await AsyncStorage.getAllKeys();
        if (keys.length > 0) {
          const pairs = await AsyncStorage.multiGet(keys);
          for (const [key, value] of pairs) {
            if (key && value != null) memory.set(key, value);
          }
        }
      } catch {
        // Sin persistencia previa — continuar con defaults.
      } finally {
        hydrated = true;
      }
    })();
  }
  await hydratePromise;
}

export function getItemSync(key: string): string | null {
  if (hasWebStorage()) return localStorage.getItem(key);
  return memory.get(key) ?? null;
}

export function setItemSync(key: string, value: string): void {
  if (hasWebStorage()) {
    localStorage.setItem(key, value);
    return;
  }
  memory.set(key, value);
  void AsyncStorage.setItem(key, value).catch(() => {});
}

export function removeItemSync(key: string): void {
  if (hasWebStorage()) {
    localStorage.removeItem(key);
    return;
  }
  memory.delete(key);
  void AsyncStorage.removeItem(key).catch(() => {});
}

export async function getItem(key: string): Promise<string | null> {
  if (hasWebStorage()) return localStorage.getItem(key);
  await ensureStorageHydrated();
  const cached = memory.get(key);
  if (cached != null) return cached;
  const value = await AsyncStorage.getItem(key);
  if (value != null) memory.set(key, value);
  return value;
}

export async function setItem(key: string, value: string): Promise<void> {
  if (hasWebStorage()) {
    localStorage.setItem(key, value);
    return;
  }
  memory.set(key, value);
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key: string): Promise<void> {
  if (hasWebStorage()) {
    localStorage.removeItem(key);
    return;
  }
  memory.delete(key);
  await AsyncStorage.removeItem(key);
}

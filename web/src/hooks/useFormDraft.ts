import { useCallback } from "react";
import { getItemSync, removeItemSync, setItemSync } from "../utils/storage";

/**
 * Persistencia de borradores de formularios. Web: localStorage; nativo: AsyncStorage.
 */
export function useFormDraft<T>(storageKey: string, enabled = true) {
  const loadDraft = useCallback((): T | null => {
    if (!enabled) return null;
    try {
      const raw = getItemSync(storageKey);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }, [storageKey, enabled]);

  const saveDraft = useCallback(
    (data: T) => {
      try {
        setItemSync(storageKey, JSON.stringify(data));
      } catch {
        // Cuota llena o almacenamiento inaccesible.
      }
    },
    [storageKey],
  );

  const clearDraft = useCallback(() => {
    try {
      removeItemSync(storageKey);
    } catch {
      // noop
    }
  }, [storageKey]);

  return { loadDraft, saveDraft, clearDraft };
}

export function isFormDirty<T>(current: T, empty: T): boolean {
  return JSON.stringify(current) !== JSON.stringify(empty);
}

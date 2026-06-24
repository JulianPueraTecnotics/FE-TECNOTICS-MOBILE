import { useEffect, useState } from "react";

/** Retorna `value` tras `delayMs` sin cambios (útil para búsquedas y filtros). */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const t = window.setTimeout(() => setDebounced(value), delayMs);
        return () => window.clearTimeout(t);
    }, [value, delayMs]);

    return debounced;
}

export const FILTER_DEBOUNCE_MS = 500;

import { useCallback, useMemo, useState } from "react";
import { applyColumnFilters, emptyColumnFilterValues, hasActiveColumnFilters } from "./applyColumnFilters";
import type { ColumnFilterAccessor, ColumnFilterDef, ColumnFilterValues } from "./types";

export function useColumnFilters<T>(defs: ColumnFilterDef[], getValue: ColumnFilterAccessor<T>) {
    const [values, setValues] = useState<ColumnFilterValues>(() => emptyColumnFilterValues(defs));

    const setFilter = useCallback((id: string, value: string) => {
        setValues((prev) => ({ ...prev, [id]: value }));
    }, []);

    const clearFilters = useCallback(() => {
        setValues(emptyColumnFilterValues(defs));
    }, [defs]);

    const clientDefs = useMemo(() => defs.filter((d) => !d.serverSide), [defs]);

    const hasActiveClientFilters = useMemo(
        () => hasActiveColumnFilters(values, clientDefs),
        [values, clientDefs],
    );

    const filterRows = useCallback(
        (rows: T[]) => applyColumnFilters(rows, values, defs, getValue),
        [values, defs, getValue],
    );

    return {
        values,
        setFilter,
        clearFilters,
        hasActiveClientFilters,
        filterRows,
        clientDefs,
    };
}

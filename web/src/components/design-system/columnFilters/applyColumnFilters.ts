import type { ColumnFilterAccessor, ColumnFilterDef, ColumnFilterValues } from "./types";

const norm = (v: string) => v.trim().toLowerCase();

/** Filtra filas: cada columna activa debe coincidir (AND). Texto: includes; select/date: exacto. */
export function applyColumnFilters<T>(
    rows: T[],
    values: ColumnFilterValues,
    defs: ColumnFilterDef[],
    getValue: ColumnFilterAccessor<T>,
): T[] {
    const active = defs.filter((d) => !d.serverSide && norm(values[d.id] ?? "") !== "");
    if (active.length === 0) return rows;

    return rows.filter((row) =>
        active.every((def) => {
            const filterVal = norm(values[def.id] ?? "");
            const cellVal = norm(getValue(row, def.id));
            if (!filterVal) return true;
            if (def.type === "select" || def.type === "date") return cellVal === filterVal;
            if (def.type === "number") return cellVal.includes(filterVal);
            return cellVal.includes(filterVal);
        }),
    );
}

export function hasActiveColumnFilters(values: ColumnFilterValues, defs?: ColumnFilterDef[]): boolean {
    if (!defs?.length) return Object.values(values).some((v) => v.trim() !== "");
    return defs.some((d) => !d.serverSide && (values[d.id] ?? "").trim() !== "");
}

export function emptyColumnFilterValues(defs: ColumnFilterDef[]): ColumnFilterValues {
    return Object.fromEntries(defs.map((d) => [d.id, ""]));
}

export type ColumnFilterType = "text" | "select" | "date" | "number";

export type ColumnFilterOption = {
    value: string;
    label: string;
};

export type ColumnFilterDef = {
    id: string;
    label: string;
    icon?: string;
    type?: ColumnFilterType;
    placeholder?: string;
    options?: ColumnFilterOption[];
    /** Si true, el filtro lo maneja el servidor (no applyColumnFilters). */
    serverSide?: boolean;
};

export type ColumnFilterValues = Record<string, string>;

export type ColumnFilterAccessor<T> = (row: T, filterId: string) => string;

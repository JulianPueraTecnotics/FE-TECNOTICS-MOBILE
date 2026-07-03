import { FilterField, FieldControl } from "../FieldInput";
import type { ColumnFilterDef, ColumnFilterValues } from "./types";

type ColumnFilterFieldsProps = {
    defs: ColumnFilterDef[];
    values: ColumnFilterValues;
    onChange: (id: string, value: string) => void;
    idPrefix?: string;
};

export function ColumnFilterFields({ defs, values, onChange, idPrefix = "col-filter" }: ColumnFilterFieldsProps) {
    return (
        <>
            {defs.map((def) => {
                const inputId = `${idPrefix}-${def.id}`;
                const value = values[def.id] ?? "";

                if (def.type === "select" && def.options) {
                    return (
                        <FilterField key={def.id} label={def.label} htmlFor={inputId} icon={def.icon ?? "ri-filter-3-line"}>
                            <FieldControl
                                id={inputId}
                                as="select"
                                value={value}
                                onChange={(e) => onChange(def.id, e.target.value)}
                            >
                                <option value="">Todos</option>
                                {def.options.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                        {opt.label}
                                    </option>
                                ))}
                            </FieldControl>
                        </FilterField>
                    );
                }

                const inputType = def.type === "date" ? "date" : def.type === "number" ? "number" : "text";

                return (
                    <FilterField key={def.id} label={def.label} htmlFor={inputId} icon={def.icon ?? "ri-search-line"}>
                        <FieldControl
                            id={inputId}
                            type={inputType}
                            value={value}
                            placeholder={def.placeholder ?? `Filtrar ${def.label.toLowerCase()}…`}
                            onChange={(e) => onChange(def.id, e.target.value)}
                        />
                    </FilterField>
                );
            })}
        </>
    );
}

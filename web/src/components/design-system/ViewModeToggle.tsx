export type ViewMode = "table" | "list" | "cards";

type ViewModeToggleProps = {
    value: ViewMode;
    onChange: (mode: ViewMode) => void;
    disabled?: boolean;
};

export function ViewModeToggle({ value, onChange, disabled = false }: ViewModeToggleProps) {
    return (
        <div className="ds-view-toggle documents-view-toggle" role="group" aria-label="Tipo de vista">
            <button
                type="button"
                className={`ds-view-btn documents-view-btn ${value === "table" ? "active" : ""}`}
                onClick={() => onChange("table")}
                title="Vista tabla"
                aria-pressed={value === "table"}
                disabled={disabled}
            >
                <i className="ri-table-line" aria-hidden />
            </button>
            <button
                type="button"
                className={`ds-view-btn documents-view-btn ${value === "list" ? "active" : ""}`}
                onClick={() => onChange("list")}
                title="Vista lista"
                aria-pressed={value === "list"}
                disabled={disabled}
            >
                <i className="ri-list-check" aria-hidden />
            </button>
            <button
                type="button"
                className={`ds-view-btn documents-view-btn ${value === "cards" ? "active" : ""}`}
                onClick={() => onChange("cards")}
                title="Vista tarjetas"
                aria-pressed={value === "cards"}
                disabled={disabled}
            >
                <i className="ri-layout-grid-line" aria-hidden />
            </button>
        </div>
    );
}

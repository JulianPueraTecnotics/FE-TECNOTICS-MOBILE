import type { ReactNode } from "react";

export type CheckCardProps = {
    checked: boolean;
    onChange: (checked: boolean) => void;
    icon: string;
    label: ReactNode;
    description?: ReactNode;
    disabled?: boolean;
    className?: string;
    type?: "checkbox" | "radio";
    name?: string;
    value?: string;
    trailing?: ReactNode;
};

/** Tarjeta seleccionable con icono (checkbox o radio). */
export function CheckCard({
    checked,
    onChange,
    icon,
    label,
    description,
    disabled = false,
    className,
    type = "checkbox",
    name,
    value,
    trailing,
}: CheckCardProps) {
    return (
        <label
            className={[
                "ds-check-card",
                checked ? "ds-check-card--checked" : "",
                disabled ? "ds-check-card--disabled" : "",
                className ?? "",
            ]
                .filter(Boolean)
                .join(" ")}
        >
            <input
                type={type}
                className="ds-check-card__input"
                checked={checked}
                disabled={disabled}
                name={name}
                value={value}
                onChange={() => onChange(type === "radio" ? true : !checked)}
            />
            <span className="ds-check-card__icon" aria-hidden>
                <i className={icon} />
            </span>
            <span className="ds-check-card__body">
                <span className="ds-check-card__label">{label}</span>
                {description ? <span className="ds-check-card__desc">{description}</span> : null}
            </span>
            {checked ? (
                <span className="ds-check-card__tick" aria-hidden>
                    <i className="ri-check-line" />
                </span>
            ) : null}
            {trailing}
        </label>
    );
}

export function CheckCardGrid({ children, className }: { children: ReactNode; className?: string }) {
    return <div className={`ds-check-card-grid ${className ?? ""}`.trim()}>{children}</div>;
}

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

type FieldInputProps = {
    icon: string;
    children: ReactNode;
    className?: string;
};

export function FieldInput({ icon, children, className = "" }: FieldInputProps) {
    return (
        <div className={`ds-field-input documents-field-input ${className}`.trim()}>
            <span className="ds-field-input__icon documents-field-input__icon" aria-hidden>
                <i className={icon} />
            </span>
            {children}
        </div>
    );
}

type FieldControlProps = InputHTMLAttributes<HTMLInputElement> & {
    as?: "input";
};

type FieldSelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    as: "select";
};

type FieldTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
    as: "textarea";
};

export function FieldControl(props: FieldControlProps | FieldSelectProps | FieldTextareaProps) {
    const className = `ds-field-input__control documents-field-input__control ${props.className ?? ""}`.trim();
    if ("as" in props && props.as === "select") {
        const { as: _as, ...rest } = props;
        return <select {...rest} className={className} />;
    }
    if ("as" in props && props.as === "textarea") {
        const { as: _as, ...rest } = props;
        return <textarea {...rest} className={`${className} ds-field-input__textarea`.trim()} />;
    }
    const { as: _as, ...rest } = props as FieldControlProps & { as?: "input" };
    return <input {...rest} className={className} />;
}

type FilterFieldProps = {
    label: string;
    htmlFor: string;
    icon: string;
    children: ReactNode;
    className?: string;
    hint?: ReactNode;
};

export function FilterField({ label, htmlFor, icon, children, className = "", hint }: FilterFieldProps) {
    return (
        <div className={`ds-filter-field documents-filter-field ${className}`.trim()}>
            <label htmlFor={htmlFor}>{label}</label>
            <FieldInput icon={icon}>{children}</FieldInput>
            {hint}
        </div>
    );
}

/** Alias semántico para formularios en modales/drawers (misma API que FilterField). */
export const FormField = FilterField;

import type { HTMLInputTypeAttribute } from "react";
import { FilterField, FieldControl } from "../../design-system";

const iconForType = (type: HTMLInputTypeAttribute): string => {
    if (type === "email") return "ri-mail-line";
    if (type === "password") return "ri-lock-password-line";
    if (type === "tel") return "ri-phone-line";
    return "ri-edit-line";
};

interface InputComponentProps {
    label: string;
    type: HTMLInputTypeAttribute;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    id?: string;
    icon?: string;
    placeholder?: string;
    autoComplete?: string;
    inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
    maxLength?: number;
    className?: string;
}

const InputComponent: React.FC<InputComponentProps> = ({
    label,
    type,
    value,
    onChange,
    id,
    icon,
    placeholder,
    autoComplete,
    inputMode,
    maxLength,
    className = "",
}) => {
    const fieldId = id ?? `input-${label.replace(/\s+/g, "-").toLowerCase()}`;
    return (
        <FilterField
            className={className}
            label={label}
            htmlFor={fieldId}
            icon={icon ?? iconForType(type)}
        >
            <FieldControl
                id={fieldId}
                type={type}
                value={value}
                onChange={onChange}
                placeholder={placeholder}
                autoComplete={autoComplete}
                inputMode={inputMode}
                maxLength={maxLength}
            />
        </FilterField>
    );
};

export default InputComponent;

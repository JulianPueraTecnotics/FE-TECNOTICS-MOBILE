type SearchFieldProps = {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    id?: string;
    disabled?: boolean;
    className?: string;
};

export function SearchField({
    value,
    onChange,
    placeholder = "Buscar…",
    id = "ds-search",
    disabled = false,
    className = "",
}: SearchFieldProps) {
    return (
        <div className={`ds-search search-box ${className}`.trim()}>
            <i className="ri-search-line" aria-hidden />
            <input
                id={id}
                type="search"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                disabled={disabled}
                aria-label={placeholder}
            />
        </div>
    );
}

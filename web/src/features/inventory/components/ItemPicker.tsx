import { useEffect, useRef, useState } from "react";
import type { ItemData } from "../../../types";
import { searchItems } from "../../../services/items.service";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { FieldControl, FieldInput } from "../../../components/design-system";

interface ItemPickerProps {
    value: ItemData | null;
    onChange: (item: ItemData | null) => void;
    placeholder?: string;
    id?: string;
    /** Dentro de FilterField/FieldInput (sin borde propio). Por defecto true. */
    embedded?: boolean;
}

/**
 * Selector de ítem del catálogo (productos). Reutiliza el endpoint de búsqueda de items
 * (searchItems) para poblar las sugerencias; no inventa endpoints nuevos.
 */
const ItemPicker: React.FC<ItemPickerProps> = ({ value, onChange, placeholder, id, embedded = true }) => {
    const [term, setTerm] = useState("");
    const [open, setOpen] = useState(false);
    const [results, setResults] = useState<ItemData[]>([]);
    const [loading, setLoading] = useState(false);
    const boxRef = useRef<HTMLDivElement>(null);
    const debounced = useDebouncedValue(term, FILTER_DEBOUNCE_MS);

    useEffect(() => {
        const onClickOutside = (e: MouseEvent) => {
            if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener("mousedown", onClickOutside);
        return () => document.removeEventListener("mousedown", onClickOutside);
    }, []);

    useEffect(() => {
        const q = debounced.trim();
        if (!q || !open) {
            setResults([]);
            return;
        }
        let ignore = false;
        setLoading(true);
        (async () => {
            try {
                const res = await searchItems(q, 1, 15);
                if (!ignore && res?.ok) setResults(res.items.filter((i) => i.kind === "product"));
            } catch {
                if (!ignore) setResults([]);
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
    }, [debounced, open]);

    const pick = (item: ItemData) => {
        onChange(item);
        setTerm("");
        setOpen(false);
    };

    const body = (
        <>
            {value ? (
                <div className="inv-picker__selected">
                    <span>
                        <strong>{value.code ? `${value.code} · ` : ""}</strong>
                        {value.name}
                    </span>
                    <button type="button" className="btn-action inv-picker__clear" title="Cambiar ítem" onClick={() => onChange(null)}>
                        <i className="ri-close-line" aria-hidden />
                    </button>
                </div>
            ) : (
                <>
                    <FieldControl
                        id={id}
                        type="text"
                        value={term}
                        placeholder={placeholder ?? "Buscar producto por nombre o código..."}
                        onChange={(e) => {
                            setTerm(e.target.value);
                            setOpen(true);
                        }}
                        onFocus={() => setOpen(true)}
                        autoComplete="off"
                    />
                    {open && term.trim() && (
                        <div className="inv-picker__list">
                            {loading ? (
                                <div className="inv-picker__empty">Buscando...</div>
                            ) : results.length === 0 ? (
                                <div className="inv-picker__empty">Sin resultados</div>
                            ) : (
                                results.map((it) => (
                                    <button type="button" key={it._id} className="inv-picker__opt" onClick={() => pick(it)}>
                                        <span className="inv-picker__code">{it.code || "—"}</span>
                                        <span className="inv-picker__name">{it.name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </>
            )}
        </>
    );

    if (embedded) {
        return (
            <div className="inv-picker inv-picker--embedded" ref={boxRef}>
                {body}
            </div>
        );
    }

    return (
        <div className="inv-picker inv-picker--standalone" ref={boxRef}>
            <FieldInput icon="ri-box-3-line">{body}</FieldInput>
        </div>
    );
};

export default ItemPicker;

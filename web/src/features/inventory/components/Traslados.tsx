import { useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getWarehouses, createTraslado } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import type { ItemData } from "../../../types";
import ItemPicker from "./ItemPicker";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl } from "../../../components/design-system";
import { todayIso } from "../inventoryFormat";

const Traslados: React.FC = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [item, setItem] = useState<ItemData | null>(null);
    const [fromId, setFromId] = useState("");
    const [toId, setToId] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [motivo, setMotivo] = useState("");
    const [fecha, setFecha] = useState(todayIso());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    }, []);

    const reset = () => {
        setItem(null);
        setCantidad("");
        setMotivo("");
        setFecha(todayIso());
    };

    const submit = async () => {
        if (!item?._id) {
            errorToast("Selecciona un producto");
            return;
        }
        if (!fromId || !toId) {
            errorToast("Selecciona bodega origen y destino");
            return;
        }
        if (fromId === toId) {
            errorToast("La bodega origen y destino deben ser distintas");
            return;
        }
        const cant = Number(cantidad);
        if (!cant || cant <= 0 || Number.isNaN(cant)) {
            errorToast("Indica una cantidad positiva a trasladar");
            return;
        }
        setSaving(true);
        try {
            await createTraslado({
                item_id: item._id,
                from_warehouse_id: fromId,
                to_warehouse_id: toId,
                cantidad: cant,
                motivo: motivo.trim() || undefined,
                fecha: fecha || undefined,
            });
            successToast("Traslado registrado");
            reset();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="inv-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Mueve existencias de una bodega a otra sin afectar el costo total del inventario.
            </p>

            <div className="inv-form-grid">
                <FilterField label="Producto *" htmlFor="traslado-item" icon="ri-box-3-line">
                    <ItemPicker id="traslado-item" value={item} onChange={setItem} />
                </FilterField>
                <FilterField label="Bodega origen *" htmlFor="traslado-from" icon="ri-logout-box-r-line">
                    <FieldControl
                        id="traslado-from"
                        as="select"
                        value={fromId}
                        onChange={(e) => setFromId(e.target.value)}
                        disabled={saving}
                    >
                        <option value="">Selecciona…</option>
                        {warehouses.map((w) => (
                            <option key={w._id} value={w._id}>
                                {w.codigo} · {w.nombre}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Bodega destino *" htmlFor="traslado-to" icon="ri-login-box-line">
                    <FieldControl
                        id="traslado-to"
                        as="select"
                        value={toId}
                        onChange={(e) => setToId(e.target.value)}
                        disabled={saving}
                    >
                        <option value="">Selecciona…</option>
                        {warehouses.map((w) => (
                            <option key={w._id} value={w._id}>
                                {w.codigo} · {w.nombre}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Cantidad *" htmlFor="traslado-cantidad" icon="ri-scales-3-line">
                    <FieldControl
                        id="traslado-cantidad"
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder="Ej. 10"
                        disabled={saving}
                    />
                </FilterField>
                <FilterField label="Fecha" htmlFor="traslado-fecha" icon="ri-calendar-line">
                    <FieldControl
                        id="traslado-fecha"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        disabled={saving}
                    />
                </FilterField>
                <FilterField label="Motivo" htmlFor="traslado-motivo" icon="ri-file-text-line">
                    <FieldControl
                        id="traslado-motivo"
                        type="text"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej. Reabastecimiento punto de venta"
                        disabled={saving}
                    />
                </FilterField>
            </div>

            <div className="inv-form-actions">
                <button type="button" className="btn-secondary" onClick={reset} disabled={saving}>
                    Limpiar
                </button>
                <button type="button" className="btn-primary" onClick={submit} disabled={saving}>
                    {saving ? (
                        <>
                            <i className="ri-loader-4-line rotating" aria-hidden /> Registrando…
                        </>
                    ) : (
                        <>
                            <i className="ri-arrow-left-right-line" aria-hidden /> Registrar traslado
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default Traslados;

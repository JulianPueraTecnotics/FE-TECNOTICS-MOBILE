import { useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getWarehouses, createAjuste } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import type { ItemData } from "../../../types";
import ItemPicker from "./ItemPicker";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl } from "../../../components/design-system";
import { todayIso } from "../inventoryFormat";

const Ajustes: React.FC = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [item, setItem] = useState<ItemData | null>(null);
    const [warehouseId, setWarehouseId] = useState("");
    const [cantidad, setCantidad] = useState("");
    const [costoUnitario, setCostoUnitario] = useState("");
    const [motivo, setMotivo] = useState("");
    const [fecha, setFecha] = useState(todayIso());
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        getWarehouses()
            .then((ws) => {
                setWarehouses(ws);
                const principal = ws.find((w) => w.es_principal) ?? ws[0];
                if (principal) setWarehouseId(principal._id);
            })
            .catch(() => setWarehouses([]));
    }, []);

    const reset = () => {
        setItem(null);
        setCantidad("");
        setCostoUnitario("");
        setMotivo("");
        setFecha(todayIso());
    };

    const submit = async () => {
        if (!item?._id) {
            errorToast("Selecciona un producto");
            return;
        }
        if (!warehouseId) {
            errorToast("Selecciona una bodega");
            return;
        }
        const cant = Number(cantidad);
        if (!cant || Number.isNaN(cant)) {
            errorToast("Indica una cantidad distinta de cero (usa negativo para descontar)");
            return;
        }
        setSaving(true);
        try {
            await createAjuste({
                item_id: item._id,
                warehouse_id: warehouseId,
                cantidad: cant,
                costo_unitario: costoUnitario ? Number(costoUnitario) : undefined,
                motivo: motivo.trim() || undefined,
                fecha: fecha || undefined,
            });
            successToast("Ajuste de inventario registrado");
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
                Aumenta (cantidad positiva) o disminuye (cantidad negativa) las existencias de un ítem en una bodega.
            </p>

            <div className="inv-form-grid">
                <FilterField label="Producto *" htmlFor="ajuste-item" icon="ri-box-3-line">
                    <ItemPicker id="ajuste-item" value={item} onChange={setItem} />
                </FilterField>
                <FilterField label="Bodega *" htmlFor="ajuste-warehouse" icon="ri-building-line">
                    <FieldControl
                        id="ajuste-warehouse"
                        as="select"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
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
                <FilterField label="Cantidad (+/−) *" htmlFor="ajuste-cantidad" icon="ri-scales-3-line">
                    <FieldControl
                        id="ajuste-cantidad"
                        type="number"
                        value={cantidad}
                        onChange={(e) => setCantidad(e.target.value)}
                        placeholder="Ej. 5 o -2"
                        disabled={saving}
                    />
                </FilterField>
                <FilterField label="Costo unitario (opcional)" htmlFor="ajuste-costo" icon="ri-money-dollar-circle-line">
                    <FieldControl
                        id="ajuste-costo"
                        type="number"
                        value={costoUnitario}
                        onChange={(e) => setCostoUnitario(e.target.value)}
                        placeholder="Para entradas valorizadas"
                        disabled={saving}
                    />
                </FilterField>
                <FilterField label="Fecha" htmlFor="ajuste-fecha" icon="ri-calendar-line">
                    <FieldControl
                        id="ajuste-fecha"
                        type="date"
                        value={fecha}
                        onChange={(e) => setFecha(e.target.value)}
                        disabled={saving}
                    />
                </FilterField>
                <FilterField label="Motivo" htmlFor="ajuste-motivo" icon="ri-file-text-line">
                    <FieldControl
                        id="ajuste-motivo"
                        type="text"
                        value={motivo}
                        onChange={(e) => setMotivo(e.target.value)}
                        placeholder="Ej. Conteo físico, merma, sobrante"
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
                            <i className="ri-check-line" aria-hidden /> Registrar ajuste
                        </>
                    )}
                </button>
            </div>
        </div>
    );
};

export default Ajustes;

import { useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getUvt, setUvt, getRetentions, createRetention, updateRetention, deleteRetention } from "../accounting.service";
import type { Uvt, RetentionConcept, RetentionType } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FilterField, FieldControl, useListFiltersPanel, ColumnFilterFields, useColumnFilters, type ColumnFilterDef } from "../../../components/design-system";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";

const TYPE_LABEL: Record<RetentionType, string> = {
    fuente: "Retefuente",
    iva: "ReteIVA",
    ica: "ReteICA",
    autorrenta: "Autorretención",
};
const TYPES: RetentionType[] = ["fuente", "iva", "ica", "autorrenta"];
const thisYear = new Date().getFullYear();
const money = (n: number) => (n || 0).toLocaleString("es-CO");

const emptyConcept = { tipo: "fuente" as RetentionType, codigo: "", descripcion: "", base_minima_uvt: 0, tarifa: 0, cuenta: "", codigo_municipio: "" };

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "tipo", label: "Tipo", type: "select", icon: "ri-percent-line", options: TYPES.map((t) => ({ value: t, label: TYPE_LABEL[t] })) },
    { id: "codigo", label: "Código", type: "text", icon: "ri-hashtag" },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line" },
    { id: "base", label: "Base UVT", type: "number", icon: "ri-scales-3-line" },
    { id: "tarifa", label: "Tarifa", type: "number", icon: "ri-percent-line" },
    { id: "cuenta", label: "Cuenta", type: "text", icon: "ri-book-2-line" },
];

const Taxes: React.FC = () => {
    const [uvts, setUvts] = useState<Uvt[]>([]);
    const [anio, setAnio] = useState(String(thisYear));
    const [valor, setValor] = useState("");
    const [savingUvt, setSavingUvt] = useState(false);

    const [concepts, setConcepts] = useState<RetentionConcept[]>([]);
    const [loading, setLoading] = useState(true);
    const [form, setForm] = useState(emptyConcept);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [savingC, setSavingC] = useState(false);
    const [toDelete, setToDelete] = useState<RetentionConcept | null>(null);

    const getRowFilterValue = useCallback((row: RetentionConcept, filterId: string): string => {
        switch (filterId) {
            case "tipo": return row.tipo ?? "";
            case "codigo": return row.codigo ?? "";
            case "descripcion": return row.descripcion ?? "";
            case "base": return String(row.base_minima_uvt ?? 0);
            case "tarifa": return String(row.tarifa ?? 0);
            case "cuenta": return row.cuenta ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedConcepts = useMemo(() => filterRows(concepts), [concepts, filterRows]);
    const hasConceptFilters = hasActiveClientFilters;

    const { filtersToolbar, filtersMobileDrawer } = useListFiltersPanel({
        panelId: "tax-concepts",
        title: "Filtrar conceptos",
        hasActiveFilters: hasConceptFilters,
        onClear: clearColFilters,
        repositionDeps: [colFilterValues],
        filterContent: (
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
        ),
    });

    const load = async () => {
        setLoading(true);
        try {
            const [u, c] = await Promise.all([getUvt(), getRetentions()]);
            setUvts(u.uvts);
            setConcepts(c.concepts);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const saveUvt = async () => {
        if (!anio || !valor) {
            errorToast("Indica año y valor de la UVT");
            return;
        }
        setSavingUvt(true);
        try {
            await setUvt(Number(anio), Number(valor));
            successToast(`UVT ${anio} guardada`);
            setValor("");
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSavingUvt(false);
        }
    };

    const set = (k: keyof typeof emptyConcept, v: string | number) => setForm((f) => ({ ...f, [k]: v }));
    const startNew = () => { setEditingId(null); setForm(emptyConcept); };
    const startEdit = (c: RetentionConcept) => {
        setEditingId(c._id);
        setForm({ tipo: c.tipo, codigo: c.codigo, descripcion: c.descripcion, base_minima_uvt: c.base_minima_uvt, tarifa: c.tarifa, cuenta: c.cuenta ?? "", codigo_municipio: c.codigo_municipio ?? "" });
    };

    const saveConcept = async () => {
        if (!form.codigo.trim()) {
            errorToast("El código del concepto es requerido");
            return;
        }
        setSavingC(true);
        try {
            const payload = { ...form, base_minima_uvt: Number(form.base_minima_uvt), tarifa: Number(form.tarifa) };
            if (editingId) await updateRetention(editingId, payload);
            else await createRetention(payload);
            successToast(editingId ? "Concepto actualizado" : "Concepto creado");
            startNew();
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSavingC(false);
        }
    };

    const remove = async () => {
        if (!toDelete) return;
        try {
            await deleteRetention(toDelete._id);
            successToast("Concepto eliminado");
            if (editingId === toDelete._id) startNew();
            setToDelete(null);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    return (
        <div className="acc-stack">
            {/* UVT por año */}
            <div className="acc-card">
                <h2>UVT por año</h2>
                <p className="acc-sub">Valor de la Unidad de Valor Tributario por vigencia. El motor lo usa para las bases mínimas de retención.</p>
                <div className="led-form-grid" style={{ alignItems: "end" }}>
                    <FilterField label="Año" htmlFor="tax-uvt-anio" icon="ri-calendar-line">
                        <FieldControl id="tax-uvt-anio" type="number" value={anio} onChange={(e) => setAnio(e.target.value)} />
                    </FilterField>
                    <FilterField label="Valor UVT" htmlFor="tax-uvt-valor" icon="ri-money-dollar-circle-line">
                        <FieldControl id="tax-uvt-valor" type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej. 49799" />
                    </FilterField>
                    <div className="acc-actions" style={{ margin: 0 }}><button className="btn-primary" onClick={saveUvt} disabled={savingUvt}>Guardar UVT</button></div>
                </div>
                {uvts.length > 0 && (
                    <div className="purchases-table-container ds-table-container" style={{ marginTop: 14 }}>
                    <table className="purchases-table ds-table">
                        <thead><tr><th>Año</th><th>Valor UVT</th></tr></thead>
                        <tbody>{uvts.map((u) => <tr key={u.anio}><td data-label="Año">{u.anio}</td><td data-label="Valor UVT">${money(u.valor)}</td></tr>)}</tbody>
                    </table>
                    </div>
                )}
            </div>

            {/* Conceptos de retención */}
            <div className="acc-card">
                <h2>Conceptos de retención</h2>
                <p className="acc-sub">Retefuente, reteIVA, reteICA y autorretención. La retención se aplica si la base supera la base mínima en UVT.</p>

                <div className="led-form-grid">
                    <FilterField label="Tipo" htmlFor="tax-concept-tipo" icon="ri-percent-line">
                        <FieldControl id="tax-concept-tipo" as="select" value={form.tipo} onChange={(e) => set("tipo", e.target.value as RetentionType)}>
                            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Código" htmlFor="tax-concept-codigo" icon="ri-hashtag">
                        <FieldControl id="tax-concept-codigo" value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ej. 365" />
                    </FilterField>
                    <FilterField label="Descripción" htmlFor="tax-concept-desc" icon="ri-file-text-line">
                        <FieldControl id="tax-concept-desc" value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Compras generales" />
                    </FilterField>
                    <FilterField label="Base mínima (UVT)" htmlFor="tax-concept-base" icon="ri-scales-3-line">
                        <FieldControl id="tax-concept-base" type="number" value={form.base_minima_uvt} onChange={(e) => set("base_minima_uvt", e.target.value)} />
                    </FilterField>
                    <FilterField label="Tarifa (%)" htmlFor="tax-concept-tarifa" icon="ri-percent-line">
                        <FieldControl id="tax-concept-tarifa" type="number" step="0.01" value={form.tarifa} onChange={(e) => set("tarifa", e.target.value)} placeholder="Ej. 2.5" />
                    </FilterField>
                    <FilterField label="Cuenta contable" htmlFor="tax-concept-cuenta" icon="ri-book-2-line">
                        <FieldControl id="tax-concept-cuenta" value={form.cuenta} onChange={(e) => set("cuenta", e.target.value)} placeholder="Código PUC" />
                    </FilterField>
                    {form.tipo === "ica" && (
                        <FilterField label="Cód. municipio (ICA)" htmlFor="tax-concept-mun" icon="ri-map-pin-line">
                            <FieldControl id="tax-concept-mun" value={form.codigo_municipio} onChange={(e) => set("codigo_municipio", e.target.value)} placeholder="Ej. 05001" />
                        </FilterField>
                    )}
                </div>
                <div className="acc-actions">
                    {editingId && <button className="btn-secondary" onClick={startNew}>Cancelar edición</button>}
                    <button className="btn-primary" onClick={saveConcept} disabled={savingC}>{savingC ? "Guardando..." : editingId ? "Actualizar concepto" : "Agregar concepto"}</button>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
                ) : concepts.length === 0 ? (
                    <p className="acc-sub" style={{ marginTop: 8 }}>No hay conceptos de retención todavía.</p>
                ) : (
                    <>
                    {filtersMobileDrawer}
                    <div className="purchases-filters-toolbar" style={{ marginTop: 14, justifyContent: "flex-end" }}>
                        {filtersToolbar}
                    </div>
                    <div className="purchases-table-container ds-table-container" style={{ marginTop: 8 }}>
                    <table className="purchases-table ds-table">
                        <thead><tr><th>Tipo</th><th>Código</th><th>Descripción</th><th>Base UVT</th><th>Tarifa</th><th>Cuenta</th><th></th></tr></thead>
                        <tbody>
                            {displayedConcepts.map((c) => (
                                <tr key={c._id}>
                                    <td data-label="Tipo">{TYPE_LABEL[c.tipo]}</td>
                                    <td data-label="Código">{c.codigo}</td>
                                    <td data-label="Descripción">{c.descripcion || "—"}</td>
                                    <td data-label="Base UVT">{c.base_minima_uvt}</td>
                                    <td data-label="Tarifa">{c.tarifa}%</td>
                                    <td data-label="Cuenta">{c.cuenta || "—"}</td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <div className="action-buttons ds-row-actions">
                                            <button className="btn-action" title="Editar" onClick={() => startEdit(c)}><i className="ri-edit-line" /></button>
                                            <button className="btn-action" title="Eliminar" onClick={() => setToDelete(c)}><i className="ri-delete-bin-line" /></button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    </>
                )}
            </div>

            <ConfirmModal isOpen={!!toDelete} title="Eliminar concepto" message={`¿Eliminar "${toDelete?.codigo} ${toDelete?.descripcion ?? ""}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={remove} />
        </div>
    );
};

export default Taxes;

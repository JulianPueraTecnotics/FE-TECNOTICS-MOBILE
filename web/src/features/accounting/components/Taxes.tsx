import { useEffect, useState } from "react";
import { getUvt, setUvt, getRetentions, createRetention, updateRetention, deleteRetention } from "../accounting.service";
import type { Uvt, RetentionConcept, RetentionType } from "../accounting.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
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
                <div className="acc-grid acc-grid-3" style={{ alignItems: "end" }}>
                    <div className="acc-field"><label>Año</label><input type="number" value={anio} onChange={(e) => setAnio(e.target.value)} /></div>
                    <div className="acc-field"><label>Valor UVT</label><input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Ej. 49799" /></div>
                    <div className="acc-actions" style={{ margin: 0 }}><button className="btn-primary" onClick={saveUvt} disabled={savingUvt}>Guardar UVT</button></div>
                </div>
                {uvts.length > 0 && (
                    <table className="acc-table" style={{ marginTop: 14 }}>
                        <thead><tr><th>Año</th><th>Valor UVT</th></tr></thead>
                        <tbody>{uvts.map((u) => <tr key={u.anio}><td>{u.anio}</td><td>${money(u.valor)}</td></tr>)}</tbody>
                    </table>
                )}
            </div>

            {/* Conceptos de retención */}
            <div className="acc-card">
                <h2>Conceptos de retención</h2>
                <p className="acc-sub">Retefuente, reteIVA, reteICA y autorretención. La retención se aplica si la base supera la base mínima en UVT.</p>

                <div className="acc-grid acc-grid-3">
                    <div className="acc-field"><label>Tipo</label>
                        <select value={form.tipo} onChange={(e) => set("tipo", e.target.value as RetentionType)}>
                            {TYPES.map((t) => <option key={t} value={t}>{TYPE_LABEL[t]}</option>)}
                        </select>
                    </div>
                    <div className="acc-field"><label>Código</label><input value={form.codigo} onChange={(e) => set("codigo", e.target.value)} placeholder="Ej. 365" /></div>
                    <div className="acc-field"><label>Descripción</label><input value={form.descripcion} onChange={(e) => set("descripcion", e.target.value)} placeholder="Compras generales" /></div>
                    <div className="acc-field"><label>Base mínima (UVT)</label><input type="number" value={form.base_minima_uvt} onChange={(e) => set("base_minima_uvt", e.target.value)} /></div>
                    <div className="acc-field"><label>Tarifa (%)</label><input type="number" step="0.01" value={form.tarifa} onChange={(e) => set("tarifa", e.target.value)} placeholder="Ej. 2.5" /></div>
                    <div className="acc-field"><label>Cuenta contable</label><input value={form.cuenta} onChange={(e) => set("cuenta", e.target.value)} placeholder="Código PUC" /></div>
                    {form.tipo === "ica" && (
                        <div className="acc-field"><label>Cód. municipio (ICA)</label><input value={form.codigo_municipio} onChange={(e) => set("codigo_municipio", e.target.value)} placeholder="Ej. 05001" /></div>
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
                    <table className="acc-table" style={{ marginTop: 14 }}>
                        <thead><tr><th>Tipo</th><th>Código</th><th>Descripción</th><th>Base UVT</th><th>Tarifa</th><th>Cuenta</th><th></th></tr></thead>
                        <tbody>
                            {concepts.map((c) => (
                                <tr key={c._id}>
                                    <td>{TYPE_LABEL[c.tipo]}</td>
                                    <td>{c.codigo}</td>
                                    <td>{c.descripcion || "—"}</td>
                                    <td>{c.base_minima_uvt}</td>
                                    <td>{c.tarifa}%</td>
                                    <td>{c.cuenta || "—"}</td>
                                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                                        <button className="btn-icon" title="Editar" onClick={() => startEdit(c)}><i className="ri-edit-line" /></button>
                                        <button className="btn-icon" title="Eliminar" onClick={() => setToDelete(c)}><i className="ri-delete-bin-line" /></button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            <ConfirmModal isOpen={!!toDelete} title="Eliminar concepto" message={`¿Eliminar "${toDelete?.codigo} ${toDelete?.descripcion ?? ""}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={remove} />
        </div>
    );
};

export default Taxes;

import { useCallback, useEffect, useState } from "react";
import "./Purchases.css";
import "../components/PurchaseModals.css";
import "../../ledger/page/Accounting.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getSupplierItems, suggestSupplierItem, applySupplierItemSuggestion, parametrizeSupplierItem, type SupplierItem } from "../supplierItems.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const acc = (p?: { niif?: string; colgaap?: string }) => p?.niif || p?.colgaap || "—";

const SupplierItemsPage: React.FC = () => {
    const [items, setItems] = useState<SupplierItem[]>([]);
    const [pendientes, setPendientes] = useState(0);
    const [aiEnabled, setAiEnabled] = useState(false);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [status, setStatus] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    // Edición manual de parametrización
    const [editing, setEditing] = useState<SupplierItem | null>(null);
    const [form, setForm] = useState({ gasto: "", cxp: "", iva: "", retefuente_cta: "", retefuente: "" });
    const [saving, setSaving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getSupplierItems({ search: debounced.trim(), status, page: 1 });
            setItems(res.items);
            setPendientes(res.pendientes);
            setAiEnabled(res.ai_enabled);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar");
        } finally {
            setLoading(false);
        }
    }, [debounced, status, refreshKey]);

    useEffect(() => { load(); }, [load]);

    const suggest = async (it: SupplierItem) => {
        setBusyId(it._id);
        try {
            await suggestSupplierItem(it._id);
            successToast("Sugerencia generada");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const applyAi = async (it: SupplierItem) => {
        setBusyId(it._id);
        try {
            const res = await applySupplierItemSuggestion(it._id);
            successToast(res.message || "Sugerencia aplicada");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const openEdit = (it: SupplierItem) => {
        setEditing(it);
        setForm({
            gasto: it.params?.cuenta_gasto_costo?.niif ?? "",
            cxp: it.params?.cuenta_por_pagar?.niif ?? "",
            iva: it.params?.cuenta_iva?.niif ?? "",
            retefuente_cta: it.params?.cuenta_retefuente?.niif ?? "",
            retefuente: it.params?.retefuente != null ? String(it.params.retefuente) : "",
        });
    };

    const saveManual = async () => {
        if (!editing) return;
        setSaving(true);
        try {
            await parametrizeSupplierItem(editing._id, {
                cuenta_gasto_costo: form.gasto ? { niif: form.gasto, colgaap: form.gasto } : undefined,
                cuenta_por_pagar: form.cxp ? { niif: form.cxp, colgaap: form.cxp } : undefined,
                cuenta_iva: form.iva ? { niif: form.iva, colgaap: form.iva } : undefined,
                cuenta_retefuente: form.retefuente_cta ? { niif: form.retefuente_cta, colgaap: form.retefuente_cta } : undefined,
                retefuente: Number(form.retefuente) || 0,
            });
            successToast("Parametrización guardada");
            setEditing(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Parametrización de productos</h1>
                        <p>Cuentas contables y retención por producto de cada proveedor. {aiEnabled ? "La IA sugiere automáticamente." : "IA no configurada (parametrización manual)."}</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar producto, NIT..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                            <option value="">Todos</option>
                            <option value="NO_PARAMETRIZADO">Pendientes</option>
                            <option value="PARAMETRIZADO">Parametrizados</option>
                        </select>
                    </div>
                </div>

                {pendientes > 0 && (
                    <div className="purchases-summary" style={{ background: "rgba(255,159,67,.12)" }}>
                        <i className="ri-error-warning-line" style={{ color: "#e08a2b" }} />
                        <span><strong>{pendientes}</strong> producto(s) sin parametrizar.</span>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando...</div>
                ) : items.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-price-tag-3-line"></i>
                        <p>No hay productos de proveedor. Se crean automáticamente al importar compras.</p>
                    </div>
                ) : (
                    <div className="purchases-table-container">
                        <table className="purchases-table">
                            <thead>
                                <tr><th>Producto</th><th>NIT prov.</th><th>Gasto</th><th>CxP</th><th>Retef.</th><th>Estado</th><th>IA</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {items.map((it) => {
                                    const busy = busyId === it._id;
                                    const hasAi = !!it.ai_suggestion;
                                    return (
                                        <tr key={it._id}>
                                            <td data-label="Producto"><strong>{it.codigo}</strong><br /><span style={{ color: "var(--text-muted)", fontSize: ".82rem" }}>{it.descripcion}</span></td>
                                            <td data-label="NIT prov.">{it.supplier_doc}</td>
                                            <td data-label="Gasto">{acc(it.params?.cuenta_gasto_costo)}</td>
                                            <td data-label="CxP">{acc(it.params?.cuenta_por_pagar)}</td>
                                            <td data-label="Retef.">{it.params?.retefuente ? `${it.params.retefuente}%` : "—"}</td>
                                            <td data-label="Estado"><span className={`status-badge ${it.status === "PARAMETRIZADO" ? "status-paid" : "status-pending"}`}>{it.status === "PARAMETRIZADO" ? "Listo" : "Pendiente"}</span></td>
                                            <td data-label="IA">
                                                {hasAi ? (
                                                    <span title={`${it.ai_suggestion?.razonamiento ?? ""} (confianza ${it.ai_suggestion?.confianza})`} className="status-badge status-paid">
                                                        <i className="ri-sparkling-line" /> {it.ai_suggestion?.cuenta_gasto_costo?.codigo ?? "—"}
                                                    </span>
                                                ) : it.ai_error ? (
                                                    <span className="status-badge status-rejected" title={it.ai_error}>error</span>
                                                ) : "—"}
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    {aiEnabled && !hasAi && <button className="btn-icon" title="Sugerir con IA" onClick={() => suggest(it)} disabled={busy}><i className="ri-sparkling-2-line" /></button>}
                                                    {hasAi && <button className="btn-icon" title="Aplicar sugerencia IA" onClick={() => applyAi(it)} disabled={busy} style={{ color: "var(--accent-teal)", borderColor: "var(--accent-teal)" }}><i className="ri-magic-line" /></button>}
                                                    <button className="btn-icon" title="Parametrizar manual" onClick={() => openEdit(it)}><i className="ri-edit-line" /></button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editing && (
                <div className="pm-overlay" onClick={() => !saving && setEditing(null)} role="presentation">
                    <div className="pm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="pm-header">
                            <h3>Parametrizar — {editing.codigo}</h3>
                            <button className="pm-close" onClick={() => setEditing(null)} disabled={saving}><i className="ri-close-line" /></button>
                        </div>
                        <div className="pm-body">
                            <p className="pm-hint">{editing.descripcion}</p>
                            {editing.ai_suggestion && (
                                <div className="led-balance ok" style={{ marginBottom: 12 }}>
                                    <i className="ri-sparkling-line" /> IA sugiere: gasto {editing.ai_suggestion.cuenta_gasto_costo?.codigo}, CxP {editing.ai_suggestion.cuenta_por_pagar?.codigo}, retef {editing.ai_suggestion.retefuente_porcentaje ?? 0}%
                                </div>
                            )}
                            <div className="pm-grid">
                                <div className="pm-field"><label>Cuenta gasto/costo *</label><input value={form.gasto} onChange={(e) => setForm((f) => ({ ...f, gasto: e.target.value }))} placeholder="Ej. 513595" /></div>
                                <div className="pm-field"><label>Cuenta por pagar *</label><input value={form.cxp} onChange={(e) => setForm((f) => ({ ...f, cxp: e.target.value }))} placeholder="Ej. 220505" /></div>
                                <div className="pm-field"><label>Cuenta IVA</label><input value={form.iva} onChange={(e) => setForm((f) => ({ ...f, iva: e.target.value }))} placeholder="Ej. 240810" /></div>
                                <div className="pm-field"><label>Cuenta retefuente</label><input value={form.retefuente_cta} onChange={(e) => setForm((f) => ({ ...f, retefuente_cta: e.target.value }))} placeholder="Ej. 236540" /></div>
                                <div className="pm-field"><label>Retefuente (%)</label><input type="number" step="0.01" value={form.retefuente} onChange={(e) => setForm((f) => ({ ...f, retefuente: e.target.value }))} /></div>
                            </div>
                            <p className="pm-hint">El estado pasa a "Listo" cuando tiene cuenta de gasto y de por pagar.</p>
                        </div>
                        <div className="pm-actions">
                            <button className="pm-cancel" onClick={() => setEditing(null)} disabled={saving}>Cancelar</button>
                            <button className="pm-submit" onClick={saveManual} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default SupplierItemsPage;

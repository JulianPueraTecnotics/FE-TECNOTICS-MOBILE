import { useCallback, useEffect, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "../../accounting/page/Configuration.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAssets, createAsset, updateAsset, deleteAsset, importAssets, depreciate, disposeAsset, type FixedAsset } from "../assets.service";
import { downloadRowsXlsx, downloadRowsCsv, readSpreadsheet, type ColumnDef } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const thisMonth = () => new Date().toISOString().slice(0, 7);
const ESTADO_BADGE: Record<string, string> = { activo: "status-paid", dado_de_baja: "status-rejected", vendido: "status-pending" };
const ESTADO_LABEL: Record<string, string> = { activo: "Activo", dado_de_baja: "Dado de baja", vendido: "Vendido" };

const COLS: ColumnDef[] = [
    { key: "codigo", header: "codigo", sample: "AF-001" },
    { key: "nombre", header: "nombre", sample: "Computador portátil" },
    { key: "categoria", header: "categoria", sample: "Equipo de cómputo" },
    { key: "fecha_adquisicion", header: "fecha_adquisicion", sample: "2025-01-15" },
    { key: "costo", header: "costo", sample: "3000000" },
    { key: "valor_residual", header: "valor_residual", sample: "0" },
    { key: "vida_util_meses", header: "vida_util_meses", sample: "36" },
    { key: "cuenta_activo", header: "cuenta_activo", sample: "152835" },
    { key: "cuenta_depreciacion_acumulada", header: "cuenta_depreciacion_acumulada", sample: "159235" },
    { key: "cuenta_gasto_depreciacion", header: "cuenta_gasto_depreciacion", sample: "516035" },
];

const emptyForm = { codigo: "", nombre: "", categoria: "", fecha_adquisicion: "", costo: "", valor_residual: "0", vida_util_meses: "", cuenta_activo: "", cuenta_depreciacion_acumulada: "", cuenta_gasto_depreciacion: "" };

const FixedAssetsPage: React.FC = () => {
    const [assets, setAssets] = useState<FixedAsset[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [estado, setEstado] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
    const fileRef = useRef<HTMLInputElement>(null);

    const [periodo, setPeriodo] = useState(thisMonth());
    const [depreciating, setDepreciating] = useState(false);

    const [modal, setModal] = useState<FixedAsset | null | "new">(null);
    const [form, setForm] = useState(emptyForm);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);

    const [disposeOf, setDisposeOf] = useState<FixedAsset | null>(null);
    const [disp, setDisp] = useState({ tipo: "venta" as "venta" | "baja", fecha: "", motivo: "", ventaValor: "", cuentaContrapartida: "", cuentaResultado: "" });
    const [disposing, setDisposing] = useState(false);

    useRealtime(RealtimeEvents.ASSET_CHANGED, (p) => setAssets((prev) => applyRealtimeChange(prev as any, p) as any));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAssets({ estado, search: debounced.trim() });
            setAssets(res.assets);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [estado, debounced, refreshKey]);

    useEffect(() => { load(); }, [load]);

    const runDepreciation = async () => {
        if (!confirm(`¿Contabilizar la depreciación de ${periodo} para los activos activos?`)) return;
        setDepreciating(true);
        try {
            const res = await depreciate(periodo);
            successToast(res.message);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setDepreciating(false);
        }
    };

    const openNew = () => { setForm(emptyForm); setModal("new"); };
    const openEdit = (a: FixedAsset) => {
        setForm({
            codigo: a.codigo, nombre: a.nombre, categoria: a.categoria ?? "",
            fecha_adquisicion: a.fecha_adquisicion ? new Date(a.fecha_adquisicion).toISOString().slice(0, 10) : "",
            costo: String(a.costo), valor_residual: String(a.valor_residual), vida_util_meses: String(a.vida_util_meses),
            cuenta_activo: a.cuenta_activo, cuenta_depreciacion_acumulada: a.cuenta_depreciacion_acumulada, cuenta_gasto_depreciacion: a.cuenta_gasto_depreciacion,
        });
        setModal(a);
    };

    const save = async () => {
        if (!form.codigo || !form.nombre || !form.costo || !form.vida_util_meses || !form.fecha_adquisicion) { errorToast("Código, nombre, costo, vida útil y fecha son obligatorios"); return; }
        setSaving(true);
        try {
            const payload = {
                codigo: form.codigo.trim(), nombre: form.nombre.trim(), categoria: form.categoria.trim() || undefined,
                fecha_adquisicion: form.fecha_adquisicion, costo: Number(form.costo) || 0, valor_residual: Number(form.valor_residual) || 0,
                vida_util_meses: Number(form.vida_util_meses) || 0,
                cuenta_activo: form.cuenta_activo.trim(), cuenta_depreciacion_acumulada: form.cuenta_depreciacion_acumulada.trim(), cuenta_gasto_depreciacion: form.cuenta_gasto_depreciacion.trim(),
            };
            if (modal && modal !== "new") await updateAsset(modal._id, payload);
            else await createAsset(payload);
            successToast(modal === "new" ? "Activo creado" : "Activo actualizado");
            setModal(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        try {
            await deleteAsset(toDelete.id);
            successToast("Activo eliminado");
            setToDelete(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        try {
            const rows = await readSpreadsheet(file, COLS);
            const valid = rows
                .filter((r) => (r.codigo || "").trim() && r.codigo !== "AF-001")
                .map((r) => ({ codigo: r.codigo, nombre: r.nombre, categoria: r.categoria, fecha_adquisicion: r.fecha_adquisicion, costo: Number(r.costo) || 0, valor_residual: Number(r.valor_residual) || 0, vida_util_meses: Number(r.vida_util_meses) || 0, cuenta_activo: r.cuenta_activo, cuenta_depreciacion_acumulada: r.cuenta_depreciacion_acumulada, cuenta_gasto_depreciacion: r.cuenta_gasto_depreciacion }));
            if (!valid.length) { errorToast("No se encontraron activos válidos en el archivo"); return; }
            const res = await importAssets(valid as any);
            successToast(`${res.importados} activo(s) importado(s)`);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al importar");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const headers = COLS.map((c) => c.header);
        const guide = [COLS.map((c) => c.sample ?? "")];
        if (kind === "xlsx") downloadRowsXlsx("plantilla-activos-fijos.xlsx", headers, guide);
        else downloadRowsCsv("plantilla-activos-fijos.csv", headers, guide);
    };

    const openDispose = (a: FixedAsset) => { setDisposeOf(a); setDisp({ tipo: "venta", fecha: today(), motivo: "", ventaValor: "", cuentaContrapartida: "", cuentaResultado: "" }); };
    const runDispose = async () => {
        if (!disposeOf) return;
        if (!disp.cuentaResultado) { errorToast("Indica la cuenta de resultado (utilidad/pérdida)"); return; }
        if (disp.tipo === "venta" && !disp.cuentaContrapartida) { errorToast("Indica la cuenta de banco/CxC de la venta"); return; }
        setDisposing(true);
        try {
            const res = await disposeAsset(disposeOf._id, { tipo: disp.tipo, fecha: disp.fecha || undefined, motivo: disp.motivo || undefined, ventaValor: Number(disp.ventaValor) || 0, cuentaContrapartida: disp.cuentaContrapartida || undefined, cuentaResultado: disp.cuentaResultado });
            successToast(res.message);
            setDisposeOf(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setDisposing(false);
        }
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Activos fijos</h1>
                        <p>Ficha, depreciación (línea recta) y baja/venta de activos</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box"><i className="ri-search-line"></i><input type="text" placeholder="Buscar activo..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
                        <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                            <option value="">Todos</option><option value="activo">Activos</option><option value="dado_de_baja">Dados de baja</option><option value="vendido">Vendidos</option>
                        </select>
                        <button className="btn-secondary" onClick={() => downloadTemplate("xlsx")}><i className="ri-file-excel-2-line" /> Plantilla</button>
                        <button className="btn-secondary" onClick={() => fileRef.current?.click()}><i className="ri-upload-2-line" /> Importar</button>
                        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
                        <button className="btn-primary" onClick={openNew}><i className="ri-add-line" /> Nuevo activo</button>
                    </div>
                </div>

                <div className="purchases-summary">
                    <i className="ri-calendar-line" />
                    <span>Depreciar período:</span>
                    <input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid var(--border-light)" }} />
                    <button className="btn-primary" style={{ padding: "8px 16px", border: "none", borderRadius: 8, background: "var(--accent-teal)", color: "#fff", cursor: "pointer" }} onClick={runDepreciation} disabled={depreciating}>
                        {depreciating ? "Contabilizando..." : "Contabilizar depreciación"}
                    </button>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando activos...</div>
                ) : assets.length === 0 ? (
                    <div className="purchases-empty"><i className="ri-computer-line"></i><p>No hay activos fijos. Crea uno o importa desde Excel.</p></div>
                ) : (
                    <div className="purchases-table-container">
                        <table className="purchases-table">
                            <thead>
                                <tr><th>Código</th><th>Nombre</th><th style={{ textAlign: "right" }}>Costo</th><th style={{ textAlign: "right" }}>Dep. acum.</th><th style={{ textAlign: "right" }}>Valor libros</th><th>Estado</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {assets.map((a) => (
                                    <tr key={a._id}>
                                        <td data-label="Código">{a.codigo}</td>
                                        <td data-label="Nombre">{a.nombre}<br /><span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{a.categoria} · {a.vida_util_meses}m · adq. {fdate(a.fecha_adquisicion)}</span></td>
                                        <td data-label="Costo" style={{ textAlign: "right" }}>{money(a.costo)}</td>
                                        <td data-label="Dep. acum." style={{ textAlign: "right" }}>{money(a.depreciacion_acumulada)}</td>
                                        <td data-label="Valor libros" style={{ textAlign: "right", fontWeight: 600 }}>{money(a.valor_libros ?? a.costo - a.depreciacion_acumulada)}</td>
                                        <td data-label="Estado"><span className={`status-badge ${ESTADO_BADGE[a.estado]}`}>{ESTADO_LABEL[a.estado]}</span></td>
                                        <td data-label="Acciones">
                                            <div className="action-buttons">
                                                {a.estado === "activo" && <>
                                                    <button className="btn-icon" title="Editar" onClick={() => openEdit(a)}><i className="ri-edit-line" /></button>
                                                    <button className="btn-icon" title="Baja / venta" onClick={() => openDispose(a)}><i className="ri-logout-box-r-line" /></button>
                                                    {a.depreciacion_acumulada === 0 && <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: a._id, name: a.nombre })}><i className="ri-delete-bin-line" /></button>}
                                                </>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal ficha */}
            {modal && (
                <div className="pm-overlay" onClick={() => !saving && setModal(null)} role="presentation">
                    <div className="pm-modal pm-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="pm-header"><h3>{modal === "new" ? "Nuevo activo" : "Editar activo"}</h3><button className="pm-close" onClick={() => setModal(null)} disabled={saving}><i className="ri-close-line" /></button></div>
                        <div className="pm-body">
                            <div className="pm-grid">
                                <div className="pm-field"><label>Código *</label><input value={form.codigo} onChange={(e) => setForm((f) => ({ ...f, codigo: e.target.value }))} /></div>
                                <div className="pm-field"><label>Categoría</label><input value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))} /></div>
                                <div className="pm-field pm-col-2"><label>Nombre *</label><input value={form.nombre} onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} /></div>
                                <div className="pm-field"><label>Fecha adquisición *</label><input type="date" value={form.fecha_adquisicion} onChange={(e) => setForm((f) => ({ ...f, fecha_adquisicion: e.target.value }))} /></div>
                                <div className="pm-field"><label>Costo *</label><input type="number" value={form.costo} onChange={(e) => setForm((f) => ({ ...f, costo: e.target.value }))} /></div>
                                <div className="pm-field"><label>Valor residual</label><input type="number" value={form.valor_residual} onChange={(e) => setForm((f) => ({ ...f, valor_residual: e.target.value }))} /></div>
                                <div className="pm-field"><label>Vida útil (meses) *</label><input type="number" value={form.vida_util_meses} onChange={(e) => setForm((f) => ({ ...f, vida_util_meses: e.target.value }))} /></div>
                                <div className="pm-field"><label>Cuenta activo</label><input value={form.cuenta_activo} onChange={(e) => setForm((f) => ({ ...f, cuenta_activo: e.target.value }))} placeholder="Ej. 152835" /></div>
                                <div className="pm-field"><label>Cuenta deprec. acumulada</label><input value={form.cuenta_depreciacion_acumulada} onChange={(e) => setForm((f) => ({ ...f, cuenta_depreciacion_acumulada: e.target.value }))} placeholder="Ej. 159235" /></div>
                                <div className="pm-field pm-col-2"><label>Cuenta gasto depreciación</label><input value={form.cuenta_gasto_depreciacion} onChange={(e) => setForm((f) => ({ ...f, cuenta_gasto_depreciacion: e.target.value }))} placeholder="Ej. 516035" /></div>
                            </div>
                            {form.costo && form.vida_util_meses && <p className="pm-hint">Cuota mensual estimada: <strong>{money((Number(form.costo) - Number(form.valor_residual || 0)) / (Number(form.vida_util_meses) || 1))}</strong></p>}
                        </div>
                        <div className="pm-actions"><button className="pm-cancel" onClick={() => setModal(null)} disabled={saving}>Cancelar</button><button className="pm-submit" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button></div>
                    </div>
                </div>
            )}

            {/* Modal baja/venta */}
            {disposeOf && (
                <div className="pm-overlay" onClick={() => !disposing && setDisposeOf(null)} role="presentation">
                    <div className="pm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="pm-header"><h3>Baja / venta — {disposeOf.nombre}</h3><button className="pm-close" onClick={() => setDisposeOf(null)} disabled={disposing}><i className="ri-close-line" /></button></div>
                        <div className="pm-body">
                            <p className="pm-hint">Valor en libros: <strong>{money(disposeOf.valor_libros ?? disposeOf.costo - disposeOf.depreciacion_acumulada)}</strong></p>
                            <div className="pm-grid">
                                <div className="pm-field"><label>Tipo</label>
                                    <select value={disp.tipo} onChange={(e) => setDisp((d) => ({ ...d, tipo: e.target.value as "venta" | "baja" }))}>
                                        <option value="venta">Venta</option><option value="baja">Baja</option>
                                    </select>
                                </div>
                                <div className="pm-field"><label>Fecha</label><input type="date" value={disp.fecha} onChange={(e) => setDisp((d) => ({ ...d, fecha: e.target.value }))} /></div>
                                {disp.tipo === "venta" && <>
                                    <div className="pm-field"><label>Valor de venta</label><input type="number" value={disp.ventaValor} onChange={(e) => setDisp((d) => ({ ...d, ventaValor: e.target.value }))} /></div>
                                    <div className="pm-field"><label>Cuenta banco/CxC</label><input value={disp.cuentaContrapartida} onChange={(e) => setDisp((d) => ({ ...d, cuentaContrapartida: e.target.value }))} placeholder="Ej. 111005" /></div>
                                </>}
                                <div className="pm-field pm-col-2"><label>Cuenta resultado (utilidad/pérdida) *</label><input value={disp.cuentaResultado} onChange={(e) => setDisp((d) => ({ ...d, cuentaResultado: e.target.value }))} placeholder="Ej. 424540 / 531005" /></div>
                                <div className="pm-field pm-col-2"><label>Motivo</label><input value={disp.motivo} onChange={(e) => setDisp((d) => ({ ...d, motivo: e.target.value }))} /></div>
                            </div>
                        </div>
                        <div className="pm-actions"><button className="pm-cancel" onClick={() => setDisposeOf(null)} disabled={disposing}>Cancelar</button><button className="pm-submit" onClick={runDispose} disabled={disposing}>{disposing ? "Procesando..." : "Confirmar y contabilizar"}</button></div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!toDelete} title="Eliminar activo" message={`¿Eliminar "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={handleDelete} />
        </main>
    );
};

function today() { return new Date().toISOString().slice(0, 10); }

export default FixedAssetsPage;

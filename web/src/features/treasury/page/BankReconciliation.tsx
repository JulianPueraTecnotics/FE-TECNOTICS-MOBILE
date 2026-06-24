import { useCallback, useEffect, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "../../accounting/page/Configuration.css";
import "../../ledger/page/Accounting.css";
import { getReconciliations, getReconciliation, buildReconciliation, getReconSummary, toggleMatch, postAdjustment, closeReconciliation, type Reconciliation, type ReconSummary } from "../reconciliation.service";
import { downloadRowsXlsx, downloadRowsCsv, readSpreadsheet, type ColumnDef } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

const COLS: ColumnDef[] = [
    { key: "fecha", header: "fecha", sample: "2026-06-01" },
    { key: "descripcion", header: "descripcion", sample: "Consignación cliente" },
    { key: "referencia", header: "referencia", sample: "REF123" },
    { key: "valor", header: "valor", sample: "500000" },
];

const BankReconciliationPage: React.FC = () => {
    const [recons, setRecons] = useState<Reconciliation[]>([]);
    const [current, setCurrent] = useState<Reconciliation | null>(null);
    const [summary, setSummary] = useState<ReconSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);

    // Form de creación
    const [desde, setDesde] = useState(monthStart());
    const [hasta, setHasta] = useState(today());
    const [saldoBanco, setSaldoBanco] = useState("");
    const [statement, setStatement] = useState<{ fecha?: string; descripcion: string; referencia?: string; valor: number }[]>([]);
    const fileRef = useRef<HTMLInputElement>(null);

    // Ajuste
    const [adjDesc, setAdjDesc] = useState("");
    const [adjValor, setAdjValor] = useState("");
    const [adjCuenta, setAdjCuenta] = useState("");

    const loadList = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getReconciliations();
            setRecons(res.recons);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList]);

    const openRecon = async (id: string) => {
        try {
            const [r, s] = await Promise.all([getReconciliation(id), getReconSummary(id)]);
            setCurrent(r.recon);
            setSummary(s.resumen);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const refreshCurrent = async (id: string) => {
        const [r, s] = await Promise.all([getReconciliation(id), getReconSummary(id)]);
        setCurrent(r.recon);
        setSummary(s.resumen);
    };

    const onImport = async (file: File | null) => {
        if (!file) return;
        try {
            const rows = await readSpreadsheet(file, COLS);
            const valid = rows
                .filter((r) => (r.descripcion || r.valor) && r.descripcion !== "Consignación cliente")
                .map((r) => ({ fecha: r.fecha || undefined, descripcion: r.descripcion || "", referencia: r.referencia || undefined, valor: Number(r.valor) || 0 }))
                .filter((r) => r.valor !== 0);
            if (!valid.length) { errorToast("No se encontraron movimientos. Usa la plantilla (fecha, descripcion, referencia, valor)."); return; }
            setStatement(valid);
            successToast(`${valid.length} movimientos cargados del extracto`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al leer el extracto");
        } finally {
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const create = async () => {
        if (!statement.length) { errorToast("Importa el extracto primero"); return; }
        setCreating(true);
        try {
            const res = await buildReconciliation({ desde, hasta, saldo_banco: Number(saldoBanco) || 0, statement });
            successToast("Conciliación creada");
            setStatement([]);
            setSaldoBanco("");
            await loadList();
            openRecon(res.recon._id);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al crear");
        } finally {
            setCreating(false);
        }
    };

    const match = async (extractoIdx: number, libroIdx: number | null) => {
        if (!current) return;
        try {
            await toggleMatch(current._id, extractoIdx, libroIdx);
            await refreshCurrent(current._id);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const addAdjustment = async () => {
        if (!current) return;
        if (!adjDesc || !adjValor || !adjCuenta) { errorToast("Completa descripción, valor y cuenta del ajuste"); return; }
        try {
            await postAdjustment(current._id, adjDesc, Number(adjValor), adjCuenta);
            successToast("Ajuste contabilizado");
            setAdjDesc(""); setAdjValor(""); setAdjCuenta("");
            await refreshCurrent(current._id);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const close = async () => {
        if (!current) return;
        if (!confirm("¿Cerrar esta conciliación?")) return;
        try {
            await closeReconciliation(current._id);
            successToast("Conciliación cerrada");
            await refreshCurrent(current._id);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const downloadTemplate = (kind: "xlsx" | "csv") => {
        const headers = COLS.map((c) => c.header);
        const guide = [COLS.map((c) => c.sample ?? "")];
        if (kind === "xlsx") downloadRowsXlsx("plantilla-extracto-banco.xlsx", headers, guide);
        else downloadRowsCsv("plantilla-extracto-banco.csv", headers, guide);
    };

    // ── Vista DETALLE ──
    if (current) {
        const pendientesLibros = current.books.filter((b) => b.estado === "pendiente");
        return (
            <main className="purchases-page">
                <div className="purchases-container">
                    <div className="purchases-header">
                        <div className="header-content">
                            <h1>Conciliación — {current.cuenta_nombre || current.cuenta}</h1>
                            <p>{fdate(current.desde)} a {fdate(current.hasta)} · {current.estado === "cerrada" ? "Cerrada" : "Borrador"}</p>
                        </div>
                        <div className="purchases-actions">
                            <button className="btn-secondary" onClick={() => { setCurrent(null); loadList(); }}><i className="ri-arrow-left-line" /> Volver</button>
                            {current.estado !== "cerrada" && <button className="btn-primary" onClick={close}><i className="ri-lock-line" /> Cerrar conciliación</button>}
                        </div>
                    </div>

                    {summary && (
                        <div className="purchases-summary" style={{ flexWrap: "wrap", gap: 18 }}>
                            <span>Saldo banco: <strong>{money(current.saldo_banco)}</strong></span>
                            <span>Saldo libros: <strong>{money(current.saldo_libros)}</strong></span>
                            <span>Pend. extracto: <strong>{money(summary.pendiente_extracto)}</strong></span>
                            <span>Pend. libros: <strong>{money(summary.pendiente_libros)}</strong></span>
                            <span style={{ color: Math.abs(summary.diferencia) < 1 ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                                Diferencia: <strong>{money(summary.diferencia)}</strong> {Math.abs(summary.diferencia) < 1 ? "✓" : ""}
                            </span>
                        </div>
                    )}

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: 12 }}>
                        <div className="acc-card">
                            <h3>Extracto del banco</h3>
                            <table className="acc-table">
                                <thead><tr><th>Fecha</th><th>Descripción</th><th style={{ textAlign: "right" }}>Valor</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {current.statement.map((s, i) => (
                                        <tr key={i} style={s.estado === "conciliado" ? { background: "rgba(46,160,67,.08)" } : undefined}>
                                            <td>{fdate(s.fecha)}</td>
                                            <td>{s.descripcion}</td>
                                            <td style={{ textAlign: "right", color: s.valor < 0 ? "var(--tertiary-color)" : undefined }}>{money(s.valor)}</td>
                                            <td>
                                                {s.estado === "conciliado" ? (
                                                    <button className="btn-action" onClick={() => match(i, null)} disabled={current.estado === "cerrada"} title="Desemparejar"><i className="ri-link-unlink" /> ✓</button>
                                                ) : (
                                                    <select disabled={current.estado === "cerrada"} defaultValue="" onChange={(e) => e.target.value !== "" && match(i, Number(e.target.value))} style={{ fontSize: ".8rem", padding: "3px 6px" }}>
                                                        <option value="">Emparejar…</option>
                                                        {pendientesLibros.map((b) => (
                                                            <option key={current.books.indexOf(b)} value={current.books.indexOf(b)}>{b.tipo}-{b.consecutivo} · {money(b.valor)}</option>
                                                        ))}
                                                    </select>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="acc-card">
                            <h3>Movimientos en libros (cuenta banco)</h3>
                            <table className="acc-table">
                                <thead><tr><th>Comp.</th><th>Descripción</th><th style={{ textAlign: "right" }}>Valor</th><th>Estado</th></tr></thead>
                                <tbody>
                                    {current.books.map((b, i) => (
                                        <tr key={i} style={b.estado === "conciliado" ? { background: "rgba(46,160,67,.08)" } : undefined}>
                                            <td>{b.tipo}-{b.consecutivo}</td>
                                            <td>{b.descripcion}</td>
                                            <td style={{ textAlign: "right", color: b.valor < 0 ? "var(--tertiary-color)" : undefined }}>{money(b.valor)}</td>
                                            <td>{b.estado === "conciliado" ? <span className="status-badge status-paid">✓</span> : <span className="status-badge status-pending">pend.</span>}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {current.estado !== "cerrada" && (
                        <div className="acc-card" style={{ marginTop: 16 }}>
                            <h3>Registrar ajuste (comisión / abono no contabilizado)</h3>
                            <p className="acc-sub">Contabiliza una partida conciliatoria. Valor positivo = comisión/gasto; negativo = abono/ingreso.</p>
                            <div className="acc-grid acc-grid-3" style={{ alignItems: "end" }}>
                                <div className="acc-field"><label>Descripción</label><input value={adjDesc} onChange={(e) => setAdjDesc(e.target.value)} placeholder="Comisión bancaria" /></div>
                                <div className="acc-field"><label>Valor</label><input type="number" value={adjValor} onChange={(e) => setAdjValor(e.target.value)} /></div>
                                <div className="acc-field"><label>Cuenta gasto/ingreso (PUC)</label><input value={adjCuenta} onChange={(e) => setAdjCuenta(e.target.value)} placeholder="Ej. 530520" /></div>
                            </div>
                            <div className="acc-actions"><button className="btn-primary" onClick={addAdjustment}>Contabilizar ajuste</button></div>
                        </div>
                    )}
                </div>
            </main>
        );
    }

    // ── Vista LISTA + CREAR ──
    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Conciliación bancaria</h1>
                        <p>Compara el extracto del banco con los movimientos contables de la cuenta banco</p>
                    </div>
                </div>

                <div className="acc-card">
                    <div className="acc-card-head">
                        <div><h2>Nueva conciliación</h2><p className="acc-sub">Importa el extracto del banco (Excel/CSV) y el período a conciliar.</p></div>
                        <div className="acc-head-actions">
                            <button className="btn-secondary" onClick={() => downloadTemplate("xlsx")}><i className="ri-file-excel-2-line" /> Plantilla Excel</button>
                            <button className="btn-secondary" onClick={() => downloadTemplate("csv")}><i className="ri-file-text-line" /> Plantilla CSV</button>
                            <button className="btn-primary" onClick={() => fileRef.current?.click()}><i className="ri-upload-2-line" /> Importar extracto</button>
                            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" hidden onChange={(e) => onImport(e.target.files?.[0] ?? null)} />
                        </div>
                    </div>
                    <div className="acc-grid acc-grid-3" style={{ alignItems: "end" }}>
                        <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                        <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                        <div className="acc-field"><label>Saldo final según banco</label><input type="number" value={saldoBanco} onChange={(e) => setSaldoBanco(e.target.value)} /></div>
                    </div>
                    {statement.length > 0 && <p className="acc-sub" style={{ marginTop: 10 }}>{statement.length} movimientos del extracto listos para conciliar.</p>}
                    <div className="acc-actions"><button className="btn-primary" onClick={create} disabled={creating || !statement.length}>{creating ? "Creando..." : "Crear y conciliar"}</button></div>
                </div>

                <div className="acc-card" style={{ marginTop: 16 }}>
                    <h2>Conciliaciones</h2>
                    {loading ? (
                        <div className="page-loading" style={{ padding: 16 }}>Cargando...</div>
                    ) : recons.length === 0 ? (
                        <p className="acc-sub">Aún no hay conciliaciones.</p>
                    ) : (
                        <table className="acc-table" style={{ marginTop: 8 }}>
                            <thead><tr><th>Cuenta</th><th>Período</th><th style={{ textAlign: "right" }}>Saldo banco</th><th style={{ textAlign: "right" }}>Saldo libros</th><th>Estado</th><th></th></tr></thead>
                            <tbody>
                                {recons.map((r) => (
                                    <tr key={r._id}>
                                        <td>{r.cuenta_nombre || r.cuenta}</td>
                                        <td>{fdate(r.desde)} – {fdate(r.hasta)}</td>
                                        <td style={{ textAlign: "right" }}>{money(r.saldo_banco)}</td>
                                        <td style={{ textAlign: "right" }}>{money(r.saldo_libros)}</td>
                                        <td><span className={`status-badge ${r.estado === "cerrada" ? "status-paid" : "status-pending"}`}>{r.estado === "cerrada" ? "Cerrada" : "Borrador"}</span></td>
                                        <td style={{ textAlign: "right" }}><button className="btn-action" onClick={() => openRecon(r._id)}><i className="ri-eye-line" /> Abrir</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </main>
    );
};

export default BankReconciliationPage;

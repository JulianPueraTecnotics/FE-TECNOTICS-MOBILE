import { useCallback, useEffect, useState } from "react";
import { getGeneralLedger, getAccountDetail, type LedgerRow, type AccountDetailRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const yStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const GeneralLedger: React.FC = () => {
    const [desde, setDesde] = useState(yStart());
    const [hasta, setHasta] = useState(today());
    const [rows, setRows] = useState<LedgerRow[]>([]);
    const [loading, setLoading] = useState(true);
    // Auxiliar de una cuenta seleccionada.
    const [detail, setDetail] = useState<{ cuenta: string; rows: AccountDetailRow[] } | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getGeneralLedger(desde, hasta);
            setRows(res.rows);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => { load(); setDetail(null); }, [load]);

    const openDetail = async (cuenta: string) => {
        setDetailLoading(true);
        try {
            const res = await getAccountDetail(cuenta, desde, hasta);
            setDetail({ cuenta, rows: res.rows });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Libro mayor y balances</h2>
                    <p className="acc-sub">Saldo inicial, movimientos y saldo final por cuenta. Clic en una cuenta para ver su auxiliar.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                    <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : rows.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay movimientos en el rango.</p>
            ) : (
                <table className="acc-table" style={{ marginTop: 12 }}>
                    <thead><tr><th>Cuenta</th><th>Nombre</th><th style={{ textAlign: "right" }}>Saldo inicial</th><th style={{ textAlign: "right" }}>Débitos</th><th style={{ textAlign: "right" }}>Créditos</th><th style={{ textAlign: "right" }}>Saldo final</th></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.cuenta} style={{ cursor: "pointer" }} onClick={() => openDetail(r.cuenta)}>
                                <td>{r.cuenta}</td>
                                <td>{r.nombre}</td>
                                <td style={{ textAlign: "right" }}>{money(r.saldo_inicial)}</td>
                                <td style={{ textAlign: "right" }}>{r.debitos ? money(r.debitos) : ""}</td>
                                <td style={{ textAlign: "right" }}>{r.creditos ? money(r.creditos) : ""}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.saldo_final)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}

            {detail && (
                <div className="led-detail-panel">
                    <div className="acc-card-head" style={{ marginTop: 0 }}>
                        <h3 style={{ margin: 0 }}>Auxiliar — cuenta {detail.cuenta}</h3>
                        <button className="btn-secondary" onClick={() => setDetail(null)}><i className="ri-close-line" /> Cerrar</button>
                    </div>
                    {detailLoading ? (
                        <div className="page-loading" style={{ padding: 16 }}>Cargando...</div>
                    ) : detail.rows.length === 0 ? (
                        <p className="acc-sub">Sin movimientos.</p>
                    ) : (
                        <table className="acc-table">
                            <thead><tr><th>Fecha</th><th>Comp.</th><th>Tercero</th><th>Descripción</th><th style={{ textAlign: "right" }}>Débito</th><th style={{ textAlign: "right" }}>Crédito</th></tr></thead>
                            <tbody>
                                {detail.rows.map((m, i) => (
                                    <tr key={i}>
                                        <td>{fdate(m.fecha)}</td>
                                        <td>{m.tipo}-{m.consecutivo}</td>
                                        <td>{m.tercero || "—"}</td>
                                        <td>{m.linea_desc || m.descripcion || ""}</td>
                                        <td style={{ textAlign: "right" }}>{m.debito ? money(m.debito) : ""}</td>
                                        <td style={{ textAlign: "right" }}>{m.credito ? money(m.credito) : ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>
            )}
        </div>
    );
};

export default GeneralLedger;

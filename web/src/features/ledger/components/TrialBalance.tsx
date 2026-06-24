import { useCallback, useEffect, useState } from "react";
import { getTrialBalance, type TrialBalanceRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const yStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const TrialBalance: React.FC = () => {
    const [desde, setDesde] = useState(yStart());
    const [hasta, setHasta] = useState(today());
    const [rows, setRows] = useState<TrialBalanceRow[]>([]);
    const [totals, setTotals] = useState({ d: 0, c: 0, cuadra: true });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getTrialBalance(desde, hasta);
            setRows(res.rows);
            setTotals({ d: res.totalDebitos, c: res.totalCreditos, cuadra: res.cuadra });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => { load(); }, [load]);

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Balance de prueba</h2>
                    <p className="acc-sub">Débitos, créditos y saldo por cuenta en el rango. Base de los estados financieros.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                    <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : rows.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay movimientos contabilizados en el rango.</p>
            ) : (
                <>
                    <div className="purchases-summary" style={{ marginTop: 12 }}>
                        <span>Débitos: <strong>{money(totals.d)}</strong></span>
                        <span style={{ marginLeft: 16 }}>Créditos: <strong>{money(totals.c)}</strong></span>
                        <span style={{ marginLeft: 16, color: totals.cuadra ? "var(--accent-teal)" : "var(--tertiary-color)" }}>{totals.cuadra ? "✓ Cuadra" : "✗ Descuadrado"}</span>
                    </div>
                    <table className="acc-table" style={{ marginTop: 12 }}>
                        <thead><tr><th>Cuenta</th><th>Nombre</th><th style={{ textAlign: "right" }}>Débitos</th><th style={{ textAlign: "right" }}>Créditos</th><th style={{ textAlign: "right" }}>Saldo</th></tr></thead>
                        <tbody>
                            {rows.map((r) => (
                                <tr key={r.cuenta}>
                                    <td>{r.cuenta}</td>
                                    <td>{r.nombre}</td>
                                    <td style={{ textAlign: "right" }}>{r.debitos ? money(r.debitos) : ""}</td>
                                    <td style={{ textAlign: "right" }}>{r.creditos ? money(r.creditos) : ""}</td>
                                    <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.saldo)}</td>
                                </tr>
                            ))}
                        </tbody>
                        <tfoot>
                            <tr style={{ fontWeight: 700 }}>
                                <td colSpan={2}>Totales</td>
                                <td style={{ textAlign: "right" }}>{money(totals.d)}</td>
                                <td style={{ textAlign: "right" }}>{money(totals.c)}</td>
                                <td></td>
                            </tr>
                        </tfoot>
                    </table>
                </>
            )}
        </div>
    );
};

export default TrialBalance;

import { useCallback, useEffect, useState } from "react";
import { getThirdParty, type ThirdPartyRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const yStart = () => `${new Date().getFullYear()}-01-01`;
const today = () => new Date().toISOString().slice(0, 10);

const ThirdPartyLedger: React.FC = () => {
    const [desde, setDesde] = useState(yStart());
    const [hasta, setHasta] = useState(today());
    const [rows, setRows] = useState<ThirdPartyRow[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getThirdParty(desde, hasta);
            setRows(res.rows);
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
                    <h2>Auxiliar por tercero</h2>
                    <p className="acc-sub">Movimientos por tercero y cuenta (saldos a favor / en contra).</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                    <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : rows.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay movimientos con tercero en el rango.</p>
            ) : (
                <table className="acc-table" style={{ marginTop: 12 }}>
                    <thead><tr><th>Tercero</th><th>Cuenta</th><th style={{ textAlign: "right" }}>Débitos</th><th style={{ textAlign: "right" }}>Créditos</th><th style={{ textAlign: "right" }}>Saldo</th></tr></thead>
                    <tbody>
                        {rows.map((r, i) => (
                            <tr key={i}>
                                <td>{r.tercero}</td>
                                <td>{r.cuenta}</td>
                                <td style={{ textAlign: "right" }}>{r.debitos ? money(r.debitos) : ""}</td>
                                <td style={{ textAlign: "right" }}>{r.creditos ? money(r.creditos) : ""}</td>
                                <td style={{ textAlign: "right", fontWeight: 600 }}>{money(r.saldo)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default ThirdPartyLedger;

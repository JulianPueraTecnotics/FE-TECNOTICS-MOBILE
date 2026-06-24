import { useEffect, useState } from "react";
import { getPeriods, setPeriod } from "../ledger.service";
import type { AccountingPeriod } from "../ledger.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const STATUS_CLS: Record<string, string> = { abierto: "status-paid", cerrado: "status-pending", bloqueado: "status-rejected" };
const STATUS_LABEL: Record<string, string> = { abierto: "Abierto", cerrado: "Cerrado", bloqueado: "Bloqueado" };
const thisMonth = () => new Date().toISOString().slice(0, 7);

const Periods: React.FC = () => {
    const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
    const [loading, setLoading] = useState(true);
    const [periodo, setPeriodo] = useState(thisMonth());
    const [busy, setBusy] = useState(false);

    const load = async () => {
        setLoading(true);
        try {
            const res = await getPeriods();
            setPeriods(res.periods);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        load();
    }, []);

    const apply = async (p: string, estado: "abierto" | "cerrado" | "bloqueado") => {
        setBusy(true);
        try {
            await setPeriod(p, estado);
            successToast(`Período ${p} ${STATUS_LABEL[estado].toLowerCase()}`);
            load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Períodos contables</h2>
                    <p className="acc-sub">Abre, cierra o bloquea meses. En un período cerrado/bloqueado no se permiten nuevos asientos.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Período</label><input type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} /></div>
                    <button className="btn-secondary" onClick={() => apply(periodo, "cerrado")} disabled={busy}>Cerrar</button>
                    <button className="btn-primary" onClick={() => apply(periodo, "abierto")} disabled={busy}>Abrir</button>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : periods.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay períodos registrados. Por defecto, los meses sin registro están abiertos.</p>
            ) : (
                <table className="acc-table" style={{ marginTop: 12 }}>
                    <thead><tr><th>Período</th><th>Estado</th><th>Acciones</th></tr></thead>
                    <tbody>
                        {periods.map((p) => (
                            <tr key={p._id}>
                                <td>{p.periodo}</td>
                                <td><span className={`status-badge ${STATUS_CLS[p.estado] ?? ""}`}>{STATUS_LABEL[p.estado]}</span></td>
                                <td>
                                    <div className="led-row-actions">
                                        {p.estado !== "abierto" && <button className="btn-action" onClick={() => apply(p.periodo, "abierto")} disabled={busy}>Abrir</button>}
                                        {p.estado !== "cerrado" && <button className="btn-action" onClick={() => apply(p.periodo, "cerrado")} disabled={busy}>Cerrar</button>}
                                        {p.estado !== "bloqueado" && <button className="btn-action" onClick={() => apply(p.periodo, "bloqueado")} disabled={busy}>Bloquear</button>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default Periods;

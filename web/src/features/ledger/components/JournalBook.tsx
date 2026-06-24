import { Fragment, useCallback, useEffect, useState } from "react";
import { getJournalBook } from "../ledger.service";
import { JOURNAL_TYPE_LABELS, type JournalEntry } from "../ledger.types";
import { errorToast } from "../../../components/shared/toast/toasts";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const today = () => new Date().toISOString().slice(0, 10);

const JournalBook: React.FC = () => {
    const [desde, setDesde] = useState(monthStart());
    const [hasta, setHasta] = useState(today());
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [totals, setTotals] = useState({ d: 0, c: 0 });
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getJournalBook(desde, hasta);
            setEntries(res.entries);
            setTotals({ d: res.totalDebito, c: res.totalCredito });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [desde, hasta]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Libro diario</h2>
                    <p className="acc-sub">Todos los comprobantes contabilizados, en orden cronológico.</p>
                </div>
                <div className="acc-head-actions">
                    <div className="acc-field"><label>Desde</label><input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} /></div>
                    <div className="acc-field"><label>Hasta</label><input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} /></div>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : entries.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay comprobantes contabilizados en el rango.</p>
            ) : (
                <>
                    <div className="purchases-summary" style={{ marginTop: 12 }}>
                        <span>Débitos: <strong>{money(totals.d)}</strong></span>
                        <span style={{ marginLeft: 16 }}>Créditos: <strong>{money(totals.c)}</strong></span>
                        <span style={{ marginLeft: 16, color: totals.d === totals.c ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                            {totals.d === totals.c ? "✓ Cuadra" : "✗ Descuadrado"}
                        </span>
                    </div>
                    <table className="acc-table led-diary" style={{ marginTop: 12 }}>
                        <thead>
                            <tr><th>Fecha</th><th>Comp.</th><th>Cuenta</th><th>Nombre</th><th>Descripción</th><th style={{ textAlign: "right" }}>Débito</th><th style={{ textAlign: "right" }}>Crédito</th></tr>
                        </thead>
                        <tbody>
                            {entries.map((e) => (
                                <Fragment key={e._id}>
                                    <tr className="led-diary__head">
                                        <td>{fdate(e.fecha)}</td>
                                        <td>{e.tipo}-{e.consecutivo}</td>
                                        <td colSpan={3}><strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong> — {e.descripcion}</td>
                                        <td></td><td></td>
                                    </tr>
                                    {(e.lineas ?? []).map((l, i) => (
                                        <tr key={`${e._id}-${i}`} className="led-diary__line">
                                            <td></td><td></td>
                                            <td>{l.cuenta}</td>
                                            <td>{l.cuenta_nombre || "—"}</td>
                                            <td>{l.descripcion || ""}</td>
                                            <td style={{ textAlign: "right" }}>{l.debito ? money(l.debito) : ""}</td>
                                            <td style={{ textAlign: "right" }}>{l.credito ? money(l.credito) : ""}</td>
                                        </tr>
                                    ))}
                                </Fragment>
                            ))}
                        </tbody>
                    </table>
                </>
            )}
        </div>
    );
};

export default JournalBook;

import { useCallback, useEffect, useState } from "react";
import { getEntries, postEntry, annulEntry } from "../ledger.service";
import { JOURNAL_TYPE_LABELS, JOURNAL_STATUS_LABELS, type JournalEntry, type JournalType } from "../ledger.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import EntryEditor from "./EntryEditor";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const fdate = (d: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const STATUS_CLS: Record<string, string> = { borrador: "status-pending", contabilizado: "status-paid", anulado: "status-rejected" };
const TYPE_FILTER: JournalType[] = ["NC", "CC", "CE", "RC", "FV", "DEP"];

const JournalEntries: React.FC = () => {
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [tipo, setTipo] = useState("");
    const [estado, setEstado] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    // editor: null = lista; "" = nuevo; id = editar
    const [editing, setEditing] = useState<string | null | undefined>(undefined);

    useRealtime(RealtimeEvents.JOURNAL_CHANGED, (payload) => setEntries((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getEntries({ tipo, estado, page: 1 });
            setEntries(res.entries);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar comprobantes");
        } finally {
            setLoading(false);
        }
    }, [tipo, estado, refreshKey]);

    useEffect(() => {
        if (editing === undefined) load();
    }, [load, editing]);

    const onPost = async (e: JournalEntry) => {
        setBusyId(e._id);
        try {
            await postEntry(e._id);
            successToast("Comprobante contabilizado");
            setRefreshKey((k) => k + 1);
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const onAnnul = async (e: JournalEntry) => {
        if (!confirm(`¿Anular el comprobante ${e.tipo}-${e.consecutivo}? Si está contabilizado se generará un reverso.`)) return;
        setBusyId(e._id);
        try {
            const res = await annulEntry(e._id);
            successToast(res.message || "Comprobante anulado");
            setRefreshKey((k) => k + 1);
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    // Editor a pantalla completa de la sección.
    if (editing !== undefined) {
        return (
            <EntryEditor
                entryId={editing || null}
                onClose={() => setEditing(undefined)}
                onSaved={() => { setEditing(undefined); setRefreshKey((k) => k + 1); }}
            />
        );
    }

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Comprobantes</h2>
                    <p className="acc-sub">Asientos contables. Crea notas de contabilidad manuales y contabilízalas.</p>
                </div>
                <div className="acc-head-actions">
                    <select value={tipo} onChange={(e) => setTipo(e.target.value)}>
                        <option value="">Todos los tipos</option>
                        {TYPE_FILTER.map((t) => <option key={t} value={t}>{JOURNAL_TYPE_LABELS[t]}</option>)}
                    </select>
                    <select value={estado} onChange={(e) => setEstado(e.target.value)}>
                        <option value="">Todos los estados</option>
                        <option value="borrador">Borrador</option>
                        <option value="contabilizado">Contabilizado</option>
                        <option value="anulado">Anulado</option>
                    </select>
                    <button className="btn-primary" onClick={() => setEditing("")}><i className="ri-add-line" /> Nuevo comprobante</button>
                </div>
            </div>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : entries.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay comprobantes. Crea uno con "Nuevo comprobante".</p>
            ) : (
                <table className="acc-table" style={{ marginTop: 12 }}>
                    <thead>
                        <tr><th>Comprobante</th><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Valor</th><th>Estado</th><th>Acciones</th></tr>
                    </thead>
                    <tbody>
                        {entries.map((e) => {
                            const busy = busyId === e._id;
                            return (
                                <tr key={e._id}>
                                    <td>{e.tipo}-{e.consecutivo}</td>
                                    <td>{JOURNAL_TYPE_LABELS[e.tipo]}</td>
                                    <td>{fdate(e.fecha)}</td>
                                    <td>{e.descripcion || "—"}</td>
                                    <td style={{ fontWeight: 700 }}>{money(e.total_debito)}</td>
                                    <td><span className={`status-badge ${STATUS_CLS[e.estado] ?? ""}`}>{JOURNAL_STATUS_LABELS[e.estado]}</span></td>
                                    <td>
                                        <div className="led-row-actions">
                                            {e.estado === "borrador" && (
                                                <>
                                                    <button className="btn-action" onClick={() => setEditing(e._id)}><i className="ri-edit-line" /> Editar</button>
                                                    <button className="btn-action" onClick={() => onPost(e)} disabled={busy}><i className="ri-checkbox-circle-line" /> Contabilizar</button>
                                                </>
                                            )}
                                            {e.estado !== "anulado" && (
                                                <button className="btn-action" onClick={() => onAnnul(e)} disabled={busy}><i className="ri-close-circle-line" /> Anular</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            )}
        </div>
    );
};

export default JournalEntries;

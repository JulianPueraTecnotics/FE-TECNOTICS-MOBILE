import { useEffect, useMemo, useState } from "react";
import { getEntry } from "../ledger.service";
import { JOURNAL_STATUS_LABELS, JOURNAL_TYPE_LABELS, type JournalEntry } from "../ledger.types";
import { errorToast } from "../../../components/shared/toast/toasts";
import Attachments from "../../../components/shared/Attachments/Attachments";
import { formatAmount, formatDate, formatMoney } from "../ledgerFormat";

interface Props {
    entryId: string;
    onClose: () => void;
}

const STATUS_CLS: Record<string, string> = {
    borrador: "status-pending",
    contabilizado: "status-paid",
    anulado: "status-rejected",
};

const EntryDetail: React.FC<Props> = ({ entryId, onClose }) => {
    const [entry, setEntry] = useState<JournalEntry | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                const res = await getEntry(entryId);
                setEntry(res.entry);
            } catch (e) {
                errorToast(e instanceof Error ? e.message : "No se pudo cargar el comprobante");
            } finally {
                setLoading(false);
            }
        })();
    }, [entryId]);

    const totals = useMemo(() => {
        const lines = entry?.lineas ?? [];
        const d = lines.reduce((acc, l) => acc + (Number(l.debito) || 0), 0);
        const c = lines.reduce((acc, l) => acc + (Number(l.credito) || 0), 0);
        return { d, c };
    }, [entry]);

    if (loading) {
        return (
            <div className="page-loading" style={{ padding: 24 }}>
                Cargando comprobante…
            </div>
        );
    }

    if (!entry) {
        return (
            <div className="led-editor">
                <div className="led-editor__head">
                    <h2>Comprobante no encontrado</h2>
                    <button type="button" className="btn-secondary" onClick={onClose}>
                        <i className="ri-arrow-left-line" aria-hidden /> Volver a comprobantes
                    </button>
                </div>
            </div>
        );
    }

    const origenLabel =
        entry.origen?.tipo && entry.origen?.id
            ? `${entry.origen.tipo} · ${entry.origen.id}`
            : entry.origen?.tipo || "—";

    return (
        <div className="led-editor led-entry-detail">
            <div className="led-editor__head">
                <div className="led-entry-detail__title-wrap">
                    <h2>
                        Comprobante {entry.tipo}-{entry.consecutivo}
                    </h2>
                    <span className={`status-badge ${STATUS_CLS[entry.estado] ?? ""}`}>{JOURNAL_STATUS_LABELS[entry.estado]}</span>
                </div>
                <button type="button" className="btn-secondary" onClick={onClose}>
                    <i className="ri-arrow-left-line" aria-hidden /> Volver a comprobantes
                </button>
            </div>

            <dl className="led-entry-detail__meta">
                <div>
                    <dt>Tipo</dt>
                    <dd>
                        {JOURNAL_TYPE_LABELS[entry.tipo]} ({entry.tipo})
                    </dd>
                </div>
                <div>
                    <dt>Fecha</dt>
                    <dd>{formatDate(entry.fecha)}</dd>
                </div>
                <div>
                    <dt>Período</dt>
                    <dd>{entry.periodo || "—"}</dd>
                </div>
                <div>
                    <dt>Marco</dt>
                    <dd>{entry.marco || "—"}</dd>
                </div>
                <div className="led-entry-detail__meta-wide">
                    <dt>Descripción</dt>
                    <dd>{entry.descripcion || "—"}</dd>
                </div>
                <div>
                    <dt>Origen</dt>
                    <dd>{origenLabel}</dd>
                </div>
                {entry.reversa_de && (
                    <div>
                        <dt>Reversa de</dt>
                        <dd>{entry.reversa_de}</dd>
                    </div>
                )}
            </dl>

            <div className="purchases-table-container ds-table-container">
                <table className="purchases-table ds-table led-grid">
                    <thead>
                        <tr>
                            <th>Cuenta</th>
                            <th>Nombre</th>
                            <th>Tercero</th>
                            <th>Descripción línea</th>
                            <th className="ds-num">Débito</th>
                            <th className="ds-num">Crédito</th>
                        </tr>
                    </thead>
                    <tbody>
                        {(entry.lineas ?? []).length === 0 ? (
                            <tr>
                                <td colSpan={6} className="ds-empty">
                                    Sin líneas registradas
                                </td>
                            </tr>
                        ) : (
                            (entry.lineas ?? []).map((l, i) => (
                                <tr key={`${l.cuenta}-${i}`}>
                                    <td data-label="Cuenta">{l.cuenta}</td>
                                    <td data-label="Nombre">{l.cuenta_nombre || "—"}</td>
                                    <td data-label="Tercero">{l.tercero_nombre || "—"}</td>
                                    <td data-label="Descripción">{l.descripcion || "—"}</td>
                                    <td data-label="Débito" className="ds-num">
                                        {l.debito ? formatAmount(l.debito) : "—"}
                                    </td>
                                    <td data-label="Crédito" className="ds-num">
                                        {l.credito ? formatAmount(l.credito) : "—"}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                    <tfoot>
                        <tr>
                            <td colSpan={4} className="led-entry-detail__totals-label">
                                Totales
                            </td>
                            <td className="led-total ds-num">{formatAmount(totals.d || entry.total_debito)}</td>
                            <td className="led-total ds-num">{formatAmount(totals.c || entry.total_credito)}</td>
                        </tr>
                    </tfoot>
                </table>
            </div>

            <div className="led-entry-detail__summary">
                <span>
                    Valor del comprobante: <strong>{formatMoney(entry.total_debito)}</strong>
                </span>
                {totals.d === totals.c ? (
                    <span className="led-balance ok">
                        <i className="ri-checkbox-circle-line" aria-hidden /> Cuadra
                    </span>
                ) : (
                    <span className="led-balance bad">
                        <i className="ri-error-warning-line" aria-hidden /> Descuadrado
                    </span>
                )}
            </div>

            <div className="led-entry-detail__attachments">
                <Attachments entidad="asiento" entidadId={entryId} titulo="Soportes del comprobante" />
            </div>
        </div>
    );
};

export default EntryDetail;

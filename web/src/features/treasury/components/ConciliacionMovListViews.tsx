import type { MovimientoConc } from "../conciliacion.service";

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const pct = (t?: number) => (t ? `${Math.round(t * 1000) / 10}%` : "");

const nivelConfianza = (c: number): { label: string; color: string; cls: string } => {
    if (c >= 0.85) return { label: "Alta", color: "var(--accent-teal)", cls: "status-paid" };
    if (c >= 0.6) return { label: "Media", color: "#b45309", cls: "status-pending" };
    return { label: "Baja", color: "var(--tertiary-color)", cls: "" };
};

export type ConciliacionMovListViewsProps = {
    movs: MovimientoConc[];
    sel: Set<string>;
    busy: string | null;
    effectiveViewMode: "table" | "list" | "cards";
    onToggle: (id: string) => void;
    onToggleAll: () => void;
    onConfirmar: (conciliacionId: string, asientoId: string) => void;
    onRechazar: (conciliacionId: string, asientoId: string) => void;
    onAbrirManual: (m: MovimientoConc) => void;
};

export function ConciliacionMovListViews({
    movs,
    sel,
    busy,
    effectiveViewMode,
    onToggle,
    onToggleAll,
    onConfirmar,
    onRechazar,
    onAbrirManual,
}: ConciliacionMovListViewsProps) {
    const allSelected = movs.length > 0 && movs.every((m) => sel.has(m.asiento_id));

    const renderCheckbox = (m: MovimientoConc) => (
        <input
            type="checkbox"
            checked={sel.has(m.asiento_id)}
            onChange={() => onToggle(m.asiento_id)}
            aria-label={`Seleccionar ${m.descripcion.slice(0, 40)}`}
        />
    );

    const renderSugerenciaBadge = (s: MovimientoConc["sugerencia"]) => {
        if (!s) return <span className="dian-subtle">Sin sugerencia</span>;
        const conf = nivelConfianza(s.confianza);
        return <span className={`status-badge ${conf.cls}`}>{conf.label}</span>;
    };

    const renderSugerenciaDetail = (s: NonNullable<MovimientoConc["sugerencia"]>) => {
        const conf = nivelConfianza(s.confianza);
        const ret = s.retencion_aplicada;
        const retTotal = ret ? (ret.retefuente || 0) + (ret.reteIVA || 0) + (ret.reteICA || 0) : 0;
        return (
            <div className="cb-mov-sug">
                <div className="cb-mov-sug__line">
                    {s.numeros_factura && s.numeros_factura.length > 0 && (
                        <strong className="cb-mov-sug__factura">{s.numeros_factura.join(", ")}</strong>
                    )}
                    <span>{s.nombre_tercero?.slice(0, 28) || "—"}</span>
                    {retTotal > 0 && (
                        <span className="status-badge cb-mov-sug__ret">
                            ret. {pct(ret?.tarifaRetefuente)} · {money(retTotal)}
                        </span>
                    )}
                    <small style={{ color: conf.color, fontWeight: 600 }}>{conf.label}</small>
                </div>
                <small className="cb-mov-sug__meta">
                    {s.valor_documento != null && <>Factura: {money(s.valor_documento)}</>}
                    {s.fecha_factura && <> · {fdate(s.fecha_factura)}</>}
                    {s.dias_diferencia != null && <> · {s.dias_diferencia}d</>}
                </small>
            </div>
        );
    };

    const renderActions = (m: MovimientoConc, layout: "table" | "list" | "cards" = "table") => {
        const s = m.sugerencia;
        return (
            <div className={`action-buttons ds-row-actions cb-mov-actions cb-mov-actions--${layout}`}>
                {s ? (
                    <>
                        <button
                            type="button"
                            className="btn-action"
                            onClick={() => onConfirmar(s.conciliacion_id, m.asiento_id)}
                            disabled={busy === m.asiento_id}
                            title="Confirmar y contabilizar"
                            style={{ color: "var(--accent-teal)" }}
                        >
                            <i className="ri-check-line" aria-hidden />
                            {layout === "table" ? " Confirmar" : null}
                        </button>
                        <button
                            type="button"
                            className="btn-action"
                            onClick={() => onRechazar(s.conciliacion_id, m.asiento_id)}
                            disabled={busy === m.asiento_id}
                            title="Rechazar y elegir otra"
                        >
                            <i className="ri-close-line" aria-hidden />
                        </button>
                    </>
                ) : (
                    <button type="button" className="btn-action" onClick={() => onAbrirManual(m)} title="Elegir la factura">
                        <i className="ri-links-line" aria-hidden />
                        {layout === "table" ? " Conciliar" : null}
                    </button>
                )}
            </div>
        );
    };

    const renderTable = () => (
        <div className="recaudos-table-container ds-table-container">
            <table className="recaudos-table ds-table">
                <thead>
                    <tr>
                        <th className="recaudos-col-check">
                            <input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Seleccionar todos" />
                        </th>
                        <th>Fecha</th>
                        <th>Descripción</th>
                        <th className="num-col">Valor</th>
                        <th>¿Corresponde a?</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {movs.map((m) => {
                        const s = m.sugerencia;
                        return (
                            <tr key={m.asiento_id} className={sel.has(m.asiento_id) ? "recaudos-row--selected" : ""}>
                                <td data-label="" className="recaudos-col-check">{renderCheckbox(m)}</td>
                                <td data-label="Fecha">{fdate(m.fecha)}</td>
                                <td data-label="Descripción">
                                    {m.descripcion}
                                </td>
                                <td data-label="Valor" className="num-col" style={{ color: m.valor < 0 ? "var(--tertiary-color)" : undefined }}>
                                    <strong>{money(m.valor)}</strong>
                                </td>
                                <td data-label="Sugerencia">{s ? renderSugerenciaDetail(s) : <span className="dian-subtle">— sin sugerencia —</span>}</td>
                                <td data-label="Acciones">{renderActions(m)}</td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="recaudos-list-view">
            {movs.map((m) => {
                const s = m.sugerencia;
                return (
                    <article key={m.asiento_id} className={`recaudos-list-item ${sel.has(m.asiento_id) ? "recaudos-list-item--selected" : ""}`}>
                        <div className="recaudos-list-item__body">
                            <div className="recaudos-list-item__head">
                                <label className="recaudos-list-item__check">{renderCheckbox(m)}</label>
                                {renderSugerenciaBadge(s)}
                            </div>
                            <div className="recaudos-list-item__main">
                                <p className="recaudos-list-item__client">{m.descripcion}</p>
                                <p className="recaudos-list-item__number">{fdate(m.fecha)}</p>
                            </div>
                            <dl className="recaudos-list-item__fields">
                                <div className="recaudos-list-item__field">
                                    <dt>Valor</dt>
                                    <dd className="recaudos-list-item__balance">{money(m.valor)}</dd>
                                </div>
                                <div className="recaudos-list-item__field">
                                    <dt>Factura</dt>
                                    <dd>{s?.numeros_factura?.join(", ") || "—"}</dd>
                                </div>
                                <div className="recaudos-list-item__field">
                                    <dt>Tercero</dt>
                                    <dd>{s?.nombre_tercero?.slice(0, 24) || "—"}</dd>
                                </div>
                            </dl>
                        </div>
                        <footer className="recaudos-list-item__actions">{renderActions(m, "list")}</footer>
                    </article>
                );
            })}
        </div>
    );

    const renderCards = () => (
        <div className="recaudos-cards-view">
            {movs.map((m) => {
                const s = m.sugerencia;
                return (
                    <article key={m.asiento_id} className={`recaudos-card ${sel.has(m.asiento_id) ? "recaudos-card--selected" : ""}`}>
                        <div className="recaudos-card__body">
                            <div className="recaudos-card__header">
                                <label className="recaudos-card__check">{renderCheckbox(m)}</label>
                                {renderSugerenciaBadge(s)}
                            </div>
                            <div className="recaudos-card__main">
                                <strong className="recaudos-card__number">{money(m.valor)}</strong>
                                <p className="recaudos-card__client">{m.descripcion}</p>
                            </div>
                            <dl className="recaudos-card__fields">
                                <div className="recaudos-card__field">
                                    <dt>Fecha</dt>
                                    <dd>{fdate(m.fecha)}</dd>
                                </div>
                                <div className="recaudos-card__field">
                                    <dt>Factura</dt>
                                    <dd>{s?.numeros_factura?.join(", ") || "—"}</dd>
                                </div>
                            </dl>
                        </div>
                        <footer className="recaudos-card__actions">{renderActions(m, "cards")}</footer>
                    </article>
                );
            })}
        </div>
    );

    if (effectiveViewMode === "list") return renderList();
    if (effectiveViewMode === "cards") return renderCards();
    return renderTable();
}

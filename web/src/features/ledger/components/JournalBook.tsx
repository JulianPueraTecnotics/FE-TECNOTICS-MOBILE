import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getJournalBook } from "../ledger.service";
import { JOURNAL_TYPE_LABELS, type JournalEntry } from "../ledger.types";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { formatAmount, formatDate, formatMoney, monthStartIso, todayIso } from "../ledgerFormat";
import { useClientPagination } from "../hooks/useClientPagination";

const JournalBook: React.FC = () => {
    const [desde, setDesde] = useState(monthStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [entries, setEntries] = useState<JournalEntry[]>([]);
    const [totals, setTotals] = useState({ d: 0, c: 0 });
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

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

    const {
        page: safePage,
        pageSize,
        totalItems,
        totalPages,
        paginated,
        start,
        end,
        handlePageChange,
        handlePageSizeChange,
        PAGE_SIZE_OPTIONS,
    } = useClientPagination(entries, [desde, hasta]);

    const summaryBar = useMemo(
        () => (
            <div className="purchases-summary" style={{ marginBottom: 12 }}>
                <span>
                    Débitos: <strong>{formatAmount(totals.d)}</strong>
                </span>
                <span style={{ marginLeft: 16 }}>
                    Créditos: <strong>{formatAmount(totals.c)}</strong>
                </span>
                <span style={{ marginLeft: 16, color: totals.d === totals.c ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                    {totals.d === totals.c ? "✓ Cuadra" : "✗ Descuadrado"}
                </span>
            </div>
        ),
        [totals],
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table led-diary">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Comp.</th>
                        <th>Cuenta</th>
                        <th>Nombre</th>
                        <th>Descripción</th>
                        <th className="ds-num">Débito</th>
                        <th className="ds-num">Crédito</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((e) => (
                        <Fragment key={e._id}>
                            <tr className="led-diary__head">
                                <td>{formatDate(e.fecha)}</td>
                                <td>
                                    {e.tipo}-{e.consecutivo}
                                </td>
                                <td colSpan={3}>
                                    <strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong> — {e.descripcion}
                                </td>
                                <td className="ds-num"></td>
                                <td className="ds-num"></td>
                            </tr>
                            {(e.lineas ?? []).map((l, i) => (
                                <tr key={`${e._id}-${i}`} className="led-diary__line">
                                    <td></td>
                                    <td></td>
                                    <td data-label="Cuenta">{l.cuenta}</td>
                                    <td data-label="Nombre">{l.cuenta_nombre || "—"}</td>
                                    <td data-label="Descripción">{l.descripcion || ""}</td>
                                    <td data-label="Débito" className="ds-num">
                                        {l.debito ? formatAmount(l.debito) : ""}
                                    </td>
                                    <td data-label="Crédito" className="ds-num">
                                        {l.credito ? formatAmount(l.credito) : ""}
                                    </td>
                                </tr>
                            ))}
                        </Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((e) => (
                <article key={e._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">
                                {e.tipo}-{e.consecutivo}
                            </strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(e.total_debito)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong>
                            <span>{formatDate(e.fecha)}</span>
                        </div>
                        {e.descripcion && (
                            <dl className="purchases-list-item__fields">
                                <div className="purchases-list-item__field purchases-list-item__field--full">
                                    <dt>Descripción</dt>
                                    <dd>{e.descripcion}</dd>
                                </div>
                                <div className="purchases-list-item__field">
                                    <dt>Líneas</dt>
                                    <dd>{(e.lineas ?? []).length}</dd>
                                </div>
                            </dl>
                        )}
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((e) => (
                <article key={e._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">
                            {e.tipo}-{e.consecutivo}
                        </strong>
                        <span className="purchases-card__amount-badge">{formatMoney(e.total_debito)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{JOURNAL_TYPE_LABELS[e.tipo]}</strong>
                        <span>· {formatDate(e.fecha)}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Descripción</dt>
                            <dd>{e.descripcion || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Líneas</dt>
                            <dd>{(e.lineas ?? []).length}</dd>
                        </div>
                    </dl>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const showEmpty = !loading && entries.length === 0;

    return (
        <div className="led-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Todos los comprobantes contabilizados, en orden cronológico.
            </p>

            <div className="led-form-grid">
                <FilterField label="Desde" htmlFor="led-jb-desde" icon="ri-calendar-line">
                    <FieldControl id="led-jb-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="led-jb-hasta" icon="ri-calendar-line">
                    <FieldControl id="led-jb-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>

            <div className="led-section__toolbar">
                <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando libro diario…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-book-open-line" />
                    <p>No hay comprobantes contabilizados en el rango.</p>
                </div>
            ) : (
                <>
                    {summaryBar}
                    <PaginationToolbar
                        position="top"
                        page={safePage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        rangeStart={start}
                        rangeEnd={end}
                        isFetching={loading}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                        emptyLabel={totalItems === 0 ? "Sin comprobantes" : undefined}
                    />
                    {renderView()}
                    <PaginationToolbar
                        position="bottom"
                        page={safePage}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        rangeStart={start}
                        rangeEnd={end}
                        onPageChange={handlePageChange}
                        isFetching={loading}
                        emptyLabel={totalItems === 0 ? "Sin comprobantes" : undefined}
                    />
                </>
            )}
        </div>
    );
};

export default JournalBook;

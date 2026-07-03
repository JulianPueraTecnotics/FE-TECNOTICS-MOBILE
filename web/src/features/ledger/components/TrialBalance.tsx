import { useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getTrialBalance, type TrialBalanceRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { formatAmount, formatMoney, todayIso, yearStartIso } from "../ledgerFormat";
import { useClientPagination } from "../hooks/useClientPagination";

const TrialBalance: React.FC = () => {
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [rows, setRows] = useState<TrialBalanceRow[]>([]);
    const [totals, setTotals] = useState({ d: 0, c: 0, cuadra: true });
    const [loading, setLoading] = useState(true);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

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
    } = useClientPagination(rows, [desde, hasta]);

    const summaryBar = useMemo(
        () => (
            <div className="purchases-summary" style={{ marginBottom: 12 }}>
                <span>
                    Débitos: <strong>{formatAmount(totals.d)}</strong>
                </span>
                <span style={{ marginLeft: 16 }}>
                    Créditos: <strong>{formatAmount(totals.c)}</strong>
                </span>
                <span style={{ marginLeft: 16, color: totals.cuadra ? "var(--accent-teal)" : "var(--tertiary-color)" }}>
                    {totals.cuadra ? "✓ Cuadra" : "✗ Descuadrado"}
                </span>
            </div>
        ),
        [totals],
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Cuenta</th>
                        <th>Nombre</th>
                        <th className="ds-num">Débitos</th>
                        <th className="ds-num">Créditos</th>
                        <th className="ds-num">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((r) => (
                        <tr key={r.cuenta}>
                            <td data-label="Cuenta">{r.cuenta}</td>
                            <td data-label="Nombre">{r.nombre}</td>
                            <td data-label="Débitos" className="ds-num">
                                {r.debitos ? formatAmount(r.debitos) : ""}
                            </td>
                            <td data-label="Créditos" className="ds-num">
                                {r.creditos ? formatAmount(r.creditos) : ""}
                            </td>
                            <td data-label="Saldo" className="ds-num">
                                <strong>{formatAmount(r.saldo)}</strong>
                            </td>
                        </tr>
                    ))}
                </tbody>
                <tfoot>
                    <tr style={{ fontWeight: 700 }}>
                        <td colSpan={2}>Totales</td>
                        <td className="ds-num">{formatAmount(totals.d)}</td>
                        <td className="ds-num">{formatAmount(totals.c)}</td>
                        <td className="ds-num"></td>
                    </tr>
                </tfoot>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((r) => (
                <article key={r.cuenta} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">
                                {r.cuenta} · {r.nombre}
                            </strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(r.saldo)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Débitos</dt>
                                <dd>{r.debitos ? formatAmount(r.debitos) : "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Créditos</dt>
                                <dd>{r.creditos ? formatAmount(r.creditos) : "—"}</dd>
                            </div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((r) => (
                <article key={r.cuenta} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{r.cuenta}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(r.saldo)}</span>
                    </div>
                    <div className="purchases-card__sub">{r.nombre}</div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Débitos</dt>
                            <dd>{r.debitos ? formatAmount(r.debitos) : "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Créditos</dt>
                            <dd>{r.creditos ? formatAmount(r.creditos) : "—"}</dd>
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

    const showEmpty = !loading && rows.length === 0;

    return (
        <div className="led-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Débitos, créditos y saldo por cuenta en el rango. Base de los estados financieros.
            </p>

            <div className="led-form-grid">
                <FilterField label="Desde" htmlFor="led-tb-desde" icon="ri-calendar-line">
                    <FieldControl id="led-tb-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="led-tb-hasta" icon="ri-calendar-line">
                    <FieldControl id="led-tb-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>

            <div className="led-section__toolbar">
                <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando balance de prueba…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-scales-3-line" />
                    <p>No hay movimientos contabilizados en el rango.</p>
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
                        emptyLabel={totalItems === 0 ? "Sin cuentas" : undefined}
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
                        emptyLabel={totalItems === 0 ? "Sin cuentas" : undefined}
                    />
                </>
            )}
        </div>
    );
};

export default TrialBalance;

import { useCallback, useEffect, useMemo, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getThirdParty, type ThirdPartyRow } from "../reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    PaginationToolbar,
    FilterField,
    FieldControl,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    useEffectiveViewMode,
    type ViewMode,
} from "../../../components/design-system";
import { formatAmount, formatMoney, todayIso, yearStartIso } from "../ledgerFormat";
import { useClientPagination } from "../hooks/useClientPagination";
import { useLedgerFiltersPanel } from "../hooks/useLedgerFiltersPanel";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "tercero", label: "Tercero", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "cuenta", label: "Cuenta", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "debitos", label: "Débitos", type: "number", icon: "ri-arrow-up-circle-line" },
    { id: "creditos", label: "Créditos", type: "number", icon: "ri-arrow-down-circle-line" },
    { id: "saldo", label: "Saldo", type: "number", icon: "ri-scales-3-line" },
];

const ThirdPartyLedger: React.FC = () => {
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [rows, setRows] = useState<ThirdPartyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSearch, setFilterSearch] = useState("");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

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

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return rows;
        return rows.filter((r) => r.tercero.toLowerCase().includes(q) || r.cuenta.toLowerCase().includes(q));
    }, [rows, debouncedSearch]);
    const getRowFilterValue = useCallback((row: ThirdPartyRow, filterId: string): string => {
        switch (filterId) {
            case "tercero": return row.tercero ?? "";
            case "cuenta": return row.cuenta ?? "";
            case "debitos": return String(row.debitos ?? 0);
            case "creditos": return String(row.creditos ?? 0);
            case "saldo": return String(row.saldo ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedRows = filterRows(filtered);

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
    } = useClientPagination(displayedRows, [desde, hasta, debouncedSearch, colFilterValues.debitos, colFilterValues.creditos, colFilterValues.saldo]);

    const clearFilters = () => {
        setFilterSearch("");
        clearColFilters();
    };

    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    const { filtersToolbar, filtersMobileDrawer } = useLedgerFiltersPanel({
        panelId: "led-terceros",
        title: "Filtrar auxiliar",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterSearch],
        filterContent: (
            <>
            <FilterField label="Búsqueda" htmlFor="led-tp-search" icon="ri-search-line">
                <FieldControl
                    id="led-tp-search"
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Tercero o cuenta"
                />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="led-tp-col" />
            </>
        ),
    });

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Tercero</th>
                        <th>Cuenta</th>
                        <th className="ds-num">Débitos</th>
                        <th className="ds-num">Créditos</th>
                        <th className="ds-num">Saldo</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((r, i) => (
                        <tr key={`${r.tercero}-${r.cuenta}-${i}`}>
                            <td data-label="Tercero">{r.tercero}</td>
                            <td data-label="Cuenta">{r.cuenta}</td>
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
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((r, i) => (
                <article key={`${r.tercero}-${r.cuenta}-${i}`} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{r.tercero}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(r.saldo)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{r.cuenta}</strong>
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
            {paginated.map((r, i) => (
                <article key={`${r.tercero}-${r.cuenta}-${i}`} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{r.tercero}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(r.saldo)}</span>
                    </div>
                    <div className="purchases-card__sub">{r.cuenta}</div>
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
    const showNoResults = !loading && rows.length > 0 && totalItems === 0;

    return (
        <div className="led-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Movimientos por tercero y cuenta (saldos a favor / en contra).
            </p>

            {filtersMobileDrawer}

            <div className="led-form-grid">
                <FilterField label="Desde" htmlFor="led-tp-desde" icon="ri-calendar-line">
                    <FieldControl id="led-tp-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="led-tp-hasta" icon="ri-calendar-line">
                    <FieldControl id="led-tp-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>

            <div className="led-section__toolbar">
                <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando auxiliar por tercero…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-group-line" />
                    <p>No hay movimientos con tercero en el rango.</p>
                </div>
            ) : (
                <>
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
                        beforeViewToggle={filtersToolbar}
                        emptyLabel={totalItems === 0 ? "Sin movimientos" : undefined}
                    />
                    {showNoResults ? (
                        <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                            No hay movimientos que coincidan con la búsqueda
                        </div>
                    ) : (
                        <>
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
                                emptyLabel={totalItems === 0 ? "Sin movimientos" : undefined}
                            />
                        </>
                    )}
                </>
            )}
        </div>
    );
};

export default ThirdPartyLedger;

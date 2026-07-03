import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getWarehouses, getStock } from "../inventory.service";
import type { Warehouse, StockRow } from "../inventory.types";
import { errorToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import { formatMoney, formatQty, normalizePageSize, PAGE_SIZE_OPTIONS } from "../inventoryFormat";
import { useInventoryFiltersPanel } from "../hooks/useInventoryFiltersPanel";

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "codigo", label: "Código", type: "text", icon: "ri-hashtag" },
    { id: "item", label: "Ítem", type: "text", icon: "ri-box-3-line", serverSide: true },
    { id: "bodega", label: "Bodega", type: "text", icon: "ri-building-line", serverSide: true },
    { id: "cantidad", label: "Cantidad", type: "number", icon: "ri-stack-line" },
    { id: "costo_promedio", label: "Costo promedio", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "costo_total", label: "Costo total", type: "number", icon: "ri-scales-3-line" },
];

const Existencias: React.FC = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [warehouseId, setWarehouseId] = useState("");
    const [rows, setRows] = useState<StockRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterSearch, setFilterSearch] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: StockRow, filterId: string): string => {
        switch (filterId) {
            case "codigo": return row.item_code ?? "";
            case "item": return row.item_nombre ?? "";
            case "bodega": return row.warehouse_nombre ?? "";
            case "cantidad": return String(row.cantidad ?? 0);
            case "costo_promedio": return String(row.costo_promedio ?? 0);
            case "costo_total": return String(row.costo_total ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = warehouseId !== "" || filterSearch.trim() !== "" || hasActiveClientFilters;

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setRows(await getStock(warehouseId || undefined));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [warehouseId]);

    useEffect(() => {
        load();
    }, [load]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        const base = !q
            ? rows
            : rows.filter(
                (r) =>
                    r.item_nombre.toLowerCase().includes(q) ||
                    (r.item_code || "").toLowerCase().includes(q) ||
                    r.warehouse_nombre.toLowerCase().includes(q),
            );
        return filterRows(base);
    }, [rows, debouncedSearch, filterRows]);

    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return filtered.slice(start, start + pageSize);
    }, [filtered, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        setPage(1);
    }, [debouncedSearch, warehouseId, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handlePageChange = (next: number) => setPage(Math.max(1, Math.min(totalPages, next)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };
    const clearFilters = () => {
        setFilterSearch("");
        setWarehouseId("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useInventoryFiltersPanel({
        panelId: "inv-existencias",
        title: "Filtrar existencias",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [filterSearch, warehouseId, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="inv-ex-search" icon="ri-search-line">
                    <FieldControl
                        id="inv-ex-search"
                        type="text"
                        value={filterSearch}
                        onChange={(e) => setFilterSearch(e.target.value)}
                        placeholder="Ítem, código o bodega"
                    />
                </FilterField>
                <FilterField label="Bodega" htmlFor="inv-ex-warehouse" icon="ri-building-line">
                    <FieldControl
                        id="inv-ex-warehouse"
                        as="select"
                        value={warehouseId}
                        onChange={(e) => setWarehouseId(e.target.value)}
                    >
                        <option value="">Todas las bodegas</option>
                        {warehouses.map((w) => (
                            <option key={w._id} value={w._id}>
                                {w.codigo} · {w.nombre}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Ítem</th>
                        <th>Bodega</th>
                        <th className="ds-num">Cantidad</th>
                        <th className="ds-num">Costo promedio</th>
                        <th className="ds-num">Costo total</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((r) => (
                        <tr key={`${r.item_id}-${r.warehouse_id}`} className={r.bajo_minimo ? "inv-row--alert" : ""}>
                            <td data-label="Código">{r.item_code || "—"}</td>
                            <td data-label="Ítem">
                                {r.item_nombre}
                                {r.bajo_minimo && <span className="acc-tag">Bajo mínimo</span>}
                            </td>
                            <td data-label="Bodega">{r.warehouse_nombre}</td>
                            <td data-label="Cantidad" className="ds-num">
                                <strong>{formatQty(r.cantidad)}</strong>
                            </td>
                            <td data-label="Costo promedio" className="ds-num">
                                {formatMoney(r.costo_promedio)}
                            </td>
                            <td data-label="Costo total" className="ds-num">
                                {formatMoney(r.costo_total)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((r) => (
                <article key={`${r.item_id}-${r.warehouse_id}`} className={`purchases-list-item ${r.bajo_minimo ? "inv-row--alert" : ""}`}>
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{r.item_nombre}</strong>
                            <span className="purchases-list-item__amount-badge">{formatMoney(r.costo_total)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{r.item_code || "—"}</strong>
                            <span>{r.warehouse_nombre}</span>
                            {r.bajo_minimo && <span className="acc-tag">Bajo mínimo</span>}
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Cantidad</dt>
                                <dd>{formatQty(r.cantidad)}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Costo promedio</dt>
                                <dd>{formatMoney(r.costo_promedio)}</dd>
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
                <article key={`${r.item_id}-${r.warehouse_id}`} className={`purchases-card ${r.bajo_minimo ? "inv-row--alert" : ""}`}>
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{r.item_nombre}</strong>
                        <span className="purchases-card__amount-badge">{formatMoney(r.costo_total)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{r.item_code || "—"}</strong>
                        <span>· {r.warehouse_nombre}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Cantidad</dt>
                            <dd>{formatQty(r.cantidad)}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Costo promedio</dt>
                            <dd>{formatMoney(r.costo_promedio)}</dd>
                        </div>
                        {r.bajo_minimo && (
                            <div className="purchases-card__field purchases-card__field--full">
                                <dt>Alerta</dt>
                                <dd>
                                    <span className="acc-tag">Bajo mínimo</span>
                                </dd>
                            </div>
                        )}
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
        <div className="inv-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Cantidades y costo promedio por ítem y bodega. Las filas bajo el stock mínimo se resaltan.
            </p>

            {filtersMobileDrawer}

            <div className="inv-section__toolbar">
                <button type="button" className="btn-secondary" onClick={load} disabled={loading}>
                    <i className="ri-refresh-line" aria-hidden /> Refrescar
                </button>
            </div>

            {!showEmpty && (
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
                    emptyLabel={totalItems === 0 ? "Sin existencias" : undefined}
                />
            )}

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando existencias…
                </div>
            ) : showEmpty ? (
                <div className="purchases-empty">
                    <i className="ri-stack-line" />
                    <p>No hay existencias para mostrar.</p>
                </div>
            ) : showNoResults ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    No hay existencias que coincidan con los filtros
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
                        emptyLabel={totalItems === 0 ? "Sin existencias" : undefined}
                    />
                </>
            )}
        </div>
    );
};

export default Existencias;

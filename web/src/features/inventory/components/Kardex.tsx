import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import { getWarehouses, getKardex } from "../inventory.service";
import type { Warehouse, KardexMov, KardexTipo } from "../inventory.types";
import type { ItemData } from "../../../types";
import ItemPicker from "./ItemPicker";
import { errorToast } from "../../../components/shared/toast/toasts";
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
import { formatDate, formatMoney, formatQty, normalizePageSize, PAGE_SIZE_OPTIONS, todayIso, yearStartIso } from "../inventoryFormat";
import { useInventoryFiltersPanel } from "../hooks/useInventoryFiltersPanel";

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "tipo", label: "Tipo", type: "text", icon: "ri-exchange-line" },
    { id: "bodega", label: "Bodega", type: "text", icon: "ri-building-line" },
    { id: "descripcion", label: "Descripción", type: "text", icon: "ri-file-text-line" },
    { id: "cantidad", label: "Cantidad", type: "number", icon: "ri-stack-line" },
    { id: "costo_unitario", label: "Costo unit.", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "saldo_cantidad", label: "Saldo cant.", type: "number", icon: "ri-scales-3-line" },
    { id: "saldo_costo", label: "Costo prom.", type: "number", icon: "ri-percent-line" },
];

const TIPO_LABELS: Record<KardexTipo, string> = {
    saldo_inicial: "Saldo inicial",
    entrada: "Entrada",
    salida: "Salida",
    ajuste_pos: "Ajuste (+)",
    ajuste_neg: "Ajuste (−)",
    traslado_in: "Traslado entrada",
    traslado_out: "Traslado salida",
};

const Kardex: React.FC = () => {
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [warehouseId, setWarehouseId] = useState("");
    const [item, setItem] = useState<ItemData | null>(null);
    const [desde, setDesde] = useState(yearStartIso());
    const [hasta, setHasta] = useState(todayIso());
    const [movs, setMovs] = useState<KardexMov[]>([]);
    const [loading, setLoading] = useState(false);
    const [loaded, setLoaded] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    const getRowFilterValue = useCallback((row: KardexMov, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha);
            case "tipo": return TIPO_LABELS[row.tipo] ?? row.tipo;
            case "bodega": return row.warehouse_id ? `${row.warehouse_id.codigo} ${row.warehouse_id.nombre}` : "";
            case "descripcion": return row.descripcion ?? "";
            case "cantidad": return String(row.cantidad ?? 0);
            case "costo_unitario": return String(row.costo_unitario ?? 0);
            case "saldo_cantidad": return String(row.saldo_cantidad ?? 0);
            case "saldo_costo": return String(row.saldo_costo_promedio ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedMovs = useMemo(() => filterRows(movs), [movs, filterRows]);

    useEffect(() => {
        getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
    }, []);

    const load = useCallback(async () => {
        if (!item?._id) return;
        setLoading(true);
        try {
            const res = await getKardex(item._id, { warehouse_id: warehouseId || undefined, desde, hasta });
            setMovs(res);
            setLoaded(true);
            setPage(1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    }, [item, warehouseId, desde, hasta]);

    const totalItems = displayedMovs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedMovs.slice(start, start + pageSize);
    }, [displayedMovs, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMountPageSize = useRef(false);
    useEffect(() => {
        if (!didMountPageSize.current) {
            didMountPageSize.current = true;
            return;
        }
        setPage(1);
    }, [pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handlePageChange = (next: number) => setPage(Math.max(1, Math.min(totalPages, next)));
    const handlePageSizeChange = (next: number) => {
        setPageSize(normalizePageSize(next));
        setPage(1);
    };

    const warehouseLabel = (m: KardexMov) =>
        m.warehouse_id ? `${m.warehouse_id.codigo} · ${m.warehouse_id.nombre}` : "—";

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Bodega</th>
                        <th>Descripción</th>
                        <th className="ds-num">Cantidad</th>
                        <th className="ds-num">Costo unit.</th>
                        <th className="ds-num">Saldo cant.</th>
                        <th className="ds-num">Costo prom.</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((m) => (
                        <tr key={m._id}>
                            <td data-label="Fecha">{formatDate(m.fecha)}</td>
                            <td data-label="Tipo">{TIPO_LABELS[m.tipo] ?? m.tipo}</td>
                            <td data-label="Bodega">{warehouseLabel(m)}</td>
                            <td data-label="Descripción">{m.descripcion || "—"}</td>
                            <td data-label="Cantidad" className="ds-num">
                                {formatQty(m.cantidad)}
                            </td>
                            <td data-label="Costo unit." className="ds-num">
                                {formatMoney(m.costo_unitario)}
                            </td>
                            <td data-label="Saldo cant." className="ds-num">
                                <strong>{formatQty(m.saldo_cantidad)}</strong>
                            </td>
                            <td data-label="Costo prom." className="ds-num">
                                {formatMoney(m.saldo_costo_promedio)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginated.map((m) => (
                <article key={m._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{TIPO_LABELS[m.tipo] ?? m.tipo}</strong>
                            <span className="purchases-list-item__amount-badge">{formatQty(m.saldo_cantidad)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{formatDate(m.fecha)}</strong>
                            <span>{warehouseLabel(m)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Descripción</dt>
                                <dd>{m.descripcion || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Cantidad / Costo unit.</dt>
                                <dd>
                                    {formatQty(m.cantidad)} · {formatMoney(m.costo_unitario)}
                                </dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Costo promedio</dt>
                                <dd>{formatMoney(m.saldo_costo_promedio)}</dd>
                            </div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((m) => (
                <article key={m._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{TIPO_LABELS[m.tipo] ?? m.tipo}</strong>
                        <span className="purchases-card__amount-badge">{formatQty(m.saldo_cantidad)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{formatDate(m.fecha)}</strong>
                        <span>· {warehouseLabel(m)}</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field purchases-card__field--full">
                            <dt>Descripción</dt>
                            <dd>{m.descripcion || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Cantidad</dt>
                            <dd>{formatQty(m.cantidad)}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Costo prom.</dt>
                            <dd>{formatMoney(m.saldo_costo_promedio)}</dd>
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

    const showResults = loaded && displayedMovs.length > 0;
    const showEmptyResults = loaded && !loading && displayedMovs.length === 0;

    const { filtersToolbar, filtersMobileDrawer } = useInventoryFiltersPanel({
        panelId: "inv-kardex",
        title: "Filtrar kardex",
        hasActiveFilters: hasActiveClientFilters,
        onClear: clearColFilters,
        repositionDeps: [colFilterValues],
        filterContent: (
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
        ),
    });

    return (
        <div className="inv-section">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Movimientos de un ítem con saldo corrido (cantidad y costo promedio).
            </p>

            <div className="inv-form-grid">
                <FilterField label="Producto *" htmlFor="kardex-item" icon="ri-box-3-line">
                    <ItemPicker id="kardex-item" value={item} onChange={setItem} />
                </FilterField>
                <FilterField label="Bodega" htmlFor="kardex-warehouse" icon="ri-building-line">
                    <FieldControl
                        id="kardex-warehouse"
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
                <FilterField label="Desde" htmlFor="kardex-desde" icon="ri-calendar-line">
                    <FieldControl id="kardex-desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </FilterField>
                <FilterField label="Hasta" htmlFor="kardex-hasta" icon="ri-calendar-line">
                    <FieldControl id="kardex-hasta" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} />
                </FilterField>
            </div>

            <div className="inv-form-actions">
                <button type="button" className="btn-primary" onClick={load} disabled={!item || loading}>
                    {loading ? (
                        <>
                            <i className="ri-loader-4-line rotating" aria-hidden /> Cargando…
                        </>
                    ) : (
                        <>
                            <i className="ri-search-line" aria-hidden /> Consultar
                        </>
                    )}
                </button>
            </div>

            {!item ? (
                <div className="purchases-empty" style={{ marginTop: 24 }}>
                    <i className="ri-file-list-3-line" />
                    <p>Selecciona un producto para ver su kardex.</p>
                </div>
            ) : loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                    Cargando movimientos…
                </div>
            ) : showEmptyResults ? (
                <div className="purchases-empty" style={{ marginTop: 24 }}>
                    <i className="ri-file-list-3-line" />
                    <p>No hay movimientos en el rango seleccionado.</p>
                </div>
            ) : showResults ? (
                <>
                    {filtersMobileDrawer}
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
            ) : null}
        </div>
    );
};

export default Kardex;

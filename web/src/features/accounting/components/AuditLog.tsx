import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { getAudit, type AuditEntry, type AuditFilters } from "../../../services/logger.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    FilterField,
    FieldControl,
    PaginationToolbar,
    paginationRange,
    FiltersMobileDrawer,
    useEffectiveViewMode,
    useIsMobile,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import "../../clients/page/Clients.css";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const fdt = (d: string) => (d ? new Date(d).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" }) : "—");

const ACCION_LABEL: Record<AuditEntry["accion"], string> = {
    create: "Creó", update: "Editó", delete: "Eliminó", post: "Contabilizó", annul: "Anuló", send: "Envió",
};
const ACCION_CLS: Record<AuditEntry["accion"], string> = {
    create: "status-paid", update: "status-pending", delete: "status-rejected", post: "status-paid", annul: "status-rejected", send: "status-pending",
};
const ENTIDAD_LABEL: Record<AuditEntry["entidad"], string> = {
    factura: "Factura", compra: "Compra", asiento: "Comprobante", nomina: "Nómina", tercero: "Tercero", pago: "Pago", otro: "Otro",
};

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "usuario", label: "Usuario", type: "text", icon: "ri-user-line", serverSide: true },
    { id: "accion", label: "Acción", type: "text", icon: "ri-filter-3-line", serverSide: true },
    { id: "documento", label: "Documento", type: "text", icon: "ri-folder-3-line", serverSide: true },
    { id: "referencia", label: "Referencia", type: "text", icon: "ri-link" },
    { id: "rol", label: "Rol", type: "text", icon: "ri-shield-user-line" },
];

const AuditLog: React.FC = () => {
    const [items, setItems] = useState<AuditEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [filters, setFilters] = useState<AuditFilters>({});
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const isMobile = useIsMobile();
    const [filtersOpen, setFiltersOpen] = useState(false);
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const getRowFilterValue = useCallback((row: AuditEntry, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(row.fecha);
            case "usuario": return row.usuario ?? "";
            case "accion": return ACCION_LABEL[row.accion] ?? row.accion;
            case "documento": return ENTIDAD_LABEL[row.entidad] ?? row.entidad;
            case "referencia": return row.referencia || row.descripcion || row.entidad_id || "";
            case "rol": return row.rol ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedItems = useMemo(() => filterRows(items), [items, filterRows]);

    const hasActiveFilters = !!(filters.entidad || filters.accion || filters.usuario || filters.desde || filters.hasta || hasActiveClientFilters);

    const load = useCallback(async () => {
        const hasData = items.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        try {
            const res = await getAudit({ ...filters, page, limit: pageSize });
            setItems(res.items);
            setTotalPages(res.pagination.totalPages);
            setTotalItems(res.pagination.total);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar la auditoría");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [filters, page, pageSize]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const setFilter = (k: keyof AuditFilters, v: string) => {
        setPage(1);
        setFilters((f) => ({ ...f, [k]: v || undefined }));
    };

    const clearFilters = () => {
        setPage(1);
        setFilters({});
        clearColFilters();
    };

    const handlePageChange = (nextPage: number) => {
        setPage(Math.max(1, Math.min(totalPages, nextPage)));
    };

    const handlePageSizeChange = (nextSize: number) => {
        setPageSize(nextSize);
        setPage(1);
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(520, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;
        setFiltersPanelStyle({ position: "fixed", top: Math.max(8, top), left, width });
    }, []);

    useLayoutEffect(() => {
        if (!filtersOpen || isMobile) return;
        updateFiltersPanelPosition();
        const frame = requestAnimationFrame(updateFiltersPanelPosition);
        return () => cancelAnimationFrame(frame);
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filters, colFilterValues]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        document.addEventListener("mousedown", onPointer);
        return () => document.removeEventListener("mousedown", onPointer);
    }, [filtersOpen, isMobile]);

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const filterFields = (
        <>
            <FilterField label="Entidad" htmlFor="audit-entidad" icon="ri-folder-3-line">
                <FieldControl id="audit-entidad" as="select" value={filters.entidad ?? ""} onChange={(e) => setFilter("entidad", e.target.value)}>
                    <option value="">Todas las entidades</option>
                    <option value="tercero">Terceros</option>
                    <option value="asiento">Comprobantes</option>
                    <option value="factura">Facturas</option>
                    <option value="compra">Compras</option>
                    <option value="nomina">Nómina</option>
                </FieldControl>
            </FilterField>
            <FilterField label="Acción" htmlFor="audit-accion" icon="ri-filter-3-line">
                <FieldControl id="audit-accion" as="select" value={filters.accion ?? ""} onChange={(e) => setFilter("accion", e.target.value)}>
                    <option value="">Todas las acciones</option>
                    <option value="create">Creó</option>
                    <option value="update">Editó</option>
                    <option value="delete">Eliminó</option>
                    <option value="post">Contabilizó</option>
                    <option value="annul">Anuló</option>
                </FieldControl>
            </FilterField>
            <FilterField label="Usuario" htmlFor="audit-usuario" icon="ri-user-line">
                <FieldControl id="audit-usuario" type="text" placeholder="Usuario..." value={filters.usuario ?? ""} onChange={(e) => setFilter("usuario", e.target.value)} />
            </FilterField>
            <FilterField label="Desde" htmlFor="audit-desde" icon="ri-calendar-line">
                <FieldControl id="audit-desde" type="date" value={filters.desde ?? ""} onChange={(e) => setFilter("desde", e.target.value)} />
            </FilterField>
            <FilterField label="Hasta" htmlFor="audit-hasta" icon="ri-calendar-line">
                <FieldControl id="audit-hasta" type="date" value={filters.hasta ?? ""} onChange={(e) => setFilter("hasta", e.target.value)} />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
        </>
    );

    const renderTable = () => (
        <div className="clients-table-container ds-table-container">
            <table className="clients-table ds-table">
                <thead>
                    <tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Documento</th><th>Referencia</th></tr>
                </thead>
                <tbody>
                    {displayedItems.map((it) => (
                        <tr key={it._id}>
                            <td data-label="Fecha">{fdt(it.fecha)}</td>
                            <td data-label="Usuario">{it.usuario || "—"}{it.rol ? <span style={{ fontSize: "0.8em", color: "var(--text-muted)" }}> ({it.rol})</span> : null}</td>
                            <td data-label="Acción"><span className={`status-badge ${ACCION_CLS[it.accion] ?? ""}`}>{ACCION_LABEL[it.accion] ?? it.accion}</span></td>
                            <td data-label="Documento">{ENTIDAD_LABEL[it.entidad] ?? it.entidad}</td>
                            <td data-label="Referencia">{it.referencia || it.descripcion || it.entidad_id || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="clients-list-view">
            {displayedItems.map((it) => (
                <article key={it._id} className="clients-list-item">
                    <div className="clients-list-item__body">
                        <div className="clients-list-item__head">
                            <strong className="clients-list-item__name">{ENTIDAD_LABEL[it.entidad] ?? it.entidad}</strong>
                            <span className={`status-badge ${ACCION_CLS[it.accion] ?? ""}`}>{ACCION_LABEL[it.accion] ?? it.accion}</span>
                        </div>
                        <dl className="clients-list-item__fields">
                            <div className="clients-list-item__field"><dt>Fecha</dt><dd>{fdt(it.fecha)}</dd></div>
                            <div className="clients-list-item__field"><dt>Usuario</dt><dd>{it.usuario || "—"}</dd></div>
                            <div className="clients-list-item__field"><dt>Referencia</dt><dd>{it.referencia || it.descripcion || it.entidad_id || "—"}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="clients-cards-view">
            {displayedItems.map((it) => (
                <article key={it._id} className="clients-card">
                    <div className="clients-card__body">
                        <div className="clients-card__header">
                            <strong className="clients-card__name">{ENTIDAD_LABEL[it.entidad] ?? it.entidad}</strong>
                            <span className={`status-badge ${ACCION_CLS[it.accion] ?? ""}`}>{ACCION_LABEL[it.accion] ?? it.accion}</span>
                        </div>
                        <dl className="clients-card__fields">
                            <div className="clients-card__field"><dt>Fecha</dt><dd>{fdt(it.fecha)}</dd></div>
                            <div className="clients-card__field"><dt>Usuario</dt><dd>{it.usuario || "—"}</dd></div>
                            <div className="clients-card__field"><dt>Referencia</dt><dd>{it.referencia || it.descripcion || "—"}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const filtersToolbar = (
        <div className="clients-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="clients-filters-clear clients-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden /> Limpiar
                </button>
            )}
            <div className="clients-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`clients-filters-toggle ${filtersOpen ? "open" : ""} ${hasActiveFilters ? "has-filters" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                >
                    <i className="ri-filter-3-line" aria-hidden /> Filtros
                </button>
                {!isMobile && filtersOpen && (
                    <div ref={filtersPanelRef} className="clients-filters-panel" style={filtersPanelStyle} role="dialog" aria-labelledby="audit-filters-heading">
                        <div className="clients-filters-panel__head">
                            <h2 id="audit-filters-heading" className="clients-filters-panel__title">Filtrar auditoría</h2>
                            {hasActiveFilters && (
                                <button type="button" className="clients-filters-clear" onClick={clearFilters}>Limpiar</button>
                            )}
                        </div>
                        <div className="clients-filters-grid">{filterFields}</div>
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <div className="acc-card">
            <div className="acc-card-head">
                <div>
                    <h2>Pista de auditoría</h2>
                    <p className="acc-sub">Quién hizo qué y cuándo en los documentos clave (terceros, comprobantes contables y más).</p>
                </div>
                {filtersToolbar}
            </div>

            <FiltersMobileDrawer
                open={isMobile && filtersOpen}
                onClose={() => setFiltersOpen(false)}
                title="Filtrar auditoría"
                hasActiveFilters={hasActiveFilters}
                onClear={clearFilters}
            >
                {filterFields}
            </FiltersMobileDrawer>

            {loading ? (
                <div className="page-loading" style={{ padding: 24 }}>Cargando...</div>
            ) : items.length === 0 ? (
                <p className="acc-sub" style={{ marginTop: 16 }}>No hay registros de auditoría con esos filtros.</p>
            ) : (
                <>
                    <PaginationToolbar
                        position="top"
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        rangeStart={start}
                        rangeEnd={end}
                        isFetching={isPageFetching}
                        onPageChange={handlePageChange}
                        onPageSizeChange={handlePageSizeChange}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                    />
                    {renderView()}
                    <PaginationToolbar
                        position="bottom"
                        page={page}
                        totalPages={totalPages}
                        totalItems={totalItems}
                        pageSize={pageSize}
                        rangeStart={start}
                        rangeEnd={end}
                        isFetching={isPageFetching}
                        onPageChange={handlePageChange}
                    />
                </>
            )}
        </div>
    );
};

export default AuditLog;

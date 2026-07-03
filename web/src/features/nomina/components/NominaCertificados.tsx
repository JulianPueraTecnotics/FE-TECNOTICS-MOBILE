import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import { getEmpleadosConNomina, downloadForm220, type EmpleadoConNomina } from "../../../services/nomina.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    PaginationToolbar,
    paginationRange,
    FilterField,
    FiltersMobileDrawer,
    FieldControl,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const thisYear = new Date().getFullYear();

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "empleado", label: "Empleado", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "documento", label: "Documento", type: "text", icon: "ri-id-card-line", serverSide: true },
];

/** Tab de certificados de nómina: Formulario 220 (ingresos y retenciones) por empleado/año. */
const NominaCertificados: React.FC = () => {
    const [anio, setAnio] = useState(thisYear);
    const [empleados, setEmpleados] = useState<EmpleadoConNomina[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState<string | null>(null);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filterSearch, setFilterSearch] = useState("");
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});
    const getRowFilterValue = useCallback((row: EmpleadoConNomina, filterId: string): string => {
        switch (filterId) {
            case "empleado": return row.nombre ?? "";
            case "documento": return `${row.tipo_documento ?? ""} ${row.numero_documento ?? ""}`.trim();
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || anio !== thisYear || hasActiveClientFilters;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getEmpleadosConNomina(anio);
            setEmpleados(res.empleados);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar empleados");
        } finally {
            setLoading(false);
        }
    }, [anio]);

    useEffect(() => { load(); }, [load]);

    const filtered = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return empleados;
        return empleados.filter((e) =>
            e.nombre.toLowerCase().includes(q) || e.numero_documento.includes(q),
        );
    }, [empleados, debouncedSearch]);

    const displayedEmpleados = filterRows(filtered);
    const totalItems = displayedEmpleados.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginated = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedEmpleados.slice(start, start + pageSize);
    }, [displayedEmpleados, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) { didMountFilters.current = true; return; }
        setPage(1);
    }, [debouncedSearch, pageSize, anio]);

    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);

    const handlePageChange = (next: number) => setPage(Math.max(1, Math.min(totalPages, next)));
    const handlePageSizeChange = (next: number) => { setPageSize(normalizePageSize(next)); setPage(1); };
    const clearFilters = () => {
        setFilterSearch("");
        setAnio(thisYear);
        clearColFilters();
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(480, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;
        setFiltersPanelStyle({ position: "fixed", top: Math.max(8, top), left, width });
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    useLayoutEffect(() => {
        if (!filtersOpen || isMobile) return;
        updateFiltersPanelPosition();
        const frame = requestAnimationFrame(updateFiltersPanelPosition);
        return () => cancelAnimationFrame(frame);
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, anio]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onReflow = () => updateFiltersPanelPosition();
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => { window.removeEventListener("resize", onReflow); window.removeEventListener("scroll", onReflow, true); };
    }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setFiltersOpen(false); };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => { document.removeEventListener("mousedown", onPointer); document.removeEventListener("keydown", onKey); };
    }, [filtersOpen, isMobile]);

    useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

    const onDownload = async (emp: EmpleadoConNomina) => {
        setBusy(emp._id);
        try {
            await downloadForm220(anio, emp._id, emp.nombre);
            successToast("Certificado generado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar el certificado");
        } finally {
            setBusy(null);
        }
    };

    const renderDownloadBtn = (e: EmpleadoConNomina, layout: "table" | "list" | "cards" = "table") => (
        <button type="button" className="btn-action" onClick={() => onDownload(e)} disabled={busy === e._id} title="Descargar Formulario 220 PDF">
            <i className="ri-file-pdf-line" aria-hidden />
            {layout === "table" ? (busy === e._id ? " Generando…" : " Formulario 220") : null}
        </button>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Empleado</th>
                        <th>Documento</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginated.map((e) => (
                        <tr key={e._id}>
                            <td data-label="Empleado"><strong>{e.nombre}</strong></td>
                            <td data-label="Documento">{e.tipo_documento} {e.numero_documento}</td>
                            <td data-label="Acciones">
                                <div className="action-buttons ds-row-actions">{renderDownloadBtn(e)}</div>
                            </td>
                        </tr>
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
                            <strong className="purchases-list-item__title">{e.nombre}</strong>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{e.tipo_documento} {e.numero_documento}</strong>
                            <span>Año {anio}</span>
                        </div>
                    </div>
                    <footer className="purchases-list-item__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--list">{renderDownloadBtn(e, "list")}</div>
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginated.map((e) => (
                <article key={e._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{e.nombre}</strong>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{e.tipo_documento} {e.numero_documento}</strong>
                        <span>· Año {anio}</span>
                    </div>
                    <footer className="purchases-card__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--cards">{renderDownloadBtn(e, "cards")}</div>
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="cert-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="cert-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(ev) => setFilterSearch(ev.target.value)}
                                            placeholder="Empleado o documento"
                                        />
                                    </FilterField>
                                    <FilterField label="Año gravable" htmlFor="cert-filter-anio" icon="ri-calendar-line">
                                        <FieldControl
                                            id="cert-filter-anio"
                                            type="number"
                                            value={String(anio)}
                                            onChange={(ev) => setAnio(Number(ev.target.value) || thisYear)}
                                            min={2000}
                                            max={2100}
                                        />
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="cert-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="cert-filters-heading" className="purchases-filters-panel__title">Filtrar certificados</h2>
                {hasActiveFilters && (
                    <button type="button" className="purchases-filters-clear" onClick={clearFilters}>Limpiar</button>
                )}
            </div>
            <div className="purchases-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="purchases-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="purchases-filters-clear purchases-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="purchases-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="cert-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div ref={filtersPanelRef} id="cert-filters-panel" className="purchases-filters-panel purchases-filters-panel--floating" style={filtersPanelStyle} role="region" aria-labelledby="cert-filters-heading">
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    const showEmpty = !loading && empleados.length === 0;
    const showNoResults = !loading && empleados.length > 0 && totalItems === 0;

    return (
        <div className="nomina-cert">
            <p className="pm-hint" style={{ marginBottom: 12 }}>
                Consolida los pagos laborales y la retención en la fuente del año por empleado (PDF Formulario 220). Documento informativo; no reemplaza el formato oficial DIAN.
            </p>

            <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar certificados"
    ariaLabelledBy="cert-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

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
                    emptyLabel={totalItems === 0 ? "Sin empleados" : undefined}
                />
            )}

            {loading ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando empleados…</div>
            ) : showEmpty ? (
                <div className="purchases-empty"><i className="ri-file-pdf-line" /><p>No hay empleados con nómina aprobada en {anio}.</p></div>
            ) : showNoResults ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>No hay empleados que coincidan con los filtros</div>
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
                        emptyLabel={totalItems === 0 ? "Sin empleados" : undefined}
                    />
                </>
            )}
        </div>
    );
};

export default NominaCertificados;

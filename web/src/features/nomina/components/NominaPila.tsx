import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "../../treasury/page/ConciliacionBancaria.css";
import { previewPila, generarPila, downloadPila, getPilaHistorial, type PilaPlanilla, type PilaHistorialItem } from "../../../services/nomina.service";
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

const money = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const thisPeriodo = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const APORTES_ROWS = [
    { label: "Salud (12.5%)", key: "salud" as const },
    { label: "Pensión (16%)", key: "pension" as const },
    { label: "Fondo de Solidaridad (FSP)", key: "fsp" as const },
    { label: "ARL", key: "arl" as const },
    { label: "Caja de Compensación (4%)", key: "ccf" as const },
    { label: "SENA (2%)", key: "sena" as const },
    { label: "ICBF (3%)", key: "icbf" as const },
];

type CotizanteRow = PilaPlanilla["cotizantes"][number];

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "empleado", label: "Empleado", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "dias", label: "Días", type: "number", icon: "ri-calendar-check-line" },
    { id: "ibc", label: "IBC", type: "number", icon: "ri-calculator-line" },
    { id: "salud", label: "Salud", type: "number", icon: "ri-heart-pulse-line" },
    { id: "pension", label: "Pensión", type: "number", icon: "ri-shield-user-line" },
    { id: "arl", label: "ARL", type: "number", icon: "ri-shield-check-line" },
    { id: "parafiscales", label: "Parafiscales", type: "number", icon: "ri-building-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-pulse-line", options: [{ value: "ok", label: "OK" }, { value: "alerta", label: "Con alertas" }] },
];

const NominaPila: React.FC = () => {
    const [periodo, setPeriodo] = useState(thisPeriodo());
    const [planilla, setPlanilla] = useState<PilaPlanilla | null>(null);
    const [loading, setLoading] = useState(false);
    const [generando, setGenerando] = useState(false);
    const [generado, setGenerado] = useState(false);
    const [historial, setHistorial] = useState<PilaHistorialItem[]>([]);

    const [filterSearch, setFilterSearch] = useState("");
    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const [histPage, setHistPage] = useState(1);
    const [histPageSize, setHistPageSize] = useState(10);
    const [histFilter, setHistFilter] = useState("");

    const getRowFilterValue = useCallback((row: CotizanteRow, filterId: string): string => {
        switch (filterId) {
            case "empleado": return `${row.nombre ?? ""} ${row.documento ?? ""}`.trim();
            case "dias": return String(row.dias ?? 0);
            case "ibc": return String(row.ibc ?? 0);
            case "salud": return String((row.salud_empleado ?? 0) + (row.salud_empleador ?? 0));
            case "pension": return String((row.pension_empleado ?? 0) + (row.pension_empleador ?? 0) + (row.fsp ?? 0));
            case "arl": return String(row.arl ?? 0);
            case "parafiscales": return String((row.ccf ?? 0) + (row.sena ?? 0) + (row.icbf ?? 0));
            case "total": return String(row.total ?? 0);
            case "estado": return row.advertencias?.length ? "alerta" : "ok";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || periodo !== thisPeriodo() || hasActiveClientFilters;

    const cargarHistorial = () => getPilaHistorial().then(setHistorial).catch(() => setHistorial([]));
    useEffect(() => { cargarHistorial(); }, []);

    const onPreview = async () => {
        if (!/^\d{4}-\d{2}$/.test(periodo)) { errorToast("Período inválido. Usa AAAA-MM (ej. 2026-05)."); return; }
        setLoading(true);
        setGenerado(false);
        setPage(1);
        try {
            const p = await previewPila(periodo);
            setPlanilla(p);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al calcular la PILA");
            setPlanilla(null);
        } finally {
            setLoading(false);
        }
    };

    const onGenerar = async () => {
        setGenerando(true);
        try {
            const r = await generarPila(periodo);
            setPlanilla(r.planilla);
            setGenerado(true);
            successToast(r.message);
            cargarHistorial();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al generar la PILA");
        } finally {
            setGenerando(false);
        }
    };

    const onDownload = async (p: string) => {
        try { await downloadPila(p); } catch (e) { errorToast(e instanceof Error ? e.message : "Error al descargar"); }
    };

    const cotizantes = planilla?.cotizantes ?? [];
    const filteredCotizantes = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return cotizantes;
        return cotizantes.filter((c) => c.nombre.toLowerCase().includes(q) || c.documento.includes(q));
    }, [cotizantes, debouncedSearch]);

    const displayedCotizantes = filterRows(filteredCotizantes);
    const totalItems = displayedCotizantes.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedCotizantes = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedCotizantes.slice(start, start + pageSize);
    }, [displayedCotizantes, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const filteredHistorial = useMemo(() => {
        const q = histFilter.trim().toLowerCase();
        if (!q) return historial;
        return historial.filter((h) =>
            (h.periodo_label || h.periodo_key).toLowerCase().includes(q) || h.periodo_key.includes(q),
        );
    }, [historial, histFilter]);

    const histTotal = filteredHistorial.length;
    const histTotalPages = Math.max(1, Math.ceil(histTotal / histPageSize));
    const safeHistPage = Math.min(histPage, histTotalPages);
    const paginatedHistorial = useMemo(() => {
        const start = (safeHistPage - 1) * histPageSize;
        return filteredHistorial.slice(start, start + histPageSize);
    }, [filteredHistorial, safeHistPage, histPageSize]);
    const histRange = paginationRange(safeHistPage, histPageSize, histTotal);

    useEffect(() => { setPage(1); }, [debouncedSearch, pageSize, planilla]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
    useEffect(() => { setHistPage(1); }, [histFilter, histPageSize]);
    useEffect(() => { if (histPage > histTotalPages) setHistPage(histTotalPages); }, [histPage, histTotalPages]);

    const clearFilters = () => {
        setFilterSearch("");
        setPeriodo(thisPeriodo());
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, periodo]);

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

    const t = planilla?.totales;
    const conAdvertencias = planilla?.cotizantes.filter((c) => c.advertencias?.length).length ?? 0;

    const renderCotTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Empleado</th>
                        <th>Días</th>
                        <th className="num-col">IBC</th>
                        <th className="num-col">Salud</th>
                        <th className="num-col">Pensión</th>
                        <th className="num-col">ARL</th>
                        <th className="num-col">Parafiscales</th>
                        <th className="num-col">Total</th>
                        <th>Estado</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedCotizantes.map((c) => (
                        <tr key={c.empleado_id}>
                            <td data-label="Empleado">
                                <strong>{c.nombre}</strong>
                                <br /><span style={{ fontSize: "0.85em", color: "var(--text-muted)" }}>{c.documento}</span>
                            </td>
                            <td data-label="Días">{c.dias}</td>
                            <td data-label="IBC" className="num-col">{money(c.ibc)}</td>
                            <td data-label="Salud" className="num-col">{money(c.salud_empleado + c.salud_empleador)}</td>
                            <td data-label="Pensión" className="num-col">{money(c.pension_empleado + c.pension_empleador + c.fsp)}</td>
                            <td data-label="ARL" className="num-col">{money(c.arl)}</td>
                            <td data-label="Parafiscales" className="num-col">{money(c.ccf + c.sena + c.icbf)}</td>
                            <td data-label="Total" className="num-col"><strong>{money(c.total)}</strong></td>
                            <td data-label="Estado">
                                {c.advertencias?.length
                                    ? <span className="status-badge status-rejected" title={c.advertencias.join(", ")}>{c.advertencias.length} alerta(s)</span>
                                    : <span className="status-badge status-paid">OK</span>}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderCotList = () => (
        <div className="purchases-list-view">
            {paginatedCotizantes.map((c) => (
                <article key={c.empleado_id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{c.nombre}</strong>
                            <span className="purchases-list-item__amount-badge">{money(c.total)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{c.documento}</strong>
                            <span>{c.dias} día(s)</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field"><dt>IBC</dt><dd>{money(c.ibc)}</dd></div>
                            <div className="purchases-list-item__field"><dt>Estado</dt><dd>{c.advertencias?.length ? `${c.advertencias.length} alerta(s)` : "OK"}</dd></div>
                        </dl>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderCotCards = () => (
        <div className="purchases-cards-view">
            {paginatedCotizantes.map((c) => (
                <article key={c.empleado_id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{c.nombre}</strong>
                        <span className="purchases-card__amount-badge">{money(c.total)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{c.documento}</strong>
                        <span>· {c.dias} días</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field"><dt>IBC</dt><dd>{money(c.ibc)}</dd></div>
                        <div className="purchases-card__field"><dt>Estado</dt><dd>{c.advertencias?.length ? "Con alertas" : "OK"}</dd></div>
                    </dl>
                </article>
            ))}
        </div>
    );

    const renderCotView = () => {
        if (effectiveViewMode === "list") return renderCotList();
        if (effectiveViewMode === "cards") return renderCotCards();
        return renderCotTable();
    };

    const filterContent = (
        <>
            <FilterField label="Período" htmlFor="pila-filter-periodo" icon="ri-calendar-line">
                                        <FieldControl id="pila-filter-periodo" type="month" value={periodo} onChange={(e) => setPeriodo(e.target.value)} />
                                    </FilterField>
                                    <FilterField label="Búsqueda empleado" htmlFor="pila-filter-search" icon="ri-search-line">
                                        <FieldControl id="pila-filter-search" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Nombre o documento" disabled={!planilla} />
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="pila-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="pila-filters-heading" className="purchases-filters-panel__title">Filtrar PILA</h2>
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
                <button ref={filtersToggleRef} type="button" className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-haspopup="true" aria-controls="pila-filters-panel">
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div ref={filtersPanelRef} id="pila-filters-panel" className="purchases-filters-panel purchases-filters-panel--floating" style={filtersPanelStyle} role="region" aria-labelledby="pila-filters-heading">
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    return (
        <div className="nomina-pila">
            <div className="purchases-header" style={{ marginBottom: 12, padding: 0, border: "none", boxShadow: "none" }}>
                <div className="header-content">
                    <h2 style={{ margin: 0, fontSize: "1.1rem" }}>PILA — Planilla de aportes</h2>
                    <p style={{ margin: "4px 0 0", color: "var(--text-muted)", fontSize: "0.9rem" }}>
                        Calcula aportes a seguridad social y genera el archivo plano para el operador (Aportes en Línea).
                    </p>
                </div>
                <div className="purchases-actions" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button type="button" className="btn-secondary" onClick={onPreview} disabled={loading}>
                        <i className="ri-calculator-line" aria-hidden /> {loading ? "Calculando…" : "Calcular"}
                    </button>
                    {planilla && (
                        <button type="button" className="btn-primary" onClick={onGenerar} disabled={generando}>
                            <i className="ri-file-add-line" aria-hidden /> {generando ? "Generando…" : "Generar planilla"}
                        </button>
                    )}
                    {generado && (
                        <button type="button" className="btn-secondary" onClick={() => onDownload(periodo)}>
                            <i className="ri-download-2-line" aria-hidden /> Descargar archivo
                        </button>
                    )}
                </div>
            </div>

            <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar PILA"
    ariaLabelledBy="pila-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

            {!planilla ? (
                <div className="purchases-empty"><i className="ri-team-line" /><p>Elige un período en Filtros y pulsa &quot;Calcular&quot; para ver los aportes de los empleados activos.</p></div>
            ) : (
                <>
                    <div className="cb-summary" style={{ gap: 24, marginBottom: 12 }}>
                        <span>Trabajadores <strong>{t?.trabajadores ?? 0}</strong></span>
                        <span>Total IBC <strong>{money(t?.ibc ?? 0)}</strong></span>
                        <span style={{ color: "var(--accent-teal)" }}>Total aportes <strong>{money(t?.total ?? 0)}</strong></span>
                    </div>

                    {conAdvertencias > 0 && (
                        <p className="pm-hint" style={{ color: "#b45309", marginBottom: 12 }}>
                            <i className="ri-error-warning-line" /> {conAdvertencias} empleado(s) tienen datos de seguridad social incompletos.
                        </p>
                    )}

                    <div className="purchases-table-container ds-table-container" style={{ marginBottom: 16 }}>
                        <table className="purchases-table ds-table">
                            <thead><tr><th>Concepto</th><th className="num-col">Valor</th></tr></thead>
                            <tbody>
                                {APORTES_ROWS.map((row) => (
                                    <tr key={row.key}><td data-label="Concepto">{row.label}</td><td data-label="Valor" className="num-col">{money(t?.[row.key] ?? 0)}</td></tr>
                                ))}
                                <tr><td data-label="Concepto"><strong>Total</strong></td><td data-label="Valor" className="num-col"><strong>{money(t?.total ?? 0)}</strong></td></tr>
                            </tbody>
                        </table>
                    </div>

                    <h3 style={{ margin: "0 0 8px", fontSize: "1rem" }}>Detalle por empleado</h3>

                    {totalItems > 0 && (
                        <PaginationToolbar
                            position="top"
                            page={safePage}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            rangeStart={start}
                            rangeEnd={end}
                            onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))}
                            onPageSizeChange={(s) => { setPageSize(normalizePageSize(s)); setPage(1); }}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            showViewToggle
                            beforeViewToggle={filtersToolbar}
                        />
                    )}

                    {totalItems === 0 ? (
                        <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 24 }}>Sin empleados que coincidan con la búsqueda</div>
                    ) : (
                        <>
                            {renderCotView()}
                            <PaginationToolbar position="bottom" page={safePage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} rangeStart={start} rangeEnd={end} onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))} />
                        </>
                    )}
                </>
            )}

            {historial.length > 0 && (
                <div style={{ marginTop: 24 }}>
                    <div className="purchases-header" style={{ marginBottom: 8, padding: 0, border: "none", boxShadow: "none" }}>
                        <h3 style={{ margin: 0, fontSize: "1rem" }}>Historial de planillas</h3>
                        <FilterField label="Buscar período" htmlFor="pila-hist-filter" icon="ri-search-line">
                            <FieldControl id="pila-hist-filter" type="text" value={histFilter} onChange={(e) => setHistFilter(e.target.value)} placeholder="Período" />
                        </FilterField>
                    </div>
                    <PaginationToolbar
                        position="top"
                        page={safeHistPage}
                        totalPages={histTotalPages}
                        totalItems={histTotal}
                        pageSize={histPageSize}
                        pageSizeOptions={PAGE_SIZE_OPTIONS}
                        rangeStart={histRange.start}
                        rangeEnd={histRange.end}
                        onPageChange={(p) => setHistPage(Math.max(1, Math.min(histTotalPages, p)))}
                        onPageSizeChange={(s) => { setHistPageSize(normalizePageSize(s)); setHistPage(1); }}
                        viewMode={viewMode}
                        onViewModeChange={setViewMode}
                        showViewToggle
                    />
                    <div className="purchases-table-container ds-table-container">
                        <table className="purchases-table ds-table">
                            <thead><tr><th>Período</th><th>Trabajadores</th><th className="num-col">Total aportes</th><th>Acciones</th></tr></thead>
                            <tbody>
                                {paginatedHistorial.map((h) => (
                                    <tr key={h.periodo_key}>
                                        <td data-label="Período">{h.periodo_label || h.periodo_key}</td>
                                        <td data-label="Trabajadores">{h.totales?.trabajadores ?? 0}</td>
                                        <td data-label="Total aportes" className="num-col">{money(h.totales?.total ?? 0)}</td>
                                        <td data-label="Acciones">
                                            <button type="button" className="btn-action" onClick={() => onDownload(h.periodo_key)}><i className="ri-download-2-line" aria-hidden /> Descargar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NominaPila;

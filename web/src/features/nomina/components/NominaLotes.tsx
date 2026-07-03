import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import { getNominasByPeriodo, type Nomina, type LoteResumen } from "../../../services/nomina.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    AppDrawer,
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
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const formatCOP = (value: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(value || 0);

const statusLabel: Record<string, string> = {
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    PENDING: "Borrador",
    SENT: "Enviada",
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "periodo", label: "Periodo", type: "text", icon: "ri-calendar-line", serverSide: true },
    { id: "trabajadores", label: "Trabajadores", type: "number", icon: "ri-team-line" },
    { id: "estado", label: "Estado", type: "text", icon: "ri-pulse-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
];

type Props = {
    lotes: LoteResumen[];
    loading: boolean;
    loadingPlantilla: boolean;
    onGenerarMesSiguiente: (fromPeriodoKey?: string) => void;
    onSelectNomina: (nom: Nomina) => void;
};

const NominaLotes: React.FC<Props> = ({ lotes, loading, loadingPlantilla, onGenerarMesSiguiente, onSelectNomina }) => {
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
    const getRowFilterValue = useCallback((row: LoteResumen, filterId: string): string => {
        switch (filterId) {
            case "periodo": return `${row.periodo_label ?? ""} ${row.periodo_key ?? ""}`.trim();
            case "trabajadores": return String(row.trabajadores ?? 0);
            case "estado": return `${row.aprobadas ?? 0} ${row.rechazadas ?? 0} ${row.pendientes ?? 0}`;
            case "total": return String(row.total ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    const [drawerLote, setDrawerLote] = useState<LoteResumen | null>(null);
    const [detalle, setDetalle] = useState<Nomina[]>([]);
    const [cargandoDet, setCargandoDet] = useState(false);
    const [detPage, setDetPage] = useState(1);
    const [detPageSize, setDetPageSize] = useState(20);

    useBodyScrollLock(!!drawerLote);

    const filteredLotes = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return lotes;
        return lotes.filter((l) => l.periodo_label.toLowerCase().includes(q) || l.periodo_key.includes(q));
    }, [lotes, debouncedSearch]);

    const displayedLotes = filterRows(filteredLotes);
    const totalItems = displayedLotes.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedLotes = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedLotes.slice(start, start + pageSize);
    }, [displayedLotes, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const detTotal = detalle.length;
    const detTotalPages = Math.max(1, Math.ceil(detTotal / detPageSize));
    const safeDetPage = Math.min(detPage, detTotalPages);
    const paginatedDet = useMemo(() => {
        const start = (safeDetPage - 1) * detPageSize;
        return detalle.slice(start, start + detPageSize);
    }, [detalle, safeDetPage, detPageSize]);
    const detRange = paginationRange(safeDetPage, detPageSize, detTotal);

    useEffect(() => { setPage(1); }, [debouncedSearch, pageSize]);
    useEffect(() => { if (page > totalPages) setPage(totalPages); }, [page, totalPages]);
    useEffect(() => { setDetPage(1); }, [drawerLote, detPageSize]);

    const clearFilters = () => {
        setFilterSearch("");
        clearColFilters();
    };

    const abrirLote = async (lote: LoteResumen) => {
        setDrawerLote(lote);
        setDetPage(1);
        setCargandoDet(true);
        try {
            const res = await getNominasByPeriodo(lote.periodo_key);
            setDetalle(res.items);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el detalle del periodo");
            setDetalle([]);
        } finally {
            setCargandoDet(false);
        }
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch]);

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

    const renderVerBtn = (l: LoteResumen, layout: "table" | "list" | "cards" = "table") => (
        <button type="button" className="btn-action" onClick={() => abrirLote(l)} title="Ver nóminas del periodo">
            <i className="ri-eye-line" aria-hidden />
            {layout === "table" ? " Ver" : null}
        </button>
    );

    const renderCloneBtn = (l: LoteResumen) => (
        <button type="button" className="btn-action" title="Generar mes siguiente" disabled={loadingPlantilla} onClick={() => onGenerarMesSiguiente(l.periodo_key)}>
            <i className="ri-file-copy-line" aria-hidden />
        </button>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Periodo</th>
                        <th>Trabajadores</th>
                        <th>Estado</th>
                        <th className="num-col">Total</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedLotes.map((l) => (
                        <tr key={l.periodo_key}>
                            <td data-label="Periodo"><strong>{l.periodo_label}</strong></td>
                            <td data-label="Trabajadores">{l.trabajadores}</td>
                            <td data-label="Estado">
                                {l.aprobadas > 0 && <span className="status-badge status-paid">{l.aprobadas} aprob.</span>}
                                {l.rechazadas > 0 && <span className="status-badge status-rejected" style={{ marginLeft: 4 }}>{l.rechazadas} rech.</span>}
                                {l.pendientes > 0 && <span className="status-badge status-pending" style={{ marginLeft: 4 }}>{l.pendientes} pend.</span>}
                            </td>
                            <td data-label="Total" className="num-col"><strong>{formatCOP(l.total)}</strong></td>
                            <td data-label="Acciones">
                                <div className="action-buttons ds-row-actions">
                                    {renderVerBtn(l)}
                                    {renderCloneBtn(l)}
                                </div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {paginatedLotes.map((l) => (
                <article key={l.periodo_key} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{l.periodo_label}</strong>
                            <span className="purchases-list-item__amount-badge">{formatCOP(l.total)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{l.trabajadores} trabajador(es)</strong>
                            <span>{l.aprobadas} aprob. · {l.pendientes} pend.</span>
                        </div>
                    </div>
                    <footer className="purchases-list-item__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--list">
                            {renderVerBtn(l, "list")}
                            {renderCloneBtn(l)}
                        </div>
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {paginatedLotes.map((l) => (
                <article key={l.periodo_key} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{l.periodo_label}</strong>
                        <span className="purchases-card__amount-badge">{formatCOP(l.total)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{l.trabajadores} trabajador(es)</strong>
                        <span>· {l.aprobadas} aprob.</span>
                    </div>
                    <footer className="purchases-card__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--cards">
                            {renderVerBtn(l, "cards")}
                            {renderCloneBtn(l)}
                        </div>
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
            <FilterField label="Búsqueda" htmlFor="nom-lotes-filter-search" icon="ri-search-line">
                <FieldControl id="nom-lotes-filter-search" type="text" value={filterSearch} onChange={(e) => setFilterSearch(e.target.value)} placeholder="Periodo" />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="nom-lotes-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="nom-lotes-filters-heading" className="purchases-filters-panel__title">Filtrar nóminas</h2>
                {hasActiveFilters && <button type="button" className="purchases-filters-clear" onClick={clearFilters}>Limpiar</button>}
            </div>
            <div className="purchases-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="purchases-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="purchases-filters-clear purchases-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden /> Limpiar
                </button>
            )}
            <div className="purchases-filters-dropdown" ref={filtersDropdownRef}>
                <button ref={filtersToggleRef} type="button" className={`purchases-filters-toggle ${filtersOpen ? "open" : ""}`} onClick={() => setFiltersOpen((v) => !v)} aria-expanded={filtersOpen} aria-haspopup="true" aria-controls="nom-lotes-filters-panel">
                    <i className="ri-filter-3-line" aria-hidden /> Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div ref={filtersPanelRef} id="nom-lotes-filters-panel" className="purchases-filters-panel purchases-filters-panel--floating" style={filtersPanelStyle} role="region" aria-labelledby="nom-lotes-filters-heading">
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    if (loading) {
        return <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando nóminas…</div>;
    }
    if (lotes.length === 0) {
        return <div className="purchases-empty"><i className="ri-file-list-3-line" /><p>Aún no has emitido nóminas. Usa &quot;Emitir nómina&quot; para crear la primera.</p></div>;
    }

    return (
        <>
            <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar nóminas"
    ariaLabelledBy="nom-lotes-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

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

            {totalItems === 0 ? (
                <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>No hay periodos que coincidan con la búsqueda</div>
            ) : (
                <>
                    {renderView()}
                    <PaginationToolbar position="bottom" page={safePage} totalPages={totalPages} totalItems={totalItems} pageSize={pageSize} rangeStart={start} rangeEnd={end} onPageChange={(p) => setPage(Math.max(1, Math.min(totalPages, p)))} />
                </>
            )}

            {drawerLote && (
                <AppDrawer
                    wide
                    title={`${drawerLote.periodo_label} · ${formatCOP(drawerLote.total)}`}
                    titleIcon="ri-file-list-3-line"
                    onClose={() => setDrawerLote(null)}
                    footer={<button type="button" className="export-cancel" onClick={() => setDrawerLote(null)}>Cerrar</button>}
                >
                    <p className="pm-hint">{drawerLote.trabajadores} trabajador(es) · {drawerLote.aprobadas} aprobada(s) · {drawerLote.pendientes} pendiente(s)</p>
                    {cargandoDet ? (
                        <p className="pm-hint"><i className="ri-loader-4-line rotating" /> Cargando detalle…</p>
                    ) : detalle.length === 0 ? (
                        <p className="pm-hint">Sin nóminas en este periodo.</p>
                    ) : (
                        <>
                            <PaginationToolbar
                                position="top"
                                page={safeDetPage}
                                totalPages={detTotalPages}
                                totalItems={detTotal}
                                pageSize={detPageSize}
                                pageSizeOptions={PAGE_SIZE_OPTIONS}
                                rangeStart={detRange.start}
                                rangeEnd={detRange.end}
                                onPageChange={(p) => setDetPage(Math.max(1, Math.min(detTotalPages, p)))}
                                onPageSizeChange={(s) => { setDetPageSize(normalizePageSize(s)); setDetPage(1); }}
                            />
                            <div className="purchases-table-container ds-table-container">
                                <table className="purchases-table ds-table">
                                    <thead>
                                        <tr>
                                            <th>Número</th>
                                            <th>Empleado</th>
                                            <th className="num-col">Total</th>
                                            <th>Estado</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedDet.map((nom) => {
                                            const t = nom.NominaElectronica?.Trabajador;
                                            const status = nom.systemInfo?.nominaStatus ?? "PENDING";
                                            return (
                                                <tr key={nom._id}>
                                                    <td data-label="Número"><strong>{nom.NominaElectronica?.NumeroSecuenciaXML?.Numero ?? "—"}</strong></td>
                                                    <td data-label="Empleado">{t ? `${t.PrimerNombre ?? ""} ${t.PrimerApellido ?? ""}` : "—"}</td>
                                                    <td data-label="Total" className="num-col">{formatCOP(Number(nom.NominaElectronica?.ComprobanteTotal ?? 0))}</td>
                                                    <td data-label="Estado"><span className={`status-badge status-${status.toLowerCase()}`}>{statusLabel[status] ?? status}</span></td>
                                                    <td data-label="Acciones">
                                                        <button type="button" className="btn-action" title="Ver detalle" onClick={() => { setDrawerLote(null); onSelectNomina(nom); }}>
                                                            <i className="ri-eye-line" aria-hidden /> Ver
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </>
                    )}
                </AppDrawer>
            )}
        </>
    );
};

export default NominaLotes;

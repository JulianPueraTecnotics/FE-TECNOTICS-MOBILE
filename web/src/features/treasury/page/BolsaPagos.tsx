import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import "../../purchases/page/Purchases.css";
import "../../recaudos/page/Recaudos.css";
import "../../purchases/components/PurchaseModals.css";
import "./ConciliacionBancaria.css";
import { saldoBolsa, reclasificarBolsa, type ConceptoBolsa } from "../conciliacion.service";
import { getCoa } from "../../accounting/accounting.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    AppModal,
    FilterField,
    FiltersMobileDrawer,
    FieldControl,
    useConfirm,
    PaginationToolbar,
    paginationRange,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;
const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "concepto", label: "Concepto", type: "text", icon: "ri-price-tag-3-line", serverSide: true },
    { id: "movimientos", label: "Movimientos", type: "number", icon: "ri-file-list-3-line" },
    { id: "monto", label: "Monto", type: "number", icon: "ri-money-dollar-circle-line" },
];

/**
 * Bolsa de pagos sin asignar (cuenta 22050501): muestra el saldo de egresos del banco que aún no se
 * aplicaron a un proveedor, desglosado por concepto. Permite reclasificar cada concepto a su cuenta
 * correcta (nómina → salarios, 4x1000 → gasto bancario, etc.) sin scripts.
 */
const BolsaPagosPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [data, setData] = useState<{ metido: number; asignado: number; saldoSinAsignar: number; conceptos: ConceptoBolsa[] }>({
        metido: 0, asignado: 0, saldoSinAsignar: 0, conceptos: [],
    });
    const [loading, setLoading] = useState(true);
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
    const getRowFilterValue = useCallback((row: ConceptoBolsa, filterId: string): string => {
        switch (filterId) {
            case "concepto": return row.concepto ?? "";
            case "movimientos": return String(row.n ?? 0);
            case "monto": return String(row.suma ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    const [reclas, setReclas] = useState<ConceptoBolsa | null>(null);
    const [cuentaSearch, setCuentaSearch] = useState("");
    const [cuentaResultados, setCuentaResultados] = useState<{ codigo: string; nombre: string }[]>([]);
    const [cuentaSel, setCuentaSel] = useState<{ codigo: string; nombre: string } | null>(null);
    const [aplicando, setAplicando] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const api = await saldoBolsa();
            setData({
                metido: api.metido,
                asignado: api.asignado,
                saldoSinAsignar: api.saldoSinAsignar,
                conceptos: api.conceptos,
            });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar la bolsa");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { load(); }, [load]);

    const filteredConceptos = useMemo(() => {
        const q = debouncedSearch.trim().toLowerCase();
        if (!q) return data.conceptos;
        return data.conceptos.filter((c) =>
            c.concepto.toLowerCase().includes(q),
        );
    }, [data.conceptos, debouncedSearch]);

    const displayedConceptos = filterRows(filteredConceptos);
    const totalItems = displayedConceptos.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const safePage = Math.min(page, totalPages);
    const paginatedConceptos = useMemo(() => {
        const start = (safePage - 1) * pageSize;
        return displayedConceptos.slice(start, start + pageSize);
    }, [displayedConceptos, safePage, pageSize]);
    const { start, end } = paginationRange(safePage, pageSize, totalItems);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        setPage(1);
    }, [debouncedSearch, pageSize]);

    useEffect(() => {
        if (page > totalPages) setPage(totalPages);
    }, [page, totalPages]);

    const handlePageChange = (nextPage: number) => setPage(Math.max(1, Math.min(totalPages, nextPage)));
    const handlePageSizeChange = (nextSize: number) => { setPageSize(normalizePageSize(nextSize)); setPage(1); };
    const clearFilters = () => {
        setFilterSearch("");
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

    const abrirReclas = (c: ConceptoBolsa) => { setReclas(c); setCuentaSearch(""); setCuentaResultados([]); setCuentaSel(null); };

    const buscarCuentas = async (q: string) => {
        setCuentaSel(null);
        if (q.trim().length < 2) { setCuentaResultados([]); return; }
        try {
            const r = await getCoa(1, 25, q.trim());
            const cuentas = r.accounts.filter((a) => a.es_movimiento !== false).map((a) => ({ codigo: a.codigo, nombre: a.nombre }));
            setCuentaResultados(cuentas);
            const exacta = cuentas.find((c) => c.codigo === q.trim());
            if (exacta) setCuentaSel(exacta);
        } catch (e) { errorToast(e instanceof Error ? e.message : "Error al buscar cuentas"); }
    };

    const aplicarReclas = async () => {
        if (!reclas || !cuentaSel) { errorToast("Elige la cuenta destino"); return; }
        const label = reclas.concepto;
        if (!(await confirm(`Se reclasificarán los ${reclas.n} movimiento(s) de "${label}" (${money(reclas.suma)}) a la cuenta ${cuentaSel.codigo} — ${cuentaSel.nombre}. ¿Continuar?`))) return;
        setAplicando(true);
        try {
            const r = await reclasificarBolsa(cuentaSel.codigo, { concepto: reclas.concepto });
            successToast(r.message);
            setReclas(null);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo reclasificar");
        } finally {
            setAplicando(false);
        }
    };

    const renderReclasBtn = (c: ConceptoBolsa, layout: "table" | "list" | "cards" = "table") => (
        <button type="button" className="btn-action" onClick={() => abrirReclas(c)} title="Reclasificar a cuenta contable">
            <i className="ri-arrow-left-right-line" aria-hidden />
            {layout === "table" ? " Reclasificar" : null}
        </button>
    );

    const renderConceptoLabel = (c: ConceptoBolsa) => c.concepto;

    const renderTable = () => (
        <div className="recaudos-table-container ds-table-container">
            <table className="recaudos-table ds-table">
                <thead>
                    <tr>
                        <th>Concepto</th>
                        <th style={{ textAlign: "center" }}>Movimientos</th>
                        <th className="num-col">Monto</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {paginatedConceptos.map((c) => (
                        <tr key={c.concepto}>
                            <td data-label="Concepto"><strong>{renderConceptoLabel(c)}</strong></td>
                            <td data-label="Movimientos" style={{ textAlign: "center" }}>{c.n}</td>
                            <td data-label="Monto" className="num-col"><strong>{money(c.suma)}</strong></td>
                            <td data-label="Acciones">
                                <div className="action-buttons ds-row-actions">{renderReclasBtn(c)}</div>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="recaudos-list-view">
            {paginatedConceptos.map((c) => (
                <article key={c.concepto} className="recaudos-list-item">
                    <div className="recaudos-list-item__body">
                        <div className="recaudos-list-item__head">
                            <strong className="recaudos-list-item__client">{c.concepto}</strong>
                            <span className="recaudos-list-item__balance">{money(c.suma)}</span>
                        </div>
                        <div className="recaudos-list-item__main">
                            <p className="recaudos-list-item__number">{c.n} movimiento(s)</p>
                        </div>
                    </div>
                    <footer className="recaudos-list-item__actions">
                        <div className="action-buttons ds-row-actions">{renderReclasBtn(c, "list")}</div>
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="recaudos-cards-view">
            {paginatedConceptos.map((c) => (
                <article key={c.concepto} className="recaudos-card">
                    <div className="recaudos-card__body">
                        <div className="recaudos-card__header">
                            <strong className="recaudos-card__client">{c.concepto}</strong>
                        </div>
                        <div className="recaudos-card__main">
                            <strong className="recaudos-card__number">{money(c.suma)}</strong>
                            <p>{c.n} movimiento(s)</p>
                        </div>
                    </div>
                    <footer className="recaudos-card__actions">
                        <div className="action-buttons ds-row-actions">{renderReclasBtn(c, "cards")}</div>
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
            <FilterField label="Búsqueda" htmlFor="bolsa-filter-search" icon="ri-search-line">
                <FieldControl
                    id="bolsa-filter-search"
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Concepto"
                />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="bolsa-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="bolsa-filters-heading" className="purchases-filters-panel__title">Filtrar conceptos</h2>
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
                    aria-controls="bolsa-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div
                        ref={filtersPanelRef}
                        id="bolsa-filters-panel"
                        className="purchases-filters-panel purchases-filters-panel--floating"
                        style={filtersPanelStyle}
                        role="region"
                        aria-labelledby="bolsa-filters-heading"
                    >
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    const showEmpty = !loading && data.conceptos.length === 0;
    const showNoResults = !loading && data.conceptos.length > 0 && totalItems === 0;

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Bolsa de pagos sin asignar"
                        subtitle="Egresos del banco que entraron a la cuenta 22050501 y aún no se aplicaron. Reclasifica cada concepto a su cuenta correcta (nómina, impuestos, gastos…)."
                    />
                </div>

                <div className="cb-summary" style={{ gap: 24 }}>
                    <span>Metido (transferencias) <strong>{money(data.metido)}</strong></span>
                    <span style={{ color: "var(--accent-teal)" }}>Ya asignado <strong>{money(data.asignado)}</strong></span>
                    <span style={{ color: "#b45309" }}>Sin asignar <strong>{money(data.saldoSinAsignar)}</strong></span>
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar conceptos"
    ariaLabelledBy="bolsa-filters-heading-mobile"
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
                        emptyLabel={totalItems === 0 ? "Sin conceptos" : undefined}
                    />
                )}

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando…</div>
                ) : showEmpty ? (
                    <div className="purchases-empty"><i className="ri-inbox-line"></i><p>La bolsa no tiene saldo sin asignar.</p></div>
                ) : showNoResults ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>No hay conceptos que coincidan con los filtros</div>
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
                            emptyLabel={totalItems === 0 ? "Sin conceptos" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            {reclas && (
                <AppModal
                    title={`Reclasificar “${reclas.concepto}”`}
                    onClose={() => setReclas(null)}
                    closeDisabled={aplicando}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setReclas(null)} disabled={aplicando}>Cancelar</button>
                            <button type="button" className="export-submit" onClick={aplicarReclas} disabled={aplicando || !cuentaSel}>{aplicando ? "Reclasificando…" : "Reclasificar"}</button>
                        </>
                    }
                >
                    <p className="pm-hint">{reclas.n} movimiento(s) · <strong>{money(reclas.suma)}</strong> saldrán de la bolsa hacia la cuenta que elijas.</p>
                    <FilterField label="Cuenta destino del PUC" htmlFor="reclas-cuenta" icon="ri-search-line">
                        <FieldControl
                            id="reclas-cuenta"
                            type="text"
                            value={cuentaSearch}
                            onChange={(e) => { setCuentaSearch(e.target.value); buscarCuentas(e.target.value); }}
                            placeholder="Código o nombre (ej. 25050501, salarios, gravamen)…"
                            autoFocus
                        />
                    </FilterField>
                    {cuentaSel && <p style={{ color: "var(--accent-teal)", fontWeight: 600 }}><i className="ri-check-line" /> {cuentaSel.codigo} — {cuentaSel.nombre}</p>}
                    {cuentaResultados.length > 0 && (
                        <div className="cb-doc-wrap">
                            <table className="cb-doc-table">
                                <thead><tr><th>Código</th><th>Nombre</th></tr></thead>
                                <tbody>
                                    {cuentaResultados.map((c) => (
                                        <tr key={c.codigo} className={cuentaSel?.codigo === c.codigo ? "is-sel" : ""} onClick={() => setCuentaSel(c)}>
                                            <td>{c.codigo}</td><td>{c.nombre}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AppModal>
            )}
        </ListPageShell>
    );
};

export default BolsaPagosPage;

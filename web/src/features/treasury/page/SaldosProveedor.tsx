import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import "./ConciliacionBancaria.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    cxpPorProveedor, cxpDetalleProveedor, pagarProveedor,
    type ProveedorCxp, type CompraCxp,
} from "../conciliacion.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import { useTecContext } from "../../tec/tec-context";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FiltersMobileDrawer,
    FieldControl,
    AppDrawer,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
    useConfirm,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });
const fdate = (d?: string | null) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "proveedor", label: "Proveedor", type: "text", icon: "ri-store-2-line", serverSide: true },
    { id: "nit", label: "NIT", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "facturas", label: "Facturas", type: "number", icon: "ri-file-list-3-line" },
    { id: "comprado", label: "Comprado", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "pagado", label: "Pagado", type: "number", icon: "ri-hand-coin-line" },
    { id: "saldo", label: "Saldo", type: "number", icon: "ri-scales-3-line" },
];

const SaldosProveedorPage: React.FC = () => {
    const { confirm } = useConfirm();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const searchFromUrl = searchParams.get("q") ?? "";
    const soloFromUrl = searchParams.get("pendientes") !== "0";

    const [allProvs, setAllProvs] = useState<ProveedorCxp[]>([]);
    const [totales, setTotales] = useState({ proveedores: 0, total: 0, pagado: 0, saldo: 0 });
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(searchFromUrl);
    const [soloPendientes, setSoloPendientes] = useState(soloFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => searchFromUrl !== "" || !soloFromUrl);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: ProveedorCxp, filterId: string): string => {
        switch (filterId) {
            case "proveedor": return row.nombre ?? "";
            case "nit": return row.doc ?? "";
            case "facturas": return String(row.nFacturas ?? 0);
            case "comprado": return String(row.total ?? 0);
            case "pagado": return String(row.pagado ?? 0);
            case "saldo": return String(row.saldo ?? 0);
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || !soloPendientes || hasActiveClientFilters;

    const [abierto, setAbierto] = useState<ProveedorCxp | null>(null);
    const [detalle, setDetalle] = useState<CompraCxp[]>([]);
    const [detTot, setDetTot] = useState({ facturas: 0, total: 0, pagado: 0, saldo: 0 });
    const [cargandoDet, setCargandoDet] = useState(false);
    const [verPagos, setVerPagos] = useState<string | null>(null);
    const [sel, setSel] = useState<Set<string>>(new Set());
    const [pagando, setPagando] = useState(false);

    useBodyScrollLock(!!abierto);

    const load = useCallback(async () => {
        const hasData = allProvs.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        try {
            const r = await cxpPorProveedor({ search: debouncedSearch.trim() || undefined, soloPendientes });
            setAllProvs(r.proveedores);
            setTotales(r.totales);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar los saldos por proveedor");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [debouncedSearch, soloPendientes]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { load(); }, [load]);

    const displayedProvs = filterRows(allProvs);
    const totalItems = displayedProvs.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const provs = useMemo(
        () => displayedProvs.slice((page - 1) * pageSize, page * pageSize),
        [displayedProvs, page, pageSize],
    );

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (page !== 1) {
            setPage(1);
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                params.set("page", "1");
                return params;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, soloPendientes, pageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => {
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                params.set("page", "1");
                const q = debouncedSearch.trim();
                if (!q) params.delete("q");
                else params.set("q", q);
                if (soloPendientes) params.delete("pendientes");
                else params.set("pendientes", "0");
                return params;
            });
        }, FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, soloPendientes]);

    useEffect(() => {
        if (page > totalPages) {
            const safe = totalPages;
            setPage(safe);
            setSearchParams((prev) => {
                const params = new URLSearchParams(prev);
                params.set("page", String(safe));
                return params;
            });
        }
    }, [page, totalPages, setSearchParams]);

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safePage));
            return params;
        });
    };

    const handlePageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setPageSize(safeSize);
        setPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.set("limit", String(safeSize));
            return params;
        });
    };

    const clearFilters = () => {
        setFilterSearch("");
        setSoloPendientes(true);
        clearColFilters();
        setPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.delete("q");
            params.delete("pendientes");
            return params;
        });
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;
        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(640, window.innerWidth - 32);
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, soloPendientes]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onReflow = () => updateFiltersPanelPosition();
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
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
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [filtersOpen, isMobile]);

    useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

    const abrirProveedor = async (p: ProveedorCxp) => {
        setAbierto(p);
        setVerPagos(null); setSel(new Set());
        setCargandoDet(true);
        try {
            const r = await cxpDetalleProveedor(p.doc, soloPendientes);
            setDetalle(r.documentos);
            setDetTot(r.totales);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar el detalle del proveedor");
        } finally {
            setCargandoDet(false);
        }
    };

    const pagar = async () => {
        if (!abierto) return;
        const ids = sel.size ? [...sel] : undefined;
        const cuantas = ids ? ids.length : detalle.filter((d) => d.saldo > 0.5).length;
        if (!(await confirm(`Se pagarán ${ids ? cuantas : "TODAS las"} factura(s) de ${abierto.nombre} desde la bolsa de proveedores. ¿Continuar?`))) return;
        setPagando(true);
        try {
            const r = await pagarProveedor(abierto.doc, { facturaIds: ids });
            successToast(r.message);
            const det = await cxpDetalleProveedor(abierto.doc, soloPendientes);
            setDetalle(det.documentos); setDetTot(det.totales); setSel(new Set());
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo pagar");
        } finally {
            setPagando(false);
        }
    };

    const pctPagado = useMemo(() => (totales.total > 0 ? Math.round((totales.pagado / totales.total) * 100) : 0), [totales]);

    useTecContext(
        abierto
            ? { pantalla: "compras", titulo: "Saldos por proveedor (cuentas por pagar)", descripcion: `Proveedor abierto: ${abierto.nombre} (NIT ${abierto.doc})`, datos: { proveedor: abierto.nombre, nit: abierto.doc, comprado: detTot.total, pagado: detTot.pagado, saldo_por_pagar: detTot.saldo, facturas_pendientes: detTot.facturas } }
            : { pantalla: "compras", titulo: "Saldos por proveedor (cuentas por pagar)", descripcion: `${totales.proveedores} proveedores · saldo por pagar total ${money(totales.saldo)}`, datos: { proveedores: totales.proveedores, saldo_por_pagar_total: totales.saldo } },
        [abierto?.doc, detTot.saldo, totales.saldo, totales.proveedores],
    );

    const renderVerBtn = (p: ProveedorCxp, layout: "table" | "list" | "cards" = "table") => (
        <button type="button" className="btn-action" onClick={() => abrirProveedor(p)} title="Ver las facturas y pagos de este proveedor">
            <i className="ri-eye-line" aria-hidden />
            {layout === "table" ? " Ver" : null}
        </button>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Proveedor</th>
                        <th>NIT</th>
                        <th style={{ textAlign: "center" }}>Facturas</th>
                        <th className="num-col">Comprado</th>
                        <th className="num-col">Pagado</th>
                        <th className="num-col">Saldo</th>
                        <th style={{ textAlign: "center" }}>Detalle</th>
                    </tr>
                </thead>
                <tbody>
                    {provs.map((p) => (
                        <tr key={p.doc}>
                            <td data-label="Proveedor"><strong>{p.nombre}</strong></td>
                            <td data-label="NIT">{p.doc}</td>
                            <td data-label="Facturas" style={{ textAlign: "center" }}>{p.nPendientes} / {p.nFacturas}</td>
                            <td data-label="Comprado" className="num-col">{money(p.total)}</td>
                            <td data-label="Pagado" className="num-col" style={{ color: "var(--accent-teal)" }}>{money(p.pagado)}</td>
                            <td data-label="Saldo" className="num-col" style={{ fontWeight: 700, color: "#b45309" }}>{money(p.saldo)}</td>
                            <td data-label="Detalle" style={{ textAlign: "center" }}>{renderVerBtn(p)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {provs.map((p) => (
                <article key={p.doc} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{p.nombre}</strong>
                            <span className="purchases-list-item__amount-badge">{money(p.saldo)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>NIT {p.doc}</strong>
                            <span>{p.nPendientes} / {p.nFacturas} factura(s)</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Comprado</dt>
                                <dd className="num-col">{money(p.total)}</dd>
                            </div>
                            <div className="purchases-list-item__field purchases-list-item__field--pagado">
                                <dt>Pagado</dt>
                                <dd>{money(p.pagado)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--list">{renderVerBtn(p, "list")}</div>
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {provs.map((p) => (
                <article key={p.doc} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{p.nombre}</strong>
                        <span className="purchases-card__amount-badge">{money(p.saldo)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>NIT {p.doc}</strong>
                        <span>· {p.nPendientes} / {p.nFacturas} factura(s)</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Comprado</dt>
                            <dd className="num-col">{money(p.total)}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--pagado">
                            <dt>Pagado</dt>
                            <dd>{money(p.pagado)}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--saldo purchases-card__field--full">
                            <dt>Saldo por pagar</dt>
                            <dd>{money(p.saldo)}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">
                        <div className="action-buttons ds-row-actions purchases-actions--cards">{renderVerBtn(p, "cards")}</div>
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
            <FilterField label="Búsqueda" htmlFor="cxp-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="cxp-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Proveedor, NIT"
                                        />
                                    </FilterField>
                                    <FilterField label="Solo con saldo" htmlFor="cxp-filter-pendientes" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="cxp-filter-pendientes"
                                            value={soloPendientes ? "1" : "0"}
                                            onChange={(e) => setSoloPendientes(e.target.value === "1")}
                                        >
                                            <option value="1">Solo con saldo pendiente</option>
                                            <option value="0">Todos los proveedores</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="cxp-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="cxp-filters-heading" className="purchases-filters-panel__title">Filtrar saldos</h2>
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
                    aria-controls="cxp-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen && !isMobile && typeof document !== "undefined" && createPortal(
                    <div
                        ref={filtersPanelRef}
                        id="cxp-filters-panel"
                        className="purchases-filters-panel purchases-filters-panel--floating"
                        style={filtersPanelStyle}
                        role="region"
                        aria-labelledby="cxp-filters-heading"
                    >
                        {filtersPanelContent}
                    </div>,
                    document.body,
                )}
            </div>
        </div>
    );

    const { start, end } = paginationRange(page, pageSize, totalItems);

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader className="purchases-header" title="Saldos por proveedor" />
                </div>

                <div className="cb-summary" style={{ gap: 24 }}>
                    <span><strong>{totales.proveedores}</strong> proveedor(es)</span>
                    <span>Comprado <strong>{money(totales.total)}</strong></span>
                    <span style={{ color: "var(--accent-teal)" }}>Pagado <strong>{money(totales.pagado)}</strong> ({pctPagado}%)</span>
                    <span style={{ color: "#b45309" }}>Saldo por pagar <strong>{money(totales.saldo)}</strong></span>
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar saldos"
    ariaLabelledBy="cxp-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                <PaginationToolbar
                    position="top"
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    rangeStart={start}
                    rangeEnd={end}
                    isFetching={isPageFetching || loading}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle
                    beforeViewToggle={filtersToolbar}
                    emptyLabel={totalItems === 0 ? "Sin proveedores" : undefined}
                />

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando…</div>
                ) : provs.length === 0 ? (
                    <div className="purchases-empty"><i className="ri-truck-line" /><p>No hay proveedores con saldo.</p></div>
                ) : (
                    <>
                        {renderView()}
                        <PaginationToolbar
                            position="bottom"
                            page={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            rangeStart={start}
                            rangeEnd={end}
                            onPageChange={handlePageChange}
                            isFetching={isPageFetching}
                            emptyLabel={totalItems === 0 ? "Sin proveedores" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            {abierto && (
                <AppDrawer
                    wide
                    title={`${abierto.nombre} · saldo ${money(abierto.saldo)}`}
                    titleIcon="ri-eye-line"
                    onClose={() => setAbierto(null)}
                    closeDisabled={pagando}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setAbierto(null)} disabled={pagando}>Cerrar</button>
                            {detTot.saldo > 0.5 && (
                                <button type="button" className="export-submit" onClick={pagar} disabled={pagando}>
                                    <i className="ri-secure-payment-line" /> {pagando ? "Pagando…" : sel.size ? `Pagar ${sel.size} seleccionada(s)` : "Pagar todo desde la bolsa"}
                                </button>
                            )}
                        </>
                    }
                >
                    <p className="pm-hint">NIT {abierto.doc} · {detTot.facturas} factura(s) · comprado {money(detTot.total)} · pagado {money(detTot.pagado)} · <strong style={{ color: "#b45309" }}>saldo {money(detTot.saldo)}</strong></p>
                    {cargandoDet ? (
                        <p className="pm-hint"><i className="ri-loader-4-line rotating" /> Cargando facturas…</p>
                    ) : detalle.length === 0 ? (
                        <p className="pm-hint">Sin facturas pendientes.</p>
                    ) : (
                        <div className="cb-doc-wrap" style={{ maxHeight: 460 }}>
                            <table className="cb-doc-table">
                                <thead><tr><th style={{ width: 30 }}></th><th>Factura</th><th>Fecha</th><th className="cb-doc-col-saldo">Total</th><th className="cb-doc-col-saldo">Pagado</th><th className="cb-doc-col-saldo">Saldo</th><th>Estado</th><th></th></tr></thead>
                                <tbody>
                                    {detalle.map((d) => (
                                        <>
                                            <tr key={d.id}>
                                                <td>{d.saldo > 0.5 && (<input type="checkbox" checked={sel.has(d.id)} onChange={() => setSel((p) => { const n = new Set(p); if (n.has(d.id)) n.delete(d.id); else n.add(d.id); return n; })} />)}</td>
                                                <td><strong>{d.numero}</strong></td>
                                                <td>{fdate(d.fecha)}</td>
                                                <td className="cb-doc-col-saldo">{money(d.total)}</td>
                                                <td className="cb-doc-col-saldo" style={{ color: "var(--accent-teal)" }}>{money(d.pagado)}</td>
                                                <td className="cb-doc-col-saldo" style={{ fontWeight: 700, color: d.saldo > 0.5 ? "#b45309" : "var(--accent-teal)" }}>{money(d.saldo)}</td>
                                                <td><span className="status-badge" style={{ fontSize: ".7rem" }}>{d.estado}</span></td>
                                                <td>
                                                    {d.pagos.length > 0 && (
                                                        <button className="btn-action" onClick={() => setVerPagos(verPagos === d.id ? null : d.id)} title="Ver los pagos aplicados">
                                                            <i className={verPagos === d.id ? "ri-arrow-up-s-line" : "ri-arrow-down-s-line"} /> {d.pagos.length} pago(s)
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                            {verPagos === d.id && d.pagos.map((p, i) => (
                                                <tr key={`${d.id}-p${i}`} style={{ background: "var(--bg-subtle)", fontSize: ".82rem" }}>
                                                    <td colSpan={3} style={{ paddingLeft: 24 }}><i className="ri-corner-down-right-line" /> {fdate(p.fecha)} · {p.banco || "—"}{p.referencia ? ` · ${p.referencia}` : ""}</td>
                                                    <td className="cb-doc-col-saldo">{money(p.valor)}</td>
                                                    <td colSpan={4}></td>
                                                </tr>
                                            ))}
                                        </>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </AppDrawer>
            )}
        </ListPageShell>
    );
};

export default SaldosProveedorPage;

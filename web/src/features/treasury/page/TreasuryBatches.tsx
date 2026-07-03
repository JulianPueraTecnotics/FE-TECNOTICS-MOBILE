import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import "./Treasury.css";
import "./TreasuryBatches.css";
import { getBatches, downloadBatchFile, markBatchSent, reconcileBatch, sendComprobantes } from "../treasury.service";
import type { PaymentBatch } from "../treasury.types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
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
import BatchActionModals, { type BatchActionKind, type BatchConfirmAction } from "../components/BatchActionModals";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const formatCOP = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");
const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "lote", label: "Lote", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "banco", label: "Banco", type: "text", icon: "ri-bank-line", serverSide: true },
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "registros", label: "Registros", type: "number", icon: "ri-file-list-3-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "estado", label: "Estado", type: "select", icon: "ri-filter-3-line", options: [{ value: "generated", label: "Generado" }, { value: "sent", label: "Enviado al banco" }, { value: "reconciled", label: "Conciliado" }], serverSide: true },
];

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    generated: { label: "Generado", cls: "status-pending" },
    sent: { label: "Enviado al banco", cls: "status-pending" },
    reconciled: { label: "Conciliado", cls: "status-paid" },
};

function matchesBatchSearch(batch: PaymentBatch, search: string): boolean {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
        String(batch.consecutivo).includes(term) ||
        batch.bank?.nombre?.toLowerCase().includes(term) ||
        batch.archivo_nombre?.toLowerCase().includes(term)
    );
}

function queryBatches(
    apiBatches: PaymentBatch[],
    opts: {
        search?: string;
        status?: string;
        page: number;
        pageSize: number;
        clientSideMode?: boolean;
        apiPagination?: { total: number; totalPages: number };
    },
): { items: PaymentBatch[]; totalItems: number; totalPages: number } {
    const filtered = apiBatches.filter(
        (batch) => matchesBatchSearch(batch, opts.search ?? "") && (!opts.status || batch.status === opts.status),
    );

    if (opts.clientSideMode) {
        const totalItems = filtered.length;
        const totalPages = Math.max(1, Math.ceil(totalItems / opts.pageSize));
        const safePage = Math.min(Math.max(1, opts.page), totalPages);
        const start = (safePage - 1) * opts.pageSize;
        return {
            items: filtered.slice(start, start + opts.pageSize),
            totalItems,
            totalPages,
        };
    }

    return {
        items: filtered,
        totalItems: opts.apiPagination?.total ?? filtered.length,
        totalPages: opts.apiPagination?.totalPages ?? 1,
    };
}

const TreasuryBatchesPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const qFromUrl = searchParams.get("q") ?? "";
    const statusFromUrl = searchParams.get("status") ?? "";

    const [apiBatches, setApiBatches] = useState<PaymentBatch[]>([]);
    const [apiPagination, setApiPagination] = useState({ total: 0, totalPages: 1 });
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(qFromUrl);
    const [statusFilter, setStatusFilter] = useState(statusFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [refreshKey, setRefreshKey] = useState(0);
    const [actionLoading, setActionLoading] = useState(false);
    const [drawerBatch, setDrawerBatch] = useState<PaymentBatch | null>(null);
    const [confirmAction, setConfirmAction] = useState<BatchConfirmAction>(null);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => qFromUrl !== "" || statusFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: PaymentBatch, filterId: string): string => {
        switch (filterId) {
            case "lote": return String(row.consecutivo ?? "");
            case "banco": return row.bank?.nombre ?? "";
            case "fecha": return toIsoDate(row.generado_en);
            case "registros": return String(row.total_registros ?? 0);
            case "total": return String(row.total_amount ?? 0);
            case "estado": return row.status ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const hasActiveFilters = filterSearch.trim() !== "" || statusFilter.trim() !== "" || hasActiveClientFilters;
    const clientSideMode = debouncedSearch.trim() !== "" || statusFilter.trim() !== "";

    const { items: batches, totalItems, totalPages } = useMemo(
        () =>
            queryBatches(apiBatches, {
                search: debouncedSearch,
                status: statusFilter,
                page,
                pageSize,
                clientSideMode,
                apiPagination,
            }),
        [apiBatches, debouncedSearch, statusFilter, page, pageSize, clientSideMode, apiPagination],
    );
    const displayedBatches = filterRows(batches);

    useRealtime(RealtimeEvents.BATCH_CHANGED, (payload) => {
        setApiBatches((prev) => applyRealtimeChange(prev, payload));
    });

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

    const updateFiltersInQuery = (updates: { q?: string; status?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.q !== undefined) {
                const value = updates.q.trim();
                if (!value) params.delete("q");
                else params.set("q", value);
            }
            if (updates.status !== undefined) {
                const value = updates.status.trim();
                if (!value) params.delete("status");
                else params.set("status", value);
            }
            return params;
        });
        setPage(1);
    };

    const clearFilters = () => {
        setFilterSearch("");
        setStatusFilter("");
        updateFiltersInQuery({ q: "", status: "" });
        clearColFilters();
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

        setFiltersPanelStyle({
            position: "fixed",
            top: Math.max(8, top),
            left,
            width,
        });
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, statusFilter]);

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
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
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
    }, [debouncedSearch, statusFilter, pageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => updateFiltersInQuery({ q: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        const hasData = apiBatches.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);

        (async () => {
            try {
                const fetchPage = clientSideMode ? 1 : page;
                const fetchLimit = clientSideMode ? 100 : pageSize;
                const res = await getBatches(fetchPage, fetchLimit);
                if (ignore) return;
                setApiBatches(res.batches ?? []);
                setApiPagination({
                    total: res.pagination?.total ?? res.batches?.length ?? 0,
                    totalPages: res.pagination?.totalPages ?? 1,
                });
            } catch (e) {
                if (!ignore) {
                    errorToast(e instanceof Error ? e.message : "Error al cargar lotes");
                }
            } finally {
                if (!ignore) {
                    setLoading(false);
                    setIsPageFetching(false);
                }
            }
        })();

        return () => {
            ignore = true;
        };
    }, [page, pageSize, debouncedSearch, statusFilter, refreshKey, clientSideMode]);

    useEffect(() => {
        if (page !== pageFromUrl) setPage(pageFromUrl);
        if (pageSize !== limitFromUrl) setPageSize(limitFromUrl);
        if (filterSearch !== qFromUrl) setFilterSearch(qFromUrl);
        if (statusFilter !== statusFromUrl) setStatusFilter(statusFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageFromUrl, limitFromUrl, qFromUrl, statusFromUrl]);

    const handleConfirmAction = async (kind: BatchActionKind, b: PaymentBatch) => {
        setActionLoading(true);
        try {
            if (kind === "download") {
                await downloadBatchFile(b._id, b.archivo_nombre);
            } else if (kind === "sent") {
                await markBatchSent(b._id);
                successToast("Lote marcado como enviado");
                setRefreshKey((k) => k + 1);
            } else if (kind === "reconcile") {
                const res = await reconcileBatch(b._id);
                successToast(res.message || "Lote conciliado");
                setRefreshKey((k) => k + 1);
            } else if (kind === "comprobantes") {
                const res = await sendComprobantes(b._id);
                successToast(`Comprobantes: ${res.enviados} enviados, ${res.sinCorreo} sin correo, ${res.errores} con error`);
            }
            setConfirmAction(null);
            setDrawerBatch(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo completar la acción");
        } finally {
            setActionLoading(false);
        }
    };

    const renderStatusBadge = (b: PaymentBatch) => {
        const st = STATUS_LABEL[b.status] ?? { label: b.status, cls: "" };
        return <span className={`status-badge ${st.cls}`}>{st.label}</span>;
    };

    const renderBatchActions = (b: PaymentBatch, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button
                type="button"
                className="btn-action"
                onClick={() => setDrawerBatch(b)}
                title="Gestionar lote"
            >
                <i className="ri-settings-3-line" aria-hidden />
                {layout === "table" ? " Acciones" : null}
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Lote</th>
                        <th>Banco</th>
                        <th>Fecha</th>
                        <th>Registros</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedBatches.map((b) => (
                        <tr key={b._id}>
                            <td data-label="Lote" className="document-number">
                                #{b.consecutivo}
                            </td>
                            <td data-label="Banco">{b.bank?.nombre}</td>
                            <td data-label="Fecha">{formatDate(b.generado_en)}</td>
                            <td data-label="Registros">{b.total_registros}</td>
                            <td data-label="Total" className="document-total">{formatCOP(b.total_amount)}</td>
                            <td data-label="Estado">{renderStatusBadge(b)}</td>
                            <td data-label="Acciones">{renderBatchActions(b)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedBatches.map((b) => (
                <article key={b._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">Lote #{b.consecutivo}</strong>
                            {renderStatusBadge(b)}
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{b.bank?.nombre}</strong>
                            <span>{b.total_registros} registro(s)</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(b.generado_en)}</dd>
                            </div>
                            <div className="purchases-list-item__field purchases-list-item__field--highlight">
                                <dt>Total</dt>
                                <dd className="document-total">{formatCOP(b.total_amount)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderBatchActions(b, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedBatches.map((b) => (
                <article key={b._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">Lote #{b.consecutivo}</strong>
                        {renderStatusBadge(b)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{b.bank?.nombre}</strong>
                        <span>· {b.total_registros} registro(s)</span>
                    </div>
                    <dl className="purchases-card__fields purchases-card__fields--grid">
                        <div className="purchases-card__field">
                            <dt>Fecha</dt>
                            <dd>{formatDate(b.generado_en)}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--highlight">
                            <dt>Total</dt>
                            <dd className="document-total">{formatCOP(b.total_amount)}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderBatchActions(b, "cards")}</footer>
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
            <FilterField label="Búsqueda" htmlFor="tb-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="tb-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Lote, banco..."
                                        />
                                    </FilterField>
                                    <FilterField label="Estado" htmlFor="tb-filter-status" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="tb-filter-status"
                                            value={statusFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setStatusFilter(value);
                                                updateFiltersInQuery({ status: value });
                                            }}
                                        >
                                            <option value="">Todos</option>
                                            <option value="generated">Generado</option>
                                            <option value="sent">Enviado al banco</option>
                                            <option value="reconciled">Conciliado</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="tb-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="tb-filters-panel__head">
                <h2 id="tb-filters-heading" className="tb-filters-panel__title">
                    Filtrar lotes
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="tb-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="tb-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="tb-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="tb-filters-clear tb-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="tb-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`tb-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="tb-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="tb-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line tb-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="tb-filters-panel"
                            className="tb-filters-panel tb-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="tb-filters-heading"
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
        <ListPageShell className="tb-page purchases-page">
            <ListPageContainer className="tb-container purchases-container">
                <div className="tb-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Lotes de pago"
                        subtitle="Descarga el archivo para el banco, marca el pago y envía comprobantes a los proveedores"
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar lotes"
    ariaLabelledBy="tb-filters-heading-mobile"
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
                    emptyLabel={totalItems === 0 ? "Sin lotes" : undefined}
                />

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        <p>Cargando lotes...</p>
                    </div>
                ) : totalItems === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-stack-line" />
                        <p>
                            {hasActiveFilters
                                ? "No hay lotes que coincidan con los filtros"
                                : "Aún no has generado lotes de pago. Hazlo desde Tesorería › Pagos a proveedores."}
                        </p>
                    </div>
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
                            emptyLabel={totalItems === 0 ? "Sin lotes" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <BatchActionModals
                drawerBatch={drawerBatch}
                confirmAction={confirmAction}
                loading={actionLoading}
                formatCOP={formatCOP}
                formatDate={formatDate}
                onCloseDrawer={() => setDrawerBatch(null)}
                onOpenConfirm={(kind, batch) => {
                    setDrawerBatch(null);
                    setConfirmAction({ kind, batch });
                }}
                onCloseConfirm={() => setConfirmAction(null)}
                onConfirm={handleConfirmAction}
            />
        </ListPageShell>
    );
};

export default TreasuryBatchesPage;

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Remisiones.css";
import type { IRemision } from "../../../types";
import { REMISION_STATUS_LABELS, type RemisionStatus } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getRemisiones, sendRemisionEmail, downloadRemision, deleteRemision } from "../../../services/remisiones.service";
import { formatCOP } from "../../quotes/quotes.utils";
import RemisionActionModals, { type RemisionActionKind, type RemisionActionState } from "../components/RemisionActionModals";
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

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const sourceLabel = (r: IRemision): string => r.source_number || (r.source === "quote" ? "Cotización" : "Factura");

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "origen", label: "Origen", type: "text", icon: "ri-git-branch-line" },
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
];

const RemisionesPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const statusFromUrl = searchParams.get("status") ?? "";
    const clienteFromUrl = searchParams.get("cliente") ?? "";

    const [remisiones, setRemisiones] = useState<IRemision[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [statusFilter, setStatusFilter] = useState(statusFromUrl);
    const [filterSearch, setFilterSearch] = useState(clienteFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => statusFromUrl !== "" || clienteFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

    const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);
    const [pendingAction, setPendingAction] = useState<RemisionActionState>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const getRowFilterValue = useCallback((row: IRemision, filterId: string): string => {
        switch (filterId) {
            case "origen": return sourceLabel(row);
            case "fecha": return toIsoDate(row.createdAt);
            case "total": return String(row.total ?? 0);
            default: return "";
        }
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const displayedRemisiones = filterRows(remisiones);

    const hasActiveFilters = statusFilter.trim() !== "" || filterSearch.trim() !== "" || hasActiveClientFilters;

    const updateFiltersInQuery = (updates: { status?: string; cliente?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.status !== undefined) {
                const v = updates.status.trim();
                if (!v) params.delete("status");
                else params.set("status", v);
            }
            if (updates.cliente !== undefined) {
                const v = updates.cliente.trim();
                if (!v) params.delete("cliente");
                else params.set("cliente", v);
            }
            return params;
        });
        setPage(1);
    };

    useRealtime(RealtimeEvents.REMISION_CHANGED, (payload) => setRemisiones((prev) => applyRealtimeChange(prev, payload)));

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
        const t = window.setTimeout(() => updateFiltersInQuery({ cliente: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        const hasData = remisiones.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const res = await getRemisiones(page, pageSize, {
                    status: statusFilter || undefined,
                    cliente: debouncedSearch.trim() || undefined,
                });
                if (ignore || !res) return;
                setRemisiones(res.remisiones ?? []);
                setTotalPages(res.pagination?.totalPages ?? 1);
                setTotalItems(res.pagination?.total ?? 0);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las remisiones");
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, pageSize, debouncedSearch, statusFilter, refreshKey]);

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
        setStatusFilter("");
        setFilterSearch("");
        clearColFilters();
        updateFiltersInQuery({ status: "", cliente: "" });
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, statusFilter, filterSearch]);

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

    const openRemisionAction = (kind: RemisionActionKind, r: IRemision) => {
        setPendingAction({ kind, remision: r });
    };

    const closeRemisionAction = () => {
        if (actionLoading) return;
        setPendingAction(null);
    };

    const handleConfirmSend = async () => {
        if (!pendingAction || pendingAction.kind !== "send") return;
        const r = pendingAction.remision;
        setActionLoading(true);
        try {
            await sendRemisionEmail(r._id);
            successToast("Link de firma enviado al cliente");
            setRefreshKey((k) => k + 1);
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownload = async (r: IRemision) => {
        setRowBusy({ id: r._id, action: "download" });
        try {
            const res = await downloadRemision(r._id);
            const uri = res?.data_uri || (res?.base64_remision ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_remision}` : null);
            if (!uri) throw new Error("La respuesta no contiene el PDF");
            const link = document.createElement("a");
            link.href = uri;
            link.download = res?.file_name || `${r.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo descargar");
        } finally {
            setRowBusy(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingAction || pendingAction.kind !== "delete") return;
        const r = pendingAction.remision;
        setActionLoading(true);
        try {
            await deleteRemision(r._id);
            successToast("Remisión eliminada");
            setRefreshKey((k) => k + 1);
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
        } finally {
            setActionLoading(false);
        }
    };

    const rowLocked = (id: string) => rowBusy?.id === id || (pendingAction?.remision._id === id && actionLoading);
    const isBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderActions = (r: IRemision, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions remisiones-actions--${layout}`}>
            <button type="button" className="btn-action" title="Enviar link de firma" onClick={() => openRemisionAction("send", r)} disabled={rowLocked(r._id)}>
                <i className="ri-mail-send-line" aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Descargar PDF" onClick={() => handleDownload(r)} disabled={rowLocked(r._id)}>
                <i className={isBusy(r._id, "download") ? "ri-loader-4-line rotating" : "ri-download-line"} aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => openRemisionAction("delete", r)} disabled={rowLocked(r._id)}>
                <i className="ri-delete-bin-line" aria-hidden />
            </button>
        </div>
    );

    const renderStatus = (r: IRemision) => (
        <span className={`rem-status rem-status--${r.status}`}>{REMISION_STATUS_LABELS[r.status as RemisionStatus] ?? r.status}</span>
    );

    const renderTable = () => (
        <div className="remisiones-table-container ds-table-container">
            <table className="remisiones-table ds-table">
                <thead>
                    <tr>
                        <th>Remisión</th>
                        <th>Origen</th>
                        <th>Cliente</th>
                        <th>Fecha</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedRemisiones.map((r) => (
                        <tr key={r._id}>
                            <td data-label="Remisión">{r.number}</td>
                            <td data-label="Origen">{sourceLabel(r)}</td>
                            <td data-label="Cliente">{r.client_name || "—"}</td>
                            <td data-label="Fecha">{formatDate(r.createdAt)}</td>
                            <td data-label="Total">{formatCOP(r.total)}</td>
                            <td data-label="Estado">{renderStatus(r)}</td>
                            <td data-label="Acciones">{renderActions(r)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="remisiones-list-view">
            {displayedRemisiones.map((r) => (
                <article key={r._id} className="remisiones-list-item">
                    <div className="remisiones-list-item__body">
                        <div className="remisiones-list-item__head">
                            <strong className="remisiones-list-item__number">{r.number}</strong>
                            {renderStatus(r)}
                        </div>
                        <div className="remisiones-list-item__main">
                            <p className="remisiones-list-item__client">{r.client_name || "—"}</p>
                            <p className="remisiones-list-item__source">Origen: {sourceLabel(r)}</p>
                        </div>
                        <dl className="remisiones-list-item__fields">
                            <div className="remisiones-list-item__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(r.createdAt)}</dd>
                            </div>
                            <div className="remisiones-list-item__field">
                                <dt>Total</dt>
                                <dd className="remisiones-list-item__total">{formatCOP(r.total)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="remisiones-list-item__actions">{renderActions(r, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="remisiones-cards-view">
            {displayedRemisiones.map((r) => (
                <article key={r._id} className="remisiones-card">
                    <div className="remisiones-card__body">
                        <div className="remisiones-card__header">
                            <strong className="remisiones-card__number">{r.number}</strong>
                            {renderStatus(r)}
                        </div>
                        <div className="remisiones-card__main">
                            <p className="remisiones-card__client">{r.client_name || "—"}</p>
                            <span className="remisiones-card__source">{sourceLabel(r)}</span>
                        </div>
                        <dl className="remisiones-card__fields">
                            <div className="remisiones-card__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(r.createdAt)}</dd>
                            </div>
                            <div className="remisiones-card__field">
                                <dt>Total</dt>
                                <dd className="remisiones-card__total">{formatCOP(r.total)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="remisiones-card__actions">{renderActions(r, "cards")}</footer>
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
            <FilterField label="Estado" htmlFor="remisiones-filter-status" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="remisiones-filter-status"
                                            value={statusFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setStatusFilter(value);
                                                updateFiltersInQuery({ status: value });
                                            }}
                                        >
                                            <option value="">Todas</option>
                                            {Object.entries(REMISION_STATUS_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Búsqueda" htmlFor="remisiones-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="remisiones-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Remisión o cliente"
                                        />
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="remisiones-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="remisiones-filters-panel__head">
                <h2 id="remisiones-filters-heading" className="remisiones-filters-panel__title">
                    Filtrar remisiones
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="remisiones-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="remisiones-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="remisiones-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="remisiones-filters-clear remisiones-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="remisiones-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`remisiones-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="remisiones-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="remisiones-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line remisiones-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="remisiones-filters-panel"
                            className="remisiones-filters-panel remisiones-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="remisiones-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="remisiones-page">
            <ListPageContainer className="remisiones-container">
                <div className="remisiones-sticky-head">
                    <ListPageHeader
                        className="remisiones-header"
                        title="Remisiones"
                        subtitle="Entregas que el cliente firma. Genera una remisión desde una factura o cotización."
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar remisiones"
    ariaLabelledBy="remisiones-filters-heading-mobile"
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
                    emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                />

                {loading ? (
                    <div className="page-loading">
                        <p>Cargando remisiones...</p>
                    </div>
                ) : remisiones.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay remisiones. Genera una desde una factura o cotización (botón &quot;Remisión&quot;).</p>
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
                            isFetching={isPageFetching}
                            onPageChange={handlePageChange}
                            emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <RemisionActionModals
                action={pendingAction}
                loading={actionLoading}
                onClose={closeRemisionAction}
                onSend={handleConfirmSend}
                onDelete={handleConfirmDelete}
                sourceLabel={sourceLabel}
            />
        </ListPageShell>
    );
};

export default RemisionesPage;

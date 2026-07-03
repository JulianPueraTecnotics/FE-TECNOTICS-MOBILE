import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import "./Quotes.css";
import type { IQuote } from "../../../types";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "../../../types";
import { PATHS } from "../../../router/paths.contants";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    getAllQuotes,
    searchQuotes,
    deleteQuote,
    sendQuoteEmail,
    downloadQuoteById,
    convertQuoteToInvoice,
} from "../../../services/quotes.service";
import { createRemision } from "../../../services/remisiones.service";
import { formatCOP } from "../quotes.utils";
import QuoteActionModals, { type QuoteActionKind, type QuoteActionState } from "../components/QuoteActionModals";
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

const statusClass = (status: QuoteStatus): string => `quote-status quote-status--${status}`;

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "creacion", label: "Creación", type: "date", icon: "ri-calendar-line" },
    { id: "vence", label: "Vence", type: "date", icon: "ri-calendar-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
];

const QuotesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const statusFromUrl = searchParams.get("status") ?? "";
    const qFromUrl = searchParams.get("q") ?? "";

    const [quotes, setQuotes] = useState<IQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [statusFilter, setStatusFilter] = useState(statusFromUrl);
    const [filterSearch, setFilterSearch] = useState(qFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [totalAmount, setTotalAmount] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => statusFromUrl !== "" || qFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

    useRealtime(RealtimeEvents.QUOTE_CHANGED, (payload) => setQuotes((prev) => applyRealtimeChange(prev, payload)));

    const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);
    const [pendingAction, setPendingAction] = useState<QuoteActionState>(null);
    const [actionLoading, setActionLoading] = useState(false);

    const getRowFilterValue = useCallback((row: IQuote, filterId: string): string => {
        switch (filterId) {
            case "creacion": return toIsoDate(row.created_at);
            case "vence": return toIsoDate(row.valid_until);
            case "total": return String(row.totals?.total ?? 0);
            default: return "";
        }
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const displayedQuotes = filterRows(quotes);

    const hasActiveFilters = statusFilter.trim() !== "" || filterSearch.trim() !== "" || hasActiveClientFilters;

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

    const updateFiltersInQuery = (updates: { status?: string; q?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.status !== undefined) {
                const v = updates.status.trim();
                if (!v) params.delete("status");
                else params.set("status", v);
            }
            if (updates.q !== undefined) {
                const v = updates.q.trim();
                if (!v) params.delete("q");
                else params.set("q", v);
            }
            return params;
        });
        setPage(1);
    };

    const clearFilters = () => {
        setStatusFilter("");
        setFilterSearch("");
        clearColFilters();
        updateFiltersInQuery({ status: "", q: "" });
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
        const t = window.setTimeout(() => updateFiltersInQuery({ q: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        const hasData = quotes.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q
                    ? await searchQuotes(q, page, pageSize)
                    : await getAllQuotes(page, pageSize, statusFilter ? { status: statusFilter } : undefined);
                if (ignore || !response) return;
                setQuotes(response.quotes ?? []);
                setTotalPages(response.pagination?.totalPages ?? 1);
                setTotalItems(response.pagination?.total ?? 0);
                setTotalAmount(typeof response.total_amount === "number" ? response.total_amount : null);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las cotizaciones");
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

    useEffect(() => {
        if (page !== pageFromUrl) setPage(pageFromUrl);
        if (pageSize !== limitFromUrl) setPageSize(limitFromUrl);
        if (statusFilter !== statusFromUrl) setStatusFilter(statusFromUrl);
        if (filterSearch !== qFromUrl) setFilterSearch(qFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageFromUrl, limitFromUrl, statusFromUrl, qFromUrl]);

    const handleOpenCreateModal = () => navigate(PATHS.SALES_COTIZACIONES_NUEVA);
    const handleOpenEditModal = (q: IQuote) => {
        navigate(PATHS.SALES_COTIZACIONES_EDITAR(q._id));
    };

    const openQuoteAction = (kind: QuoteActionKind, q: IQuote) => {
        setPendingAction({ kind, quote: q });
    };

    const closeQuoteAction = () => {
        if (actionLoading) return;
        setPendingAction(null);
    };

    const handleConfirmSend = async (extraRecipients: string) => {
        if (!pendingAction || pendingAction.kind !== "send") return;
        const q = pendingAction.quote;
        const recipients = extraRecipients
            .split(",")
            .map((e) => e.trim())
            .filter(Boolean);
        setActionLoading(true);
        try {
            await sendQuoteEmail(q._id, recipients.length ? recipients : undefined);
            successToast("Cotización enviada por correo");
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar la cotización");
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmConvert = async () => {
        if (!pendingAction || pendingAction.kind !== "convert") return;
        const q = pendingAction.quote;
        setActionLoading(true);
        try {
            await convertQuoteToInvoice(q._id);
            successToast("Cotización convertida en factura (borrador)");
            setRefreshKey((k) => k + 1);
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo convertir la cotización");
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmRemision = async () => {
        if (!pendingAction || pendingAction.kind !== "remision") return;
        const q = pendingAction.quote;
        setActionLoading(true);
        try {
            await createRemision({ source: "quote", source_id: q._id, send_email: true });
            successToast("Remisión generada y enviada al cliente para firma");
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo generar la remisión");
        } finally {
            setActionLoading(false);
        }
    };

    const handleConfirmDelete = async () => {
        if (!pendingAction || pendingAction.kind !== "delete") return;
        const q = pendingAction.quote;
        setActionLoading(true);
        try {
            await deleteQuote(q._id);
            successToast("Cotización eliminada exitosamente");
            if (quotes.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setPendingAction(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar la cotización");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDownload = async (q: IQuote) => {
        setRowBusy({ id: q._id, action: "download" });
        try {
            const res = await downloadQuoteById(q._id);
            const uri = res?.data_uri || (res?.base64_quote ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_quote}` : null);
            if (!uri) throw new Error("La respuesta no contiene el PDF");
            const link = document.createElement("a");
            link.href = uri;
            link.download = res?.file_name || `${q.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo descargar la cotización");
        } finally {
            setRowBusy(null);
        }
    };

    const isRowBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;
    const rowLocked = (id: string) => rowBusy?.id === id || (pendingAction?.quote._id === id && actionLoading);

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderStatus = (q: IQuote) => (
        <span className={statusClass(q.status)}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</span>
    );

    const renderActions = (q: IQuote, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions quotes-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => handleOpenEditModal(q)} disabled={rowLocked(q._id)}>
                <i className="ri-edit-line" aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Enviar por correo" onClick={() => openQuoteAction("send", q)} disabled={rowLocked(q._id)}>
                <i className="ri-mail-send-line" aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Descargar PDF" onClick={() => handleDownload(q)} disabled={rowLocked(q._id)}>
                <i className={isRowBusy(q._id, "download") ? "ri-loader-4-line rotating" : "ri-download-line"} aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Generar remisión (firma del cliente)" onClick={() => openQuoteAction("remision", q)} disabled={rowLocked(q._id)}>
                <i className="ri-truck-line" aria-hidden />
            </button>
            {q.status !== "invoiced" && (
                <button type="button" className="btn-action" title="Convertir en factura" onClick={() => openQuoteAction("convert", q)} disabled={rowLocked(q._id)}>
                    <i className="ri-file-transfer-line" aria-hidden />
                </button>
            )}
            <button type="button" className="btn-action" title="Eliminar" onClick={() => openQuoteAction("delete", q)} disabled={rowLocked(q._id)}>
                <i className="ri-delete-bin-line" aria-hidden />
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="quotes-table-container ds-table-container">
            <table className="quotes-table ds-table">
                <thead>
                    <tr>
                        <th>Número</th>
                        <th>Cliente</th>
                        <th>Creación</th>
                        <th>Vence</th>
                        <th>Total</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedQuotes.map((q) => (
                        <tr key={q._id}>
                            <td data-label="Número">{q.number}</td>
                            <td data-label="Cliente">{q.client_name || "—"}</td>
                            <td data-label="Creación">{formatDate(q.created_at)}</td>
                            <td data-label="Vence">{formatDate(q.valid_until)}</td>
                            <td data-label="Total">{formatCOP(q.totals?.total)}</td>
                            <td data-label="Estado">{renderStatus(q)}</td>
                            <td data-label="Acciones">{renderActions(q)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="quotes-list-view">
            {displayedQuotes.map((q) => (
                <article key={q._id} className="quotes-list-item">
                    <div className="quotes-list-item__body">
                        <div className="quotes-list-item__head">
                            <strong className="quotes-list-item__number">{q.number}</strong>
                            {renderStatus(q)}
                        </div>
                        <div className="quotes-list-item__main">
                            <p className="quotes-list-item__client">{q.client_name || "—"}</p>
                        </div>
                        <dl className="quotes-list-item__fields">
                            <div className="quotes-list-item__field">
                                <dt>Creación</dt>
                                <dd>{formatDate(q.created_at)}</dd>
                            </div>
                            <div className="quotes-list-item__field">
                                <dt>Vence</dt>
                                <dd>{formatDate(q.valid_until)}</dd>
                            </div>
                            <div className="quotes-list-item__field">
                                <dt>Total</dt>
                                <dd className="quotes-list-item__total">{formatCOP(q.totals?.total)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="quotes-list-item__actions">{renderActions(q, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="quotes-cards-view">
            {displayedQuotes.map((q) => (
                <article key={q._id} className="quotes-card">
                    <div className="quotes-card__body">
                        <div className="quotes-card__header">
                            <strong className="quotes-card__number">{q.number}</strong>
                            {renderStatus(q)}
                        </div>
                        <div className="quotes-card__main">
                            <p className="quotes-card__client">{q.client_name || "—"}</p>
                        </div>
                        <dl className="quotes-card__fields">
                            <div className="quotes-card__field">
                                <dt>Vence</dt>
                                <dd>{formatDate(q.valid_until)}</dd>
                            </div>
                            <div className="quotes-card__field">
                                <dt>Total</dt>
                                <dd className="quotes-card__total">{formatCOP(q.totals?.total)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="quotes-card__actions">{renderActions(q, "cards")}</footer>
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
            <FilterField label="Estado" htmlFor="quotes-filter-status" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="quotes-filter-status"
                                            value={statusFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setStatusFilter(value);
                                                updateFiltersInQuery({ status: value });
                                            }}
                                        >
                                            <option value="">Todos los estados</option>
                                            {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                                                <option key={value} value={value}>
                                                    {label}
                                                </option>
                                            ))}
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Búsqueda" htmlFor="quotes-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="quotes-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Número o cliente"
                                        />
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="quotes-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="quotes-filters-panel__head">
                <h2 id="quotes-filters-heading" className="quotes-filters-panel__title">
                    Filtrar cotizaciones
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="quotes-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="quotes-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="quotes-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="quotes-filters-clear quotes-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="quotes-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`quotes-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="quotes-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="quotes-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line quotes-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="quotes-filters-panel"
                            className="quotes-filters-panel quotes-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="quotes-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="quotes-page">
            <ListPageContainer className="quotes-container">
                <div className="quotes-sticky-head">
                    <ListPageHeader
                        className="quotes-header"
                        title="Cotizaciones"
                        subtitle="Crea cotizaciones y conviértelas en factura cuando el cliente acepte"
                        actions={
                            <button type="button" className="btn-primary" onClick={handleOpenCreateModal}>
                                <i className="ri-add-line" aria-hidden />
                                Nueva Cotización
                            </button>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar cotizaciones"
    ariaLabelledBy="quotes-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                {totalAmount !== null && (
                    <div className="quotes-summary">
                        Total cotizado: <strong>{formatCOP(totalAmount)}</strong>
                    </div>
                )}

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
                        <p>Cargando cotizaciones...</p>
                    </div>
                ) : quotes.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay cotizaciones para mostrar</p>
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

            <QuoteActionModals
                action={pendingAction}
                loading={actionLoading}
                onClose={closeQuoteAction}
                onSend={handleConfirmSend}
                onConvert={handleConfirmConvert}
                onRemision={handleConfirmRemision}
                onDelete={handleConfirmDelete}
            />
        </ListPageShell>
    );
};

export default QuotesPage;

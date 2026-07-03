import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Recaudos.css";
import type { ReceivableInvoice, ReceivablesSummary } from "../../../types";
import { RECEIVABLE_STATUS_LABELS, type ReceivableStatus } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getReceivables, getReceivablesSummary } from "../../../services/recaudos.service";
import { downloadInvoiceById } from "../../../services/invoices.service";
import { formatCOP, formatDateCO } from "../../../utils/format";
import { successToast } from "../../../components/shared/toast/toasts";
import PaymentModal from "../../../components/modals/PaymentModal/PaymentModal";
import BatchPaymentModal from "../../../components/modals/BatchPaymentModal/BatchPaymentModal";
import ReceiptsModal from "../../../components/modals/ReceiptsModal/ReceiptsModal";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
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

const statusClass = (status: ReceivableStatus): string => `recaudo-status recaudo-status--${status}`;

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "emision", label: "Emisión", type: "date", icon: "ri-calendar-line" },
    { id: "vence", label: "Vence", type: "date", icon: "ri-calendar-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "abonado", label: "Abonado", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "saldo", label: "Saldo", type: "number", icon: "ri-money-dollar-circle-line" },
];

const RecaudosPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const statusFromUrl = searchParams.get("status") ?? "";
    const clienteFromUrl = searchParams.get("cliente") ?? "";
    const facturaFromUrl = searchParams.get("factura") ?? "";
    const overdueFromUrl = searchParams.get("overdue") === "1";

    const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
    const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterCliente, setFilterCliente] = useState(clienteFromUrl);
    const [filterFactura, setFilterFactura] = useState(facturaFromUrl);
    const [statusFilter, setStatusFilter] = useState(statusFromUrl);
    const [overdueOnly, setOverdueOnly] = useState(overdueFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(
        () => statusFromUrl !== "" || clienteFromUrl !== "" || facturaFromUrl !== "" || overdueFromUrl,
    );
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedCliente = useDebouncedValue(filterCliente, FILTER_DEBOUNCE_MS);
    const debouncedFactura = useDebouncedValue(filterFactura, FILTER_DEBOUNCE_MS);

    const searchClienteApi = useMemo(() => {
        const parts = [debouncedCliente.trim(), debouncedFactura.trim()].filter(Boolean);
        return parts.join(" ").trim() || undefined;
    }, [debouncedCliente, debouncedFactura]);

    useRealtime(RealtimeEvents.RECAUDO_CHANGED, () => setRefreshKey((k) => k + 1));

    const [payInvoice, setPayInvoice] = useState<ReceivableInvoice | null>(null);
    const [receiptsInvoice, setReceiptsInvoice] = useState<ReceivableInvoice | null>(null);
    const [viewingPdfId, setViewingPdfId] = useState<string | null>(null);
    const [batchOpen, setBatchOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const getRowFilterValue = useCallback((row: ReceivableInvoice, filterId: string): string => {
        switch (filterId) {
            case "emision": return toIsoDate(row.issued_at);
            case "vence": return toIsoDate(row.due_date);
            case "total": return String(row.total ?? 0);
            case "abonado": return String(row.paid ?? 0);
            case "saldo": return String(row.balance ?? 0);
            default: return "";
        }
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const displayedInvoices = filterRows(invoices);

    const hasActiveFilters =
        statusFilter.trim() !== "" || filterCliente.trim() !== "" || filterFactura.trim() !== "" || overdueOnly || hasActiveClientFilters;

    const handleViewInvoice = async (inv: ReceivableInvoice) => {
        setViewingPdfId(inv._id);
        try {
            const res = await downloadInvoiceById(inv._id);
            const uri = res?.data_uri || (res?.base64_factura ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_factura}` : null);
            if (!uri) {
                errorToast("La factura no tiene PDF disponible");
                return;
            }
            const bin = atob(uri.split(",")[1]);
            const bytes = new Uint8Array(bin.length);
            for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
            const blobUrl = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
            window.open(blobUrl, "_blank");
            successToast("Factura abierta");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo abrir la factura");
        } finally {
            setViewingPdfId(null);
        }
    };

    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                if (next.size === 0) {
                    setFilterCliente("");
                    setFilterFactura("");
                }
            } else {
                next.add(id);
                if (prev.size === 0) {
                    const inv = invoices.find((i) => i._id === id);
                    const term = inv?.client_doc || inv?.client_name;
                    if (term && filterCliente.trim() !== term) setFilterCliente(term);
                }
            }
            return next;
        });

    const selectedInvoices = invoices.filter((i) => selectedIds.has(i._id));
    const clientKey = (i: ReceivableInvoice) => i.client_doc || i.client_name || "";
    const lockedClient = selectedInvoices.length > 0 ? clientKey(selectedInvoices[0]) : null;
    const isSelectable = (i: ReceivableInvoice) => i.balance > 0 && (lockedClient === null || clientKey(i) === lockedClient);
    const selectableInvoices = invoices.filter(isSelectable);
    const allSelected = selectableInvoices.length > 0 && selectableInvoices.every((i) => selectedIds.has(i._id));
    const toggleSelectAll = () =>
        setSelectedIds(allSelected ? new Set() : new Set(selectableInvoices.map((i) => i._id)));

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

    const updateFiltersInQuery = (updates: { status?: string; cliente?: string; factura?: string; overdue?: boolean }) => {
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
            if (updates.factura !== undefined) {
                const v = updates.factura.trim();
                if (!v) params.delete("factura");
                else params.set("factura", v);
            }
            if (updates.overdue !== undefined) {
                if (updates.overdue) params.set("overdue", "1");
                else params.delete("overdue");
            }
            return params;
        });
        setPage(1);
    };

    const clearFilters = () => {
        setStatusFilter("");
        setFilterCliente("");
        setFilterFactura("");
        setOverdueOnly(false);
        clearColFilters();
        updateFiltersInQuery({ status: "", cliente: "", factura: "", overdue: false });
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(920, window.innerWidth - 32);
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, statusFilter, filterCliente, filterFactura, overdueOnly]);

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

    const handlePaymentSuccess = () => {
        setSelectedIds(new Set());
        setFilterCliente("");
        setFilterFactura("");
        setRefreshKey((k) => k + 1);
    };

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
                params.delete("page");
                return params;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedCliente, debouncedFactura, statusFilter, overdueOnly, pageSize]);

    useEffect(() => {
        const t = window.setTimeout(() => updateFiltersInQuery({ cliente: debouncedCliente }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedCliente]);

    useEffect(() => {
        const t = window.setTimeout(() => updateFiltersInQuery({ factura: debouncedFactura }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedFactura]);

    useEffect(() => {
        let ignore = false;
        const hasData = invoices.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const response = await getReceivables(page, pageSize, {
                    status: statusFilter || undefined,
                    cliente: searchClienteApi,
                    overdue: overdueOnly || undefined,
                });
                if (ignore || !response) return;
                setInvoices(response.invoices);
                setTotalPages(response.pagination.totalPages || 1);
                setTotalItems(response.pagination.total ?? 0);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las facturas por cobrar");
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
    }, [page, pageSize, searchClienteApi, statusFilter, overdueOnly, refreshKey]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const s = await getReceivablesSummary();
                if (!ignore && s) setSummary(s);
            } catch {
                /* opcional */
            }
        })();
        return () => {
            ignore = true;
        };
    }, [refreshKey]);

    useEffect(() => {
        if (page !== pageFromUrl) setPage(pageFromUrl);
        if (pageSize !== limitFromUrl) setPageSize(limitFromUrl);
        if (statusFilter !== statusFromUrl) setStatusFilter(statusFromUrl);
        if (filterCliente !== clienteFromUrl) setFilterCliente(clienteFromUrl);
        if (filterFactura !== facturaFromUrl) setFilterFactura(facturaFromUrl);
        if (overdueOnly !== overdueFromUrl) setOverdueOnly(overdueFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageFromUrl, limitFromUrl, statusFromUrl, clienteFromUrl, facturaFromUrl, overdueFromUrl]);

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderSelectCheckbox = (inv: ReceivableInvoice) => (
        <input
            type="checkbox"
            checked={selectedIds.has(inv._id)}
            onChange={() => toggleSelect(inv._id)}
            disabled={inv.balance <= 0 || (!selectedIds.has(inv._id) && !isSelectable(inv))}
            title={
                !selectedIds.has(inv._id) && lockedClient !== null && clientKey(inv) !== lockedClient
                    ? "Solo puedes recaudar facturas del mismo cliente en un pago"
                    : undefined
            }
            aria-label={`Seleccionar ${inv.number}`}
        />
    );

    const renderInvoiceActions = (inv: ReceivableInvoice, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions recaudos-actions--${layout}`}>
            {inv.balance > 0 && (
                <button type="button" className="btn-pay" onClick={() => setPayInvoice(inv)} title="Registrar pago">
                    <i className="ri-money-dollar-circle-line" aria-hidden />
                    Recaudar
                </button>
            )}
            <button
                type="button"
                className="btn-action"
                title="Ver factura (referencia)"
                onClick={() => handleViewInvoice(inv)}
                disabled={viewingPdfId === inv._id}
            >
                <i className={viewingPdfId === inv._id ? "ri-loader-4-line rotating" : "ri-file-text-line"} aria-hidden />
            </button>
            <button type="button" className="btn-action" title="Comprobantes de ingreso" onClick={() => setReceiptsInvoice(inv)}>
                <i className="ri-receipt-line" aria-hidden />
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="recaudos-table-container ds-table-container">
            <table className="recaudos-table ds-table">
                <thead>
                    <tr>
                        <th className="recaudos-col-check">
                            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} aria-label="Seleccionar todas" />
                        </th>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Emisión</th>
                        <th>Vence</th>
                        <th>Total</th>
                        <th>Abonado</th>
                        <th>Saldo</th>
                        <th>Estado</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedInvoices.map((inv) => (
                        <tr key={inv._id} className={selectedIds.has(inv._id) ? "recaudos-row--selected" : ""}>
                            <td data-label="" className="recaudos-col-check">
                                {renderSelectCheckbox(inv)}
                            </td>
                            <td data-label="Factura">{inv.number}</td>
                            <td data-label="Cliente">{inv.client_name || "—"}</td>
                            <td data-label="Emisión">{formatDateCO(inv.issued_at)}</td>
                            <td data-label="Vence">{formatDateCO(inv.due_date)}</td>
                            <td data-label="Total">{formatCOP(inv.total)}</td>
                            <td data-label="Abonado">{formatCOP(inv.paid)}</td>
                            <td data-label="Saldo">
                                <strong>{formatCOP(inv.balance)}</strong>
                                {(inv.nota_credito ?? 0) > 0 && (
                                    <small className="recaudos-nc-hint" title="Nota crédito aplicada">
                                        NC −{formatCOP(inv.nota_credito)}
                                    </small>
                                )}
                            </td>
                            <td data-label="Estado">
                                <span className={statusClass(inv.status)}>{RECEIVABLE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                            </td>
                            <td data-label="Acciones">{renderInvoiceActions(inv)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="recaudos-list-view">
            {displayedInvoices.map((inv) => (
                <article key={inv._id} className={`recaudos-list-item ${selectedIds.has(inv._id) ? "recaudos-list-item--selected" : ""}`}>
                    <div className="recaudos-list-item__body">
                        <div className="recaudos-list-item__head">
                            <label className="recaudos-list-item__check">{renderSelectCheckbox(inv)}</label>
                            <span className={statusClass(inv.status)}>{RECEIVABLE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                        </div>
                        <div className="recaudos-list-item__main">
                            <p className="recaudos-list-item__client">{inv.client_name || "—"}</p>
                            <p className="recaudos-list-item__number">{inv.number}</p>
                        </div>
                        <dl className="recaudos-list-item__fields">
                            <div className="recaudos-list-item__field">
                                <dt>Emisión</dt>
                                <dd>{formatDateCO(inv.issued_at)}</dd>
                            </div>
                            <div className="recaudos-list-item__field">
                                <dt>Vence</dt>
                                <dd>{formatDateCO(inv.due_date)}</dd>
                            </div>
                            <div className="recaudos-list-item__field">
                                <dt>Saldo</dt>
                                <dd className="recaudos-list-item__balance">{formatCOP(inv.balance)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="recaudos-list-item__actions">{renderInvoiceActions(inv, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="recaudos-cards-view">
            {displayedInvoices.map((inv) => (
                <article key={inv._id} className={`recaudos-card ${selectedIds.has(inv._id) ? "recaudos-card--selected" : ""}`}>
                    <div className="recaudos-card__body">
                        <div className="recaudos-card__header">
                            <label className="recaudos-card__check">{renderSelectCheckbox(inv)}</label>
                            <span className={statusClass(inv.status)}>{RECEIVABLE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                        </div>
                        <div className="recaudos-card__main">
                            <strong className="recaudos-card__number">{inv.number}</strong>
                            <p className="recaudos-card__client">{inv.client_name || "—"}</p>
                        </div>
                        <dl className="recaudos-card__fields">
                            <div className="recaudos-card__field">
                                <dt>Vence</dt>
                                <dd>{formatDateCO(inv.due_date)}</dd>
                            </div>
                            <div className="recaudos-card__field">
                                <dt>Saldo</dt>
                                <dd className="recaudos-card__balance">{formatCOP(inv.balance)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="recaudos-card__actions">{renderInvoiceActions(inv, "cards")}</footer>
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
            <FilterField label="Estado" htmlFor="recaudos-filter-status" icon="ri-filter-3-line">
                                        <FieldControl
                                            as="select"
                                            id="recaudos-filter-status"
                                            value={statusFilter}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setStatusFilter(value);
                                                updateFiltersInQuery({ status: value });
                                            }}
                                        >
                                            <option value="">Todas por cobrar</option>
                                            <option value="pendiente">Pendientes</option>
                                            <option value="parcial">Abonadas</option>
                                            <option value="vencida">Vencidas</option>
                                            <option value="pagada">Pagadas</option>
                                        </FieldControl>
                                    </FilterField>
                                    <FilterField label="Cliente" htmlFor="recaudos-filter-cliente" icon="ri-user-search-line">
                                        <FieldControl
                                            id="recaudos-filter-cliente"
                                            type="text"
                                            value={filterCliente}
                                            onChange={(e) => setFilterCliente(e.target.value)}
                                            placeholder="Nombre o documento"
                                        />
                                    </FilterField>
                                    <FilterField label="Nº factura" htmlFor="recaudos-filter-factura" icon="ri-hashtag">
                                        <FieldControl
                                            id="recaudos-filter-factura"
                                            type="text"
                                            value={filterFactura}
                                            onChange={(e) => setFilterFactura(e.target.value)}
                                            placeholder="Ej. FEM-123"
                                        />
                                    </FilterField>
                                    <FilterField label="Vencimiento" htmlFor="recaudos-filter-overdue" icon="ri-alarm-warning-line">
                                        <FieldControl
                                            as="select"
                                            id="recaudos-filter-overdue"
                                            value={overdueOnly ? "1" : ""}
                                            onChange={(e) => {
                                                const only = e.target.value === "1";
                                                setOverdueOnly(only);
                                                updateFiltersInQuery({ overdue: only });
                                            }}
                                        >
                                            <option value="">Todas</option>
                                            <option value="1">Solo vencidas</option>
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="recaudos-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="recaudos-filters-panel__head">
                <h2 id="recaudos-filters-heading" className="recaudos-filters-panel__title">
                    Filtrar recaudos
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="recaudos-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="recaudos-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="recaudos-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="recaudos-filters-clear recaudos-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="recaudos-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`recaudos-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="recaudos-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="recaudos-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line recaudos-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="recaudos-filters-panel"
                            className="recaudos-filters-panel recaudos-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="recaudos-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="recaudos-page">
            <ListPageContainer className="recaudos-container">
                <div className="recaudos-sticky-head">
                    <ListPageHeader
                        className="recaudos-header"
                        title="Recaudos"
                        subtitle="Carga los pagos de tus facturas y envía el comprobante de ingreso al cliente"
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar recaudos"
    ariaLabelledBy="recaudos-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                <div className="recaudos-summary">
                    <div className="recaudo-kpi">
                        <span className="recaudo-kpi__label">Total por cobrar</span>
                        <span className="recaudo-kpi__value">{summary ? formatCOP(summary.total_por_cobrar) : "—"}</span>
                    </div>
                    <div className="recaudo-kpi recaudo-kpi--overdue">
                        <span className="recaudo-kpi__label">Vencido</span>
                        <span className="recaudo-kpi__value">{summary ? formatCOP(summary.total_vencido) : "—"}</span>
                    </div>
                    <div className="recaudo-kpi">
                        <span className="recaudo-kpi__label">Facturas</span>
                        <span className="recaudo-kpi__value">{summary ? summary.cantidad_facturas : "—"}</span>
                    </div>
                </div>

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
                        <p>Cargando facturas...</p>
                    </div>
                ) : (
                    <>
                        {selectedIds.size > 0 && invoices.length > 0 && (
                            <div className="recaudos-selbar">
                                <span>
                                    {selectedIds.size} factura(s) de <strong>{selectedInvoices[0]?.client_name}</strong> ·{" "}
                                    <strong>{formatCOP(selectedInvoices.reduce((s, i) => s + i.balance, 0))}</strong>
                                </span>
                                <div className="recaudos-selbar-actions">
                                    <button
                                        type="button"
                                        className="btn-link"
                                        onClick={() => {
                                            setSelectedIds(new Set());
                                            setFilterCliente("");
                                            setFilterFactura("");
                                        }}
                                    >
                                        Limpiar
                                    </button>
                                    <button type="button" className="btn-pay" onClick={() => setBatchOpen(true)}>
                                        <i className="ri-money-dollar-circle-line" aria-hidden />
                                        Recaudar seleccionadas
                                    </button>
                                </div>
                            </div>
                        )}
                        {invoices.length === 0 ? (
                            <div className="page-loading">
                                <p>No hay facturas por cobrar</p>
                            </div>
                        ) : (
                            renderView()
                        )}
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

            <PaymentModal isOpen={!!payInvoice} onClose={() => setPayInvoice(null)} onSuccess={handlePaymentSuccess} invoice={payInvoice} />
            <ReceiptsModal isOpen={!!receiptsInvoice} onClose={() => setReceiptsInvoice(null)} invoice={receiptsInvoice} />
            <BatchPaymentModal
                isOpen={batchOpen}
                onClose={() => setBatchOpen(false)}
                onSuccess={handlePaymentSuccess}
                invoices={selectedInvoices}
            />
        </ListPageShell>
    );
};

export default RecaudosPage;

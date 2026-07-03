import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import "./Purchases.css";
import "../components/PurchaseModals.css";
import { deletePurchase, getPurchasePdfUrl, getPurchases, setPurchaseKind, uploadPurchasePdf } from "../purchases.service";
import type { Purchase, PurchaseKind } from "../purchases.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import ImportModal from "../components/ImportModal";
import RetentionModal from "../components/RetentionModal";
import Attachments from "../../../components/shared/Attachments/Attachments";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import {
    AppModal,
    FiltersMobileDrawer,
    ListPageContainer,
    ListPageHeader,
    ListPageShell,
    PaginationToolbar,
    paginationRange,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

interface Props {
    kind: PurchaseKind;
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const DOC_LABELS: Record<string, string> = { "01": "Factura", "02": "Nota Débito", "03": "Nota Crédito", "91": "Nota Crédito", "92": "Nota Débito", "11": "Doc. Soporte" };

const formatCOP = (n: number, currency = "COP") =>
    (n || 0).toLocaleString("es-CO", { style: "currency", currency: currency || "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 });

const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const getDocumentNumber = (purchase: Purchase) => `${purchase.prefix ?? ""}${purchase.number ?? ""}` || "—";

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "tipo", label: "Tipo", type: "text", icon: "ri-file-list-3-line" },
    { id: "prefijo", label: "Prefijo", type: "text", icon: "ri-hashtag" },
    { id: "numero", label: "Número", type: "text", icon: "ri-hashtag" },
    { id: "proveedor", label: "Proveedor", type: "text", icon: "ri-user-search-line" },
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "subtotal", label: "Subtotal", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "impuestos", label: "Impuestos", type: "number", icon: "ri-percent-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "origen", label: "Origen", type: "select", icon: "ri-filter-3-line", options: [{ value: "correo", label: "Correo" }, { value: "manual", label: "Manual" }] },
];

const PurchasesPage: React.FC<Props> = ({ kind }) => {
    const isExpense = kind === "expense";
    const title = isExpense ? "Gastos" : "Compras";
    const subtitle = isExpense ? "Importa y administra tus comprobantes de gasto" : "Importa y administra tus facturas de compra de proveedores";

    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);

    const [rows, setRows] = useState<Purchase[]>([]);
    const [totalAmount, setTotalAmount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const [importOpen, setImportOpen] = useState(false);
    const [retencionOf, setRetencionOf] = useState<Purchase | null>(null);
    const [adjuntosOf, setAdjuntosOf] = useState<Purchase | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [movingId, setMovingId] = useState("");
    const [pdfBusyId, setPdfBusyId] = useState("");
    const pdfUploadFor = useRef("");
    const pdfInputRef = useRef<HTMLInputElement>(null);

    useBodyScrollLock(Boolean(adjuntosOf));

    const getRowFilterValue = useCallback((row: Purchase, filterId: string): string => {
        switch (filterId) {
            case "tipo": return DOC_LABELS[row.document_type_code ?? ""] ?? "Documento";
            case "prefijo": return row.prefix ?? "";
            case "numero": return row.number ?? "";
            case "proveedor": return row.supplier_name ?? "";
            case "fecha": return toIsoDate(row.issue_date);
            case "subtotal": return String(row.subtotal ?? 0);
            case "impuestos": return String((row.iva_total ?? 0) + (row.impuesto_consumo ?? 0));
            case "total": return String(row.total ?? 0);
            case "origen": return row.import_source === "email" ? "correo" : "manual";
            default: return "";
        }
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const displayedRows = filterRows(rows);
    const hasActiveFilters = hasActiveClientFilters;

    const handleViewPdf = async (r: Purchase) => {
        setPdfBusyId(r._id);
        try {
            const url = await getPurchasePdfUrl(r._id);
            window.open(url, "_blank");
        } catch (e) {
            const msg = e instanceof Error ? e.message : "No se pudo abrir el PDF";
            if (/no tiene pdf|no se pudo obtener/i.test(msg)) {
                pdfUploadFor.current = r._id;
                pdfInputRef.current?.click();
            } else {
                errorToast(msg);
            }
        } finally {
            setPdfBusyId("");
        }
    };

    const handlePdfFile = async (file: File | null) => {
        const id = pdfUploadFor.current;
        if (!file || !id) return;
        setPdfBusyId(id);
        try {
            const res = await uploadPurchasePdf(id, file);
            successToast(res.message || "PDF adjuntado");
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo subir el PDF");
        } finally {
            setPdfBusyId("");
            pdfUploadFor.current = "";
            if (pdfInputRef.current) pdfInputRef.current.value = "";
        }
    };

    const handleSetKind = async (r: Purchase) => {
        setMovingId(r._id);
        try {
            const target: PurchaseKind = isExpense ? "purchase" : "expense";
            const res = await setPurchaseKind(r._id, target);
            successToast(res.message);
            setRows((prev) => prev.filter((x) => x._id !== r._id));
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo reclasificar el documento");
        } finally {
            setMovingId("");
        }
    };

    useRealtime(RealtimeEvents.PURCHASE_CHANGED, (payload) => {
        const item = payload.item as Purchase | undefined;
        if (payload.action === "deleted") {
            setRows((prev) => prev.filter((r) => r._id !== payload.id));
            return;
        }
        if (item && item.kind !== kind) return;
        setRows((prev) => applyRealtimeChange(prev, payload));
    });

    useEffect(() => {
        let ignore = false;
        const hasData = rows.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);

        (async () => {
            try {
                const res = await getPurchases(kind, page, pageSize, "");
                if (ignore) return;
                setRows(res.purchases);
                setTotalAmount(res.total_amount);
                setTotalPages(res.pagination.totalPages || 1);
                setTotalItems(res.pagination.total ?? 0);
            } catch (e) {
                if (!ignore) errorToast(e instanceof Error ? e.message : "Error al cargar los documentos");
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
    }, [kind, page, pageSize, refreshKey]);

    const handlePageChange = (next: number) => {
        const safe = Math.max(1, Math.min(totalPages, next));
        setPage(safe);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safe));
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
        clearColFilters();
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deletePurchase(toDelete.id);
            successToast("Documento eliminado");
            if (rows.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setToDelete(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(560, window.innerWidth - 32);
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, colFilterValues]);

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

    const renderActions = (purchase: Purchase, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button
                type="button"
                className="btn-action"
                title="Ver / subir PDF de la factura"
                onClick={() => handleViewPdf(purchase)}
                disabled={pdfBusyId === purchase._id}
            >
                <i className={pdfBusyId === purchase._id ? "ri-loader-4-line rotating" : "ri-file-pdf-2-line"} aria-hidden />
                {layout === "table" ? "PDF" : null}
            </button>
            <button
                type="button"
                className="btn-action"
                title={purchase.total_retenido ? `Retención: ${formatCOP(purchase.total_retenido)}` : "Aplicar retención"}
                onClick={() => setRetencionOf(purchase)}
                style={purchase.total_retenido ? { color: "var(--header-accent)", borderColor: "var(--header-accent)" } : undefined}
            >
                <i className="ri-percent-line" aria-hidden />
                {layout === "table" ? "Ret." : null}
            </button>
            <button type="button" className="btn-action" title="Soportes adjuntos" onClick={() => setAdjuntosOf(purchase)}>
                <i className="ri-attachment-2" aria-hidden />
                {layout === "table" ? "Adj." : null}
            </button>
            <button
                type="button"
                className="btn-action"
                title={isExpense ? "Enviar a Compras" : "Enviar a Gastos"}
                onClick={() => handleSetKind(purchase)}
                disabled={movingId === purchase._id}
            >
                {movingId === purchase._id ? (
                    <i className="ri-loader-4-line rotating" aria-hidden />
                ) : (
                    <i className={isExpense ? "ri-shopping-bag-3-line" : "ri-wallet-line"} aria-hidden />
                )}
                {layout === "table" ? (isExpense ? "Compras" : "Gastos") : null}
            </button>
            <button
                type="button"
                className="btn-action"
                title="Eliminar"
                onClick={() => setToDelete({ id: purchase._id, label: getDocumentNumber(purchase) })}
            >
                <i className="ri-delete-bin-line" aria-hidden />
                {layout === "table" ? "Eliminar" : null}
            </button>
        </div>
    );

    const renderOrigin = (purchase: Purchase) => (
        <span className={`status-badge ${purchase.import_source === "email" ? "status-pending" : "status-paid"}`}>
            {purchase.import_source === "email" ? "Correo" : "Manual"}
        </span>
    );

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Tipo</th>
                        <th>Número</th>
                        <th>Proveedor</th>
                        <th>NIT</th>
                        <th>Fecha</th>
                        <th className="num-col">Subtotal</th>
                        <th className="num-col">IVA</th>
                        <th className="num-col">INC</th>
                        <th className="num-col">Total</th>
                        <th>Origen</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedRows.map((purchase) => (
                        <tr key={purchase._id}>
                            <td data-label="Tipo">{DOC_LABELS[purchase.document_type_code ?? ""] ?? "Documento"}</td>
                            <td data-label="Número" className="document-number">{getDocumentNumber(purchase)}</td>
                            <td data-label="Proveedor">{purchase.supplier_name}</td>
                            <td data-label="NIT">{purchase.supplier_doc}</td>
                            <td data-label="Fecha">{formatDate(purchase.issue_date)}</td>
                            <td data-label="Subtotal" className="num-col">{formatCOP(purchase.subtotal, purchase.currency)}</td>
                            <td data-label="IVA" className="num-col">{formatCOP(purchase.iva_total, purchase.currency)}</td>
                            <td data-label="INC" className="num-col">{formatCOP(purchase.impuesto_consumo ?? 0, purchase.currency)}</td>
                            <td data-label="Total" className="document-total num-col">{formatCOP(purchase.total, purchase.currency)}</td>
                            <td data-label="Origen">{renderOrigin(purchase)}</td>
                            <td data-label="Acciones">{renderActions(purchase)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedRows.map((purchase) => (
                <article key={purchase._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <div>
                                <strong className="purchases-list-item__title">{getDocumentNumber(purchase)}</strong>
                                <p className="purchases-list-item__subtitle">{DOC_LABELS[purchase.document_type_code ?? ""] ?? "Documento"}</p>
                            </div>
                            {renderOrigin(purchase)}
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{purchase.supplier_name}</strong>
                            <span>NIT {purchase.supplier_doc || "—"}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(purchase.issue_date)}</dd>
                            </div>
                            <div className="purchases-list-item__field purchases-list-item__field--highlight">
                                <dt>Total</dt>
                                <dd className="document-total">{formatCOP(purchase.total, purchase.currency)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(purchase, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedRows.map((purchase) => (
                <article key={purchase._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <div>
                            <strong className="purchases-card__title">{getDocumentNumber(purchase)}</strong>
                            <p className="purchases-card__subtitle">{DOC_LABELS[purchase.document_type_code ?? ""] ?? "Documento"}</p>
                        </div>
                        {renderOrigin(purchase)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{purchase.supplier_name}</strong>
                        <span>· NIT {purchase.supplier_doc || "—"}</span>
                    </div>
                    <dl className="purchases-card__fields">
                        <div className="purchases-card__field">
                            <dt>Fecha</dt>
                            <dd>{formatDate(purchase.issue_date)}</dd>
                        </div>
                        <div className="purchases-card__field purchases-card__field--highlight">
                            <dt>Total</dt>
                            <dd className="document-total">{formatCOP(purchase.total, purchase.currency)}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(purchase, "cards")}</footer>
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
        <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="purchases-col" />
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="purchases-filters-heading" className="purchases-filters-panel__title">
                    Filtrar {isExpense ? "gastos" : "compras"}
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="purchases-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
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
                    aria-controls="purchases-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="purchases-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line purchases-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="purchases-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="purchases-filters-heading"
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
                    <ListPageHeader
                        className="purchases-header"
                        title={title}
                        subtitle={subtitle}
                        actions={(
                            <div className="purchases-actions">
                                <button type="button" className="btn-primary" onClick={() => setImportOpen(true)}>
                                    <i className="ri-upload-cloud-2-line" aria-hidden />
                                    Importar XML / ZIP
                                </button>
                            </div>
                        )}
                    />
                </div>

                <FiltersMobileDrawer
                    open={filtersOpen && isMobile}
                    onClose={() => setFiltersOpen(false)}
                    title={`Filtrar ${isExpense ? "gastos" : "compras"}`}
                    ariaLabelledBy="purchases-filters-heading-mobile"
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

                {!loading && rows.length > 0 && (
                    <div className="purchases-summary">
                        <span>Total {isExpense ? "gastos" : "compras"} (esta vista):</span>
                        <strong>{formatCOP(totalAmount)}</strong>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>
                        Cargando documentos...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-inbox-archive-line" />
                        <p>No hay {isExpense ? "gastos" : "compras"} importados todavía.</p>
                        <button type="button" className="btn-primary" onClick={() => setImportOpen(true)}>
                            <i className="ri-upload-cloud-2-line" aria-hidden />
                            Importar XML / ZIP
                        </button>
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

            <input
                ref={pdfInputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(e) => handlePdfFile(e.target.files?.[0] ?? null)}
            />

            <ImportModal
                isOpen={importOpen}
                kind={kind}
                onClose={() => setImportOpen(false)}
                onImported={() => setRefreshKey((k) => k + 1)}
            />
            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar documento"
                message={`¿Eliminar el documento "${toDelete?.label}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                onClose={() => setToDelete(null)}
                onConfirm={handleDelete}
                loading={deleting}
            />
            <RetentionModal
                isOpen={!!retencionOf}
                purchase={retencionOf}
                onClose={() => setRetencionOf(null)}
                onApplied={() => {
                    setRetencionOf(null);
                    setRefreshKey((k) => k + 1);
                }}
            />
            {adjuntosOf && (
                <AppModal
                    title="Soportes del documento"
                    titleIcon="ri-attachment-2"
                    onClose={() => setAdjuntosOf(null)}
                    footer={
                        <button type="button" className="export-cancel" onClick={() => setAdjuntosOf(null)}>
                            Cerrar
                        </button>
                    }
                >
                    <p className="pm-hint purchases-adjuntos-meta">
                        <strong>{adjuntosOf.supplier_name}</strong>
                        <span> · {getDocumentNumber(adjuntosOf)}</span>
                    </p>
                    <Attachments entidad={isExpense ? "gasto" : "compra"} entidadId={adjuntosOf._id} hideTitle />
                </AppModal>
            )}
        </ListPageShell>
    );
};

export default PurchasesPage;

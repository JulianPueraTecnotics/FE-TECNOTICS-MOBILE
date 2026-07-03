import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getPayable, getBanks, generateBatch, getPayableSuppliers, type PayableSupplier } from "../treasury.service";
import type { PayableInvoice, Bank } from "../treasury.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { PATHS } from "../../../router/paths.contants";
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

const formatCOP = (n: number, c = "COP") => (n || 0).toLocaleString("es-CO", { style: "currency", currency: c || "COP", minimumFractionDigits: 0 });

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "proveedor", label: "Proveedor", type: "text", icon: "ri-store-2-line", serverSide: true },
    { id: "factura", label: "Factura", type: "text", icon: "ri-file-list-3-line" },
    { id: "saldo", label: "Saldo", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "pagar", label: "A pagar", type: "number", icon: "ri-hand-coin-line" },
    { id: "banco", label: "Banco proveedor", type: "select", icon: "ri-bank-card-line", options: [{ value: "ok", label: "Con datos bancarios" }, { value: "missing", label: "Sin datos bancarios" }] },
];

const TreasuryPaymentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const searchFromUrl = searchParams.get("search") ?? "";
    const proveedorFromUrl = searchParams.get("proveedor") ?? "";

    const [rows, setRows] = useState<PayableInvoice[]>([]);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(searchFromUrl);
    const [supplierId, setSupplierId] = useState(proveedorFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => searchFromUrl !== "" || proveedorFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);

    const [suppliers, setSuppliers] = useState<PayableSupplier[]>([]);
    const [selected, setSelected] = useState<Record<string, number>>({});
    const getRowFilterValue = useCallback((row: PayableInvoice, filterId: string): string => {
        switch (filterId) {
            case "proveedor": return `${row.supplier_name ?? ""} ${row.supplier_doc ?? ""}`.trim();
            case "factura": return `${row.prefix ?? ""}${row.number ?? ""}`;
            case "saldo": return String(row.balance ?? 0);
            case "pagar": return String(selected[row._id] ?? 0);
            case "banco": return row.supplier_bank.complete ? "ok" : "missing";
            default: return "";
        }
    }, [selected]);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedRows = filterRows(rows);
    const hasActiveFilters = filterSearch.trim() !== "" || supplierId.trim() !== "" || hasActiveClientFilters;

    const [bankId, setBankId] = useState("");
    const [generating, setGenerating] = useState(false);

    useRealtime(RealtimeEvents.PURCHASE_CHANGED, () => setRefreshKey((k) => k + 1));
    useRealtime(RealtimeEvents.BATCH_CHANGED, () => setRefreshKey((k) => k + 1));

    const updateQueryParams = useCallback((updates: { page?: number; limit?: number; search?: string; proveedor?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);

            if (updates.page !== undefined) {
                params.set("page", String(Math.max(1, updates.page)));
            }
            if (updates.limit !== undefined) {
                params.set("limit", String(normalizePageSize(updates.limit)));
            }
            if (updates.search !== undefined) {
                const value = updates.search.trim();
                if (value) params.set("search", value);
                else params.delete("search");
            }
            if (updates.proveedor !== undefined) {
                const value = updates.proveedor.trim();
                if (value) params.set("proveedor", value);
                else params.delete("proveedor");
            }

            return params;
        });
    }, [setSearchParams]);

    const didMountFilters = useRef(false);
    useEffect(() => {
        if (!didMountFilters.current) {
            didMountFilters.current = true;
            return;
        }
        if (page !== 1) {
            setPage(1);
            updateQueryParams({ page: 1 });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, supplierId, pageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => updateQueryParams({ search: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
    }, [debouncedSearch, updateQueryParams]);

    useEffect(() => {
        let ignore = false;
        const hasData = rows.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);

        (async () => {
            try {
                const [pay, bk] = await Promise.all([
                    getPayable(debouncedSearch.trim(), supplierId, page, pageSize),
                    getBanks(),
                ]);
                if (ignore) return;
                setRows(pay.purchases);
                setTotalPages(pay.pagination?.totalPages ?? 1);
                setTotalItems(pay.pagination?.total ?? pay.purchases.length);
                setBanks(bk.banks.filter((b) => b.active));
                setBankId((prev) => prev || (bk.banks[0]?._id ?? ""));
            } catch (e) {
                if (!ignore) errorToast(e instanceof Error ? e.message : "Error al cargar");
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
    }, [debouncedSearch, supplierId, page, pageSize, refreshKey]);

    useEffect(() => {
        getPayableSuppliers().then((r) => setSuppliers(r.suppliers)).catch(() => undefined);
    }, [refreshKey]);

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        updateQueryParams({ page: safePage });
    };

    const handlePageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setPageSize(safeSize);
        setPage(1);
        updateQueryParams({ page: 1, limit: safeSize });
    };

    const clearFilters = () => {
        setFilterSearch("");
        setSupplierId("");
        clearColFilters();
        setPage(1);
        updateQueryParams({ search: "", proveedor: "", page: 1 });
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch, supplierId]);

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

    const toggle = (inv: PayableInvoice) => {
        setSelected((prev) => {
            const next = { ...prev };
            if (next[inv._id] !== undefined) delete next[inv._id];
            else next[inv._id] = inv.balance;
            return next;
        });
    };

    const setMonto = (id: string, v: number) => setSelected((prev) => ({ ...prev, [id]: v }));

    const selectedRows = useMemo(() => rows.filter((r) => selected[r._id] !== undefined), [rows, selected]);
    const totalSelected = useMemo(() => selectedRows.reduce((acc, r) => acc + (selected[r._id] || 0), 0), [selectedRows, selected]);
    const anyMissingBank = selectedRows.some((r) => !r.supplier_bank.complete);

    const handleGenerate = async () => {
        if (!bankId) {
            errorToast("Selecciona el banco de origen");
            return;
        }
        if (!selectedRows.length) {
            errorToast("Selecciona al menos una factura");
            return;
        }
        if (anyMissingBank) {
            errorToast("Algunos proveedores seleccionados no tienen datos bancarios completos");
            return;
        }
        setGenerating(true);
        try {
            const items = selectedRows.map((r) => ({ purchase_id: r._id, monto: selected[r._id], referencia: `${r.prefix ?? ""}${r.number ?? ""}` }));
            const res = await generateBatch(bankId, items);
            successToast(res.message || "Lote generado");
            setSelected({});
            navigate(PATHS.TREASURY_LOTES);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo generar el lote");
        } finally {
            setGenerating(false);
        }
    };

    const totalPending = rows.reduce((acc, r) => acc + r.balance, 0);
    const { start, end } = paginationRange(page, pageSize, totalItems);
    const showPagination = !supplierId;

    const formatInvoice = (r: PayableInvoice) => `${r.prefix ?? ""}${r.number ?? ""}` || "—";

    const renderBankBadge = (r: PayableInvoice) =>
        r.supplier_bank.complete ? (
            <span className="status-badge status-paid">{r.supplier_bank.banco || "OK"}</span>
        ) : (
            <span className="status-badge status-pending" title="Completa los datos bancarios en Proveedores">Sin datos bancarios</span>
        );

    const renderPayInput = (r: PayableInvoice) => {
        const checked = selected[r._id] !== undefined;
        if (!checked) return <span className="treasury-pay-placeholder">—</span>;
        return (
            <FieldControl
                type="number"
                className="ds-field-input__control--compact ds-field-input__control--inline"
                value={selected[r._id]}
                min={0}
                max={r.balance}
                onChange={(e) => setMonto(r._id, Math.min(Number(e.target.value) || 0, r.balance))}
            />
        );
    };

    const renderCheckbox = (r: PayableInvoice) => {
        const checked = selected[r._id] !== undefined;
        return <input type="checkbox" checked={checked} onChange={() => toggle(r)} aria-label={`Seleccionar factura ${formatInvoice(r)}`} />;
    };

    const rowSelectedClass = (r: PayableInvoice) => (selected[r._id] !== undefined ? " purchases-list-item--selected" : "");
    const cardSelectedClass = (r: PayableInvoice) => (selected[r._id] !== undefined ? " purchases-card--selected" : "");

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container led-editable-table">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th style={{ width: 40 }}></th>
                        <th>Proveedor</th>
                        <th>Factura</th>
                        <th>Saldo</th>
                        <th>A pagar</th>
                        <th>Banco proveedor</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedRows.map((r) => (
                        <tr key={r._id} className={selected[r._id] !== undefined ? "purchases-list-item--selected" : undefined}>
                            <td data-label="">{renderCheckbox(r)}</td>
                            <td data-label="Proveedor">
                                {r.supplier_name}
                                <br />
                                <span style={{ color: "var(--text-muted)", fontSize: ".8rem" }}>{r.supplier_doc}</span>
                            </td>
                            <td data-label="Factura" className="document-number">{formatInvoice(r)}</td>
                            <td data-label="Saldo" className="document-total">{formatCOP(r.balance, r.currency)}</td>
                            <td data-label="A pagar" className="ds-num">{renderPayInput(r)}</td>
                            <td data-label="Banco proveedor">{renderBankBadge(r)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedRows.map((r) => {
                const checked = selected[r._id] !== undefined;
                return (
                    <article key={r._id} className={`purchases-list-item${rowSelectedClass(r)}`}>
                        <div className="purchases-list-item__body">
                            <div className="purchases-list-item__head">
                                <label className="purchases-list-item__head-label">
                                    {renderCheckbox(r)}
                                    <strong className="purchases-list-item__title">{r.supplier_name}</strong>
                                </label>
                                <span className="purchases-list-item__amount-badge">{formatCOP(r.balance, r.currency)}</span>
                            </div>
                            <div className="purchases-list-item__sub">
                                <strong>{formatInvoice(r)}</strong>
                                <span>NIT {r.supplier_doc}</span>
                            </div>
                            <dl className="purchases-list-item__fields">
                                <div className="purchases-list-item__field purchases-list-item__field--highlight">
                                    <dt>A pagar</dt>
                                    <dd>{renderPayInput(r)}</dd>
                                </div>
                                <div className="purchases-list-item__field">
                                    <dt>Banco proveedor</dt>
                                    <dd>{renderBankBadge(r)}</dd>
                                </div>
                            </dl>
                        </div>
                        {checked && (
                            <footer className="purchases-list-item__actions">
                                <span className="purchases-list-item__selected-note">Seleccionada para pago</span>
                            </footer>
                        )}
                    </article>
                );
            })}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedRows.map((r) => {
                const checked = selected[r._id] !== undefined;
                return (
                    <article key={r._id} className={`purchases-card${cardSelectedClass(r)}`}>
                        <div className="purchases-card__header">
                            <label className="purchases-list-item__head-label">
                                {renderCheckbox(r)}
                                <strong className="purchases-card__title">{r.supplier_name}</strong>
                            </label>
                            <span className="purchases-card__amount-badge">{formatCOP(r.balance, r.currency)}</span>
                        </div>
                        <div className="purchases-card__sub">
                            <strong>{formatInvoice(r)}</strong>
                            <span>· NIT {r.supplier_doc}</span>
                        </div>
                        <dl className="purchases-card__fields purchases-card__fields--grid">
                            <div className="purchases-card__field purchases-card__field--highlight">
                                <dt>A pagar</dt>
                                <dd>{renderPayInput(r)}</dd>
                            </div>
                            <div className="purchases-card__field">
                                <dt>Banco proveedor</dt>
                                <dd>{renderBankBadge(r)}</dd>
                            </div>
                        </dl>
                        {checked && (
                            <footer className="purchases-card__actions">
                                <span className="purchases-card__selected-note">Seleccionada</span>
                            </footer>
                        )}
                    </article>
                );
            })}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    const filterContent = (
        <>
            <FilterField label="Búsqueda" htmlFor="treasury-payments-filter-search" icon="ri-search-line">
                                        <FieldControl
                                            id="treasury-payments-filter-search"
                                            type="text"
                                            value={filterSearch}
                                            onChange={(e) => setFilterSearch(e.target.value)}
                                            placeholder="Proveedor, NIT, número..."
                                        />
                                    </FilterField>
                                    <FilterField label="Proveedor" htmlFor="treasury-payments-filter-proveedor" icon="ri-store-2-line">
                                        <FieldControl
                                            as="select"
                                            id="treasury-payments-filter-proveedor"
                                            value={supplierId}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setSupplierId(value);
                                                if (page !== 1) setPage(1);
                                                updateQueryParams({ page: 1, proveedor: value });
                                            }}
                                        >
                                            <option value="">Todos los proveedores</option>
                                            {suppliers.map((s) => (
                                                <option key={s.supplier_id} value={s.supplier_id}>
                                                    {s.supplier_name} ({s.count}) · {formatCOP(s.saldo)}
                                                </option>
                                            ))}
                                        </FieldControl>
                                    </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="treasury-payments-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="treasury-payments-filters-heading" className="purchases-filters-panel__title">
                    Filtrar facturas
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
                    onClick={() => setFiltersOpen((value) => !value)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="treasury-payments-filters-panel"
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
                            id="treasury-payments-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="treasury-payments-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    const paginationToolbarProps = {
        page,
        totalPages: showPagination ? totalPages : 1,
        totalItems,
        pageSize,
        pageSizeOptions: PAGE_SIZE_OPTIONS,
        rangeStart: start,
        rangeEnd: end,
        isFetching: isPageFetching || loading,
        onPageChange: handlePageChange,
        viewMode,
        onViewModeChange: setViewMode,
        showViewToggle: true as const,
        beforeViewToggle: filtersToolbar,
        emptyLabel: totalItems === 0 ? "Sin facturas pendientes" : undefined,
    };

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Pagos a proveedores"
                        subtitle="Selecciona las facturas a pagar y genera un lote para el banco"
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar facturas"
    ariaLabelledBy="treasury-payments-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                <PaginationToolbar
                    position="top"
                    {...paginationToolbarProps}
                    onPageSizeChange={showPagination ? handlePageSizeChange : undefined}
                />

                {!loading && rows.length > 0 && (
                    <div className="purchases-summary">
                        <span>Total por pagar:</span> <strong>{formatCOP(totalPending)}</strong>
                    </div>
                )}

                {loading ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        Cargando facturas por pagar...
                    </div>
                ) : rows.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-check-double-line" />
                        <p>No hay facturas pendientes de pago. ¡Todo al día!</p>
                    </div>
                ) : (
                    <>
                        {banks.length === 0 && (
                            <div className="purchases-summary" style={{ background: "rgba(255,159,67,.12)" }}>
                                <i className="ri-error-warning-line" style={{ color: "#e08a2b" }} />
                                <span>No tienes bancos configurados. Ve a <strong>Tesorería › Bancos</strong> para agregar la cuenta de pago.</span>
                            </div>
                        )}
                        {renderView()}
                        {showPagination && (
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
                                emptyLabel={totalItems === 0 ? "Sin facturas pendientes" : undefined}
                            />
                        )}
                    </>
                )}
            </ListPageContainer>

            {selectedRows.length > 0 && (
                <div className="treasury-actionbar">
                    <div className="treasury-actionbar__info">
                        <strong>{selectedRows.length}</strong> factura(s) · Total a pagar: <strong>{formatCOP(totalSelected)}</strong>
                        {anyMissingBank && <span className="treasury-actionbar__warn"><i className="ri-error-warning-line" /> Hay proveedores sin datos bancarios</span>}
                    </div>
                    <div className="treasury-actionbar__controls">
                        <select value={bankId} onChange={(e) => setBankId(e.target.value)}>
                            <option value="">Banco de origen…</option>
                            {banks.map((b) => (
                                <option key={b._id} value={b._id}>{b.nombre_banco} · {b.numero_cuenta}</option>
                            ))}
                        </select>
                        <button className="btn-primary" onClick={handleGenerate} disabled={generating || anyMissingBank || !bankId}>
                            <i className="ri-bank-card-line" /> {generating ? "Generando..." : "Generar lote de pago"}
                        </button>
                    </div>
                </div>
            )}
        </ListPageShell>
    );
};

export default TreasuryPaymentsPage;

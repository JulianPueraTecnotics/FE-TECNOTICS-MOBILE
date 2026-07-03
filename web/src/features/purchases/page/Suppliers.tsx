import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../purchases.service";
import type { Supplier } from "../purchases.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import SupplierModal from "../components/SupplierModal";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    FiltersMobileDrawer,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "proveedor", label: "Proveedor", type: "text", icon: "ri-user-search-line", serverSide: true },
    { id: "documento", label: "NIT / Documento", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "correo", label: "Correo", type: "text", icon: "ri-mail-line" },
    { id: "telefono", label: "Teléfono", type: "text", icon: "ri-phone-line" },
    { id: "origen", label: "Origen", type: "select", icon: "ri-filter-3-line", options: [{ value: "import", label: "Importado" }, { value: "manual", label: "Manual" }] },
];

const SuppliersPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const clienteFromUrl = searchParams.get("cliente") ?? "";

    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [filterSearch, setFilterSearch] = useState(clienteFromUrl);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const [filtersOpen, setFiltersOpen] = useState(() => clienteFromUrl !== "");
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});

    const debouncedSearch = useDebouncedValue(filterSearch, FILTER_DEBOUNCE_MS);
    const getRowFilterValue = useCallback((row: Supplier, filterId: string): string => {
        const rowDocument = row.doc_type && row.doc_number_dv
            ? `${row.doc_type} ${row.doc_number}-${row.doc_number_dv}`
            : row.doc_type
                ? `${row.doc_type} ${row.doc_number}`
                : row.doc_number;
        switch (filterId) {
            case "proveedor": return row.name ?? "";
            case "documento": return rowDocument;
            case "correo": return row.email ?? "";
            case "telefono": return row.phone ?? "";
            case "origen": return row.source ?? "";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedSuppliers = filterRows(suppliers);
    const hasActiveFilters = filterSearch.trim() !== "" || hasActiveClientFilters;

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    useRealtime(RealtimeEvents.SUPPLIER_CHANGED, (payload) => setSuppliers((prev) => applyRealtimeChange(prev, payload)));

    const updateFiltersInQuery = (updates: { cliente?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.cliente !== undefined) {
                const value = updates.cliente.trim();
                if (!value) params.delete("cliente");
                else params.set("cliente", value);
            }
            return params;
        });
        setPage(1);
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
                params.set("page", "1");
                return params;
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch, pageSize]);

    useEffect(() => {
        const timeout = window.setTimeout(() => updateFiltersInQuery({ cliente: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(timeout);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        const hasData = suppliers.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);

        (async () => {
            try {
                const response = await getAllSuppliers(page, pageSize, debouncedSearch.trim());
                if (ignore || !response) return;
                setSuppliers(response.suppliers);
                setTotalPages(response.pagination.totalPages || 1);
                setTotalItems(response.pagination.total ?? 0);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar proveedores");
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
    }, [page, pageSize, debouncedSearch, refreshKey]);

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
        updateFiltersInQuery({ cliente: "" });
        clearColFilters();
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
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterSearch]);

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

    const handleOpenCreateModal = () => {
        setEditing(null);
        setModalOpen(true);
    };

    const handleOpenEditModal = (supplier: Supplier) => {
        setEditing(supplier);
        setModalOpen(true);
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteSupplier(toDelete.id);
            successToast("Proveedor eliminado");
            if (suppliers.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setToDelete(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const handleSave = async (payload: Partial<Supplier>) => {
        if (editing) await updateSupplier(editing._id, payload);
        else await createSupplier(payload);
        successToast(editing ? "Proveedor actualizado" : "Proveedor creado");
        setModalOpen(false);
        setEditing(null);
        setRefreshKey((k) => k + 1);
    };

    const formatDocument = (supplier: Supplier): string => {
        if (supplier.doc_type && supplier.doc_number_dv) return `${supplier.doc_type} ${supplier.doc_number}-${supplier.doc_number_dv}`;
        if (supplier.doc_type) return `${supplier.doc_type} ${supplier.doc_number}`;
        return supplier.doc_number;
    };

    const renderSourceBadge = (supplier: Supplier) => (
        <span className={`status-badge ${supplier.source === "import" ? "status-pending" : "status-paid"}`}>
            {supplier.source === "import" ? "Importado" : "Manual"}
        </span>
    );

    const renderActions = (supplier: Supplier, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => handleOpenEditModal(supplier)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => setToDelete({ id: supplier._id, name: supplier.name })}>
                <i className="ri-delete-bin-line" aria-hidden />
                {layout === "table" ? "Eliminar" : null}
            </button>
        </div>
    );

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table">
                <thead>
                    <tr>
                        <th>Proveedor</th>
                        <th>NIT / Documento</th>
                        <th>Correo</th>
                        <th>Teléfono</th>
                        <th>Origen</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedSuppliers.map((supplier) => (
                        <tr key={supplier._id}>
                            <td data-label="Proveedor">{supplier.name}</td>
                            <td data-label="NIT / Documento">{formatDocument(supplier)}</td>
                            <td data-label="Correo">{supplier.email || "—"}</td>
                            <td data-label="Teléfono">{supplier.phone || "—"}</td>
                            <td data-label="Origen">{renderSourceBadge(supplier)}</td>
                            <td data-label="Acciones">{renderActions(supplier)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="purchases-list-view">
            {displayedSuppliers.map((supplier) => (
                <article key={supplier._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{supplier.name}</strong>
                            {renderSourceBadge(supplier)}
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{formatDocument(supplier)}</strong>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Correo</dt>
                                <dd>{supplier.email || "—"}</dd>
                            </div>
                            <div className="purchases-list-item__field">
                                <dt>Teléfono</dt>
                                <dd>{supplier.phone || "—"}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderActions(supplier, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="purchases-cards-view">
            {displayedSuppliers.map((supplier) => (
                <article key={supplier._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{supplier.name}</strong>
                        {renderSourceBadge(supplier)}
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{formatDocument(supplier)}</strong>
                    </div>
                    <dl className="purchases-card__fields">
                        <div className="purchases-card__field">
                            <dt>Correo</dt>
                            <dd>{supplier.email || "—"}</dd>
                        </div>
                        <div className="purchases-card__field">
                            <dt>Teléfono</dt>
                            <dd>{supplier.phone || "—"}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderActions(supplier, "cards")}</footer>
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
            <FilterField label="Búsqueda" htmlFor="suppliers-filter-search" icon="ri-search-line">
                <FieldControl
                    id="suppliers-filter-search"
                    type="text"
                    value={filterSearch}
                    onChange={(e) => setFilterSearch(e.target.value)}
                    placeholder="Proveedor, NIT"
                />
            </FilterField>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="suppliers-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="purchases-filters-panel__head">
                <h2 id="suppliers-filters-heading" className="purchases-filters-panel__title">
                    Filtrar proveedores
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
                    aria-controls="suppliers-filters-panel"
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
                            id="suppliers-filters-panel"
                            className="purchases-filters-panel purchases-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="suppliers-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="purchases-page">
            <ListPageContainer className="purchases-container">
                <div className="purchases-sticky-head">
                    <ListPageHeader
                        className="purchases-header"
                        title="Proveedores"
                        subtitle="Gestiona la agenda de proveedores de compras y gastos"
                        actions={
                            <button type="button" className="btn-primary" onClick={handleOpenCreateModal}>
                                <i className="ri-add-line" aria-hidden />
                                Nuevo proveedor
                            </button>
                        }
                    />
                </div>

                <FiltersMobileDrawer
                    open={filtersOpen && isMobile}
                    onClose={() => setFiltersOpen(false)}
                    title="Filtrar proveedores"
                    ariaLabelledBy="suppliers-filters-heading-mobile"
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
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        Cargando proveedores...
                    </div>
                ) : suppliers.length === 0 ? (
                    <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>
                        No hay proveedores para mostrar
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
                            emptyLabel={totalItems === 0 ? "Sin proveedores" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <SupplierModal
                isOpen={modalOpen}
                supplier={editing}
                onClose={() => {
                    setModalOpen(false);
                    setEditing(null);
                }}
                onSave={handleSave}
            />
            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar proveedor"
                message={`¿Eliminar a "${toDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                onClose={() => setToDelete(null)}
                onConfirm={handleDelete}
                loading={deleting}
            />
        </ListPageShell>
    );
};

export default SuppliersPage;

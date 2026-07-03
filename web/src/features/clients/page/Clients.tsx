import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import "./Clients.css";
import type { IExternUser } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllClients, searchClients, deleteClient } from "../../../services/clients.service";
import ClientModal from "../../../components/modals/ClientModal/ClientModal";
import ClientDeleteModal from "../components/ClientDeleteModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
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
    { id: "nombre", label: "Nombre", type: "text", icon: "ri-user-line" },
    { id: "documento", label: "Documento", type: "text", icon: "ri-id-card-line" },
    { id: "email", label: "Email", type: "text", icon: "ri-mail-line" },
    { id: "telefono", label: "Teléfono", type: "text", icon: "ri-phone-line" },
    { id: "direccion", label: "Dirección", type: "text", icon: "ri-map-pin-line" },
];

const ClientsPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const clienteFromUrl = searchParams.get("cliente") ?? "";

    const [clients, setClients] = useState<IExternUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
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

    const getRowFilterValue = useCallback((row: IExternUser, filterId: string): string => {
        switch (filterId) {
            case "nombre": return row.name ?? "";
            case "documento": {
                const base = row.doc_number_dv ? `${row.doc_number}-${row.doc_number_dv}` : row.doc_number;
                return `${row.doc_type ?? ""} ${base}`.trim();
            }
            case "email": return row.email ?? "";
            case "telefono": return row.phone ?? "";
            case "direccion": {
                const addr = row.address;
                if (addr == null) return "";
                if (typeof addr === "string") return addr;
                const value = (addr as { value?: string }).value ?? "";
                const zipCode = (addr as { zip_code?: string }).zip_code ?? "";
                return zipCode ? `${value} ${zipCode}` : value;
            }
            default: return "";
        }
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const apiSearchTerm = useMemo(
        () => COLUMN_FILTER_DEFS.map((d) => colFilterValues[d.id]?.trim() ?? "").find((v) => v !== "") ?? "",
        [colFilterValues],
    );
    const debouncedSearch = useDebouncedValue(apiSearchTerm, FILTER_DEBOUNCE_MS);
    const hasActiveFilters = hasActiveClientFilters;
    const displayedClients = filterRows(clients);

    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);
    const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    useRealtime(RealtimeEvents.CLIENT_CHANGED, (payload) => setClients((prev) => applyRealtimeChange(prev, payload)));

    const updateFiltersInQuery = (updates: { cliente?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            if (updates.cliente !== undefined) {
                const v = updates.cliente.trim();
                if (!v) params.delete("cliente");
                else params.set("cliente", v);
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
        const t = window.setTimeout(() => updateFiltersInQuery({ cliente: debouncedSearch }), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedSearch]);

    useEffect(() => {
        let ignore = false;
        const hasData = clients.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q ? await searchClients(q, page, pageSize) : await getAllClients(page, pageSize);
                if (ignore || !response) return;
                setClients(response.clients ?? []);
                setTotalPages(response.pagination?.totalPages ?? 1);
                setTotalItems(response.pagination?.total ?? 0);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar los clientes");
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
        clearColFilters();
        updateFiltersInQuery({ cliente: "" });
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

    const handleOpenCreateModal = () => {
        setSelectedClient(null);
        setIsClientModalOpen(true);
    };

    const handleOpenEditModal = (client: IExternUser) => {
        setSelectedClient(client);
        setIsClientModalOpen(true);
    };

    const handleCloseClientModal = () => {
        setIsClientModalOpen(false);
        setSelectedClient(null);
    };

    const handleClientSuccess = () => setRefreshKey((k) => k + 1);

    const handleOpenDeleteModal = (clientId: string, clientName: string) => {
        setClientToDelete({ id: clientId, name: clientName });
    };

    const handleCloseDeleteModal = () => {
        if (isDeleting) return;
        setClientToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (!clientToDelete) return;
        setIsDeleting(true);
        try {
            await deleteClient(clientToDelete.id);
            successToast("Cliente eliminado exitosamente");
            if (clients.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            handleCloseDeleteModal();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar el cliente");
        } finally {
            setIsDeleting(false);
        }
    };

    const formatDocument = (docType: string, docNumber: string, docDv?: string) => {
        if (docType === "Nit" && docDv) return `${docType} ${docNumber}-${docDv}`;
        return `${docType} ${docNumber}`;
    };

    const getAddressDisplay = (address: IExternUser["address"]): string => {
        if (address == null) return "N/A";
        if (typeof address === "string") return address || "N/A";
        const value = (address as { value?: string }).value ?? "";
        const zipCode = (address as { zip_code?: string }).zip_code ?? "";
        if (!value && !zipCode) return "N/A";
        return zipCode ? `${value || "Dirección sin descripción"} (CP: ${zipCode})` : value;
    };

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderActions = (client: IExternUser, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions clients-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => handleOpenEditModal(client)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
            </button>
            <button type="button" className="btn-action" title="Eliminar" onClick={() => handleOpenDeleteModal(client._id, client.name)}>
                <i className="ri-delete-bin-line" aria-hidden />
                {layout === "table" ? "Eliminar" : null}
            </button>
        </div>
    );

    const renderTable = () => (
        <div className="clients-table-container ds-table-container">
            <table className="clients-table ds-table">
                <thead>
                    <tr>
                        <th>Nombre</th>
                        <th>Documento</th>
                        <th>Email</th>
                        <th>Teléfono</th>
                        <th>Dirección</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedClients.map((client) => (
                        <tr key={client._id}>
                            <td className="client-name" data-label="Nombre">
                                {client.name}
                            </td>
                            <td data-label="Documento">
                                {formatDocument(client.doc_type, client.doc_number, client.doc_number_dv)}
                                <CopyButton value={client.doc_number_dv ? `${client.doc_number}-${client.doc_number_dv}` : client.doc_number} label="documento" />
                            </td>
                            <td data-label="Email">
                                {client.email}
                                <CopyButton value={client.email} label="email" />
                            </td>
                            <td data-label="Teléfono">
                                {client.phone}
                                <CopyButton value={client.phone} label="teléfono" />
                            </td>
                            <td data-label="Dirección">{getAddressDisplay(client.address)}</td>
                            <td data-label="Acciones">{renderActions(client)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="clients-list-view">
            {displayedClients.map((client) => (
                <article key={client._id} className="clients-list-item">
                    <div className="clients-list-item__body">
                        <div className="clients-list-item__head">
                            <strong className="clients-list-item__name">{client.name}</strong>
                        </div>
                        <dl className="clients-list-item__fields">
                            <div className="clients-list-item__field">
                                <dt>Documento</dt>
                                <dd>{formatDocument(client.doc_type, client.doc_number, client.doc_number_dv)}</dd>
                            </div>
                            <div className="clients-list-item__field">
                                <dt>Email</dt>
                                <dd>{client.email}</dd>
                            </div>
                            <div className="clients-list-item__field">
                                <dt>Teléfono</dt>
                                <dd>{client.phone}</dd>
                            </div>
                            <div className="clients-list-item__field">
                                <dt>Dirección</dt>
                                <dd>{getAddressDisplay(client.address)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="clients-list-item__actions">{renderActions(client, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="clients-cards-view">
            {displayedClients.map((client) => (
                <article key={client._id} className="clients-card">
                    <div className="clients-card__body">
                        <div className="clients-card__header">
                            <strong className="clients-card__name">{client.name}</strong>
                        </div>
                        <dl className="clients-card__fields">
                            <div className="clients-card__field">
                                <dt>Documento</dt>
                                <dd>{formatDocument(client.doc_type, client.doc_number, client.doc_number_dv)}</dd>
                            </div>
                            <div className="clients-card__field">
                                <dt>Email</dt>
                                <dd>{client.email}</dd>
                            </div>
                            <div className="clients-card__field">
                                <dt>Teléfono</dt>
                                <dd>{client.phone}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="clients-card__actions">{renderActions(client, "cards")}</footer>
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
        <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="clients-col" />
    );

    const filtersPanelContent = (
        <>
            <div className="clients-filters-panel__head">
                <h2 id="clients-filters-heading" className="clients-filters-panel__title">
                    Filtrar clientes
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="clients-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="clients-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="clients-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="clients-filters-clear clients-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="clients-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`clients-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="clients-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="clients-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line clients-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="clients-filters-panel"
                            className="clients-filters-panel clients-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="clients-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="clients-page">
            <ListPageContainer className="clients-container">
                <div className="clients-sticky-head">
                    <ListPageHeader
                        className="clients-header"
                        title="Clientes"
                        subtitle="Gestiona tu base de datos de clientes"
                        actions={
                            <button type="button" className="btn-primary" onClick={handleOpenCreateModal}>
                                <i className="ri-user-add-line" aria-hidden />
                                Nuevo Cliente
                            </button>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar clientes"
    ariaLabelledBy="clients-filters-heading-mobile"
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
                    <div className="page-loading ds-empty">
                        <p>Cargando clientes...</p>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="page-loading ds-empty">
                        <p>No hay clientes para mostrar</p>
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
                            emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            <ClientModal isOpen={isClientModalOpen} onClose={handleCloseClientModal} onSuccess={handleClientSuccess} client={selectedClient} />
            <ClientDeleteModal
                client={clientToDelete}
                loading={isDeleting}
                onClose={handleCloseDeleteModal}
                onConfirm={handleConfirmDelete}
            />
        </ListPageShell>
    );
};

export default ClientsPage;

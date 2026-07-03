import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../clients/page/Clients.css";
import "./SubUsers.css";
import type { ISubUser } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllSubUsers, searchSubUsers } from "../../../services/sub-users.service";
import SubUserModal from "../../../components/modals/SubUserModal/SubUserModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
    PaginationToolbar,
    paginationRange,
    useEffectiveViewMode,
    FilterField,
    FieldControl,
    useListFiltersPanel,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "nombre", label: "Nombre", type: "text", icon: "ri-user-line", serverSide: true },
    { id: "documento", label: "Documento", type: "text", icon: "ri-hashtag", serverSide: true },
    { id: "email", label: "Email", type: "text", icon: "ri-mail-line" },
    { id: "telefono", label: "Teléfono", type: "text", icon: "ri-phone-line" },
    { id: "activo", label: "Activo", type: "select", icon: "ri-toggle-line", options: [{ value: "true", label: "Activo" }, { value: "false", label: "Inactivo" }] },
];

type SubUsersPageProps = {
    embedded?: boolean;
};

const SubUsersPage: React.FC<SubUsersPageProps> = ({ embedded = false }) => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = PAGE_SIZE_OPTIONS.includes(Number(searchParams.get("limit")) as (typeof PAGE_SIZE_OPTIONS)[number])
        ? Number(searchParams.get("limit"))
        : 20;

    const [users, setUsers] = useState<ISubUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [refreshKey, setRefreshKey] = useState(0);
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);
    const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

    const getRowFilterValue = useCallback((row: ISubUser, filterId: string): string => {
        switch (filterId) {
            case "nombre": return `${row.name} ${row.last_name}`.trim();
            case "documento": return `${row.doc_type} ${row.doc_number}`;
            case "email": return row.email ?? "";
            case "telefono": return row.phone ?? "";
            case "activo": return row.active === false ? "false" : "true";
            default: return "";
        }
    }, []);
    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);
    const displayedUsers = useMemo(() => filterRows(users), [users, filterRows]);
    const hasActiveFilters = searchTerm.trim() !== "" || hasActiveClientFilters;

    const clearFilters = () => {
        setSearchTerm("");
        clearColFilters();
    };

    const { filtersToolbar, filtersMobileDrawer } = useListFiltersPanel({
        panelId: "sub-users",
        title: "Filtrar usuarios",
        variant: "clients",
        hasActiveFilters,
        onClear: clearFilters,
        repositionDeps: [searchTerm, colFilterValues],
        filterContent: (
            <>
                <FilterField label="Búsqueda" htmlFor="sub-users-search" icon="ri-search-line">
                    <FieldControl
                        id="sub-users-search"
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Buscar usuario..."
                    />
                </FilterField>
                <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} />
            </>
        ),
    });

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedUser, setSelectedUser] = useState<ISubUser | null>(null);

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
        setPageSize(nextSize);
        setPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.set("limit", String(nextSize));
            return params;
        });
    };

    const handleOpenCreateModal = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (u: ISubUser) => {
        setSelectedUser(u);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setSelectedUser(null);
    };

    const handleSuccess = () => {
        setRefreshKey((k) => k + 1);
    };

    const formatDocument = (docType: string, docNumber: string) => `${docType} ${docNumber}`;
    const fullName = (u: ISubUser) => `${u.name} ${u.last_name}`.trim();
    const getActiveStatusClass = (active: boolean | undefined) => (active === false ? "status-rejected" : "status-paid");
    const getActiveStatusLabel = (active: boolean | undefined) => (active === false ? "Inactivo" : "Activo");

    useEffect(() => {
        let ignore = false;
        const hasData = users.length > 0;
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q ? await searchSubUsers(q, page, pageSize) : await getAllSubUsers(page, pageSize);
                if (ignore || !response) return;
                setUsers(response.users);
                setTotalPages(response.pagination.totalPages);
                setTotalItems(response.pagination.total ?? response.users.length);
            } catch (error: unknown) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar usuarios");
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
    }, [page, pageSize, debouncedSearch, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
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

    const { start, end } = paginationRange(page, pageSize, totalItems);

    const renderActions = (u: ISubUser, layout: "table" | "list" | "cards" = "table") => (
        <div className={`action-buttons ds-row-actions clients-actions--${layout}`}>
            <button type="button" className="btn-action" title="Editar" onClick={() => handleOpenEditModal(u)}>
                <i className="ri-edit-line" aria-hidden />
                {layout === "table" ? "Editar" : null}
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
                        <th>Activo</th>
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedUsers.map((u) => (
                        <tr key={u._id}>
                            <td className="client-name" data-label="Nombre">{fullName(u)}</td>
                            <td data-label="Documento">{formatDocument(u.doc_type, u.doc_number)}<CopyButton value={u.doc_number} label="documento" /></td>
                            <td data-label="Email">{u.email}<CopyButton value={u.email} label="email" /></td>
                            <td data-label="Teléfono">{u.phone}<CopyButton value={u.phone} label="teléfono" /></td>
                            <td data-label="Activo">
                                <span className={`status-badge ${getActiveStatusClass(u.active)}`}>{getActiveStatusLabel(u.active)}</span>
                            </td>
                            <td data-label="Acciones">{renderActions(u, "table")}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderList = () => (
        <div className="clients-list-view">
            {displayedUsers.map((u) => (
                <article key={u._id} className="clients-list-item">
                    <div className="clients-list-item__body">
                        <div className="clients-list-item__head">
                            <strong className="clients-list-item__name">{fullName(u)}</strong>
                            <span className={`status-badge ${getActiveStatusClass(u.active)}`}>{getActiveStatusLabel(u.active)}</span>
                        </div>
                        <dl className="clients-list-item__fields">
                            <div className="clients-list-item__field"><dt>Documento</dt><dd>{formatDocument(u.doc_type, u.doc_number)}</dd></div>
                            <div className="clients-list-item__field"><dt>Email</dt><dd>{u.email}</dd></div>
                            <div className="clients-list-item__field"><dt>Teléfono</dt><dd>{u.phone}</dd></div>
                        </dl>
                    </div>
                    <footer className="clients-list-item__actions">{renderActions(u, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderCards = () => (
        <div className="clients-cards-view">
            {displayedUsers.map((u) => (
                <article key={u._id} className="clients-card">
                    <div className="clients-card__body">
                        <div className="clients-card__header">
                            <strong className="clients-card__name">{fullName(u)}</strong>
                            <span className={`status-badge ${getActiveStatusClass(u.active)}`}>{getActiveStatusLabel(u.active)}</span>
                        </div>
                        <dl className="clients-card__fields">
                            <div className="clients-card__field"><dt>Email</dt><dd>{u.email}</dd></div>
                            <div className="clients-card__field"><dt>Teléfono</dt><dd>{u.phone}</dd></div>
                        </dl>
                    </div>
                    <footer className="clients-card__actions">{renderActions(u, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderView = () => {
        if (effectiveViewMode === "list") return renderList();
        if (effectiveViewMode === "cards") return renderCards();
        return renderTable();
    };

    return (
        <main className={`clients-page subusers-page ${embedded ? "subusers-page--embedded" : ""}`}>
            <div className="clients-container">
                <div className="clients-header">
                    {!embedded ? (
                        <div className="header-content">
                            <h1>Usuarios</h1>
                            <p>Gestiona los usuarios de tu empresa</p>
                        </div>
                    ) : null}
                    <div className="clients-actions">
                        <button className="btn-primary" type="button" onClick={handleOpenCreateModal}>
                            Nuevo usuario
                        </button>
                    </div>
                </div>

                {filtersMobileDrawer}

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
                        <p>Cargando usuarios...</p>
                    </div>
                ) : users.length === 0 ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
                        <p>No hay usuarios para mostrar</p>
                    </div>
                ) : (
                    <>
                        <PaginationToolbar
                            position="top"
                            page={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            pageSizeOptions={PAGE_SIZE_OPTIONS}
                            rangeStart={start}
                            rangeEnd={end}
                            isFetching={isPageFetching}
                            onPageChange={handlePageChange}
                            onPageSizeChange={handlePageSizeChange}
                            viewMode={viewMode}
                            onViewModeChange={setViewMode}
                            showViewToggle
                            beforeViewToggle={filtersToolbar}
                        />
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
                        />
                    </>
                )}
            </div>

            <SubUserModal isOpen={isModalOpen} onClose={handleCloseModal} onSuccess={handleSuccess} subUser={selectedUser} />
        </main>
    );
};

export default SubUsersPage;

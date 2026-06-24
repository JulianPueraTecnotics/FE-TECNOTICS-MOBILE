import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../clients/page/Clients.css";
import "./SubUsers.css";
import type { ISubUser } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllSubUsers, searchSubUsers } from "../../../services/sub-users.service";
import SubUserModal from "../../../components/modals/SubUserModal/SubUserModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast } from "../../../components/shared/toast/toasts";

const SubUsersPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const [users, setUsers] = useState<ISubUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

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

    /** Mismas clases que el estado en `Documents.tsx` (`status-badge` + variante). */
    const getActiveStatusClass = (active: boolean | undefined) => {
        if (active === false) return "status-rejected";
        return "status-paid";
    };

    const getActiveStatusLabel = (active: boolean | undefined) => {
        if (active === false) return "Inactivo";
        return "Activo";
    };

    useEffect(() => {
        let ignore = false;
        const hasData = users.length > 0;
        if (hasData) {
            setIsPageFetching(true);
        } else {
            setLoading(true);
        }
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q
                    ? await searchSubUsers(q, page, 20)
                    : await getAllSubUsers(page, 20);
                if (ignore || !response) return;
                setUsers(response.users);
                setTotalPages(response.pagination.totalPages);
            } catch (error: unknown) {
                if (!ignore) {
                    errorToast(error instanceof Error ? error.message : "Error al cargar usuarios");
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
    }, [page, debouncedSearch, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps -- users.length solo afecta el indicador de carga

    useEffect(() => {
        if (page !== pageFromUrl) {
            setPage(pageFromUrl);
        }
    }, [pageFromUrl]); // eslint-disable-line react-hooks/exhaustive-deps -- solo sincronizar desde la URL

    return (
        <main className="clients-page subusers-page">
            <div className="clients-container">
                <div className="clients-header">
                    <div className="header-content">
                        <h1>Usuarios</h1>
                        <p>Gestiona los usuarios de tu empresa</p>
                    </div>
                    <div className="clients-actions">
                        <button className="btn-primary" type="button" onClick={handleOpenCreateModal}>
                            Nuevo usuario
                        </button>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input
                                type="text"
                                placeholder="Buscar usuario..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

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
                        <div className="pagination pagination--top">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1 || isPageFetching}
                                aria-label="Página anterior"
                            >
                                Anterior
                            </button>
                            <span className="pagination__info">
                                Página {page} de {totalPages}
                                {isPageFetching ? " - Actualizando..." : ""}
                            </span>
                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages || isPageFetching}
                                aria-label="Página siguiente"
                            >
                                Siguiente
                            </button>
                        </div>
                        <div className="clients-table-container">
                            <table className="clients-table">
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
                                    {users.map((u) => (
                                        <tr key={u._id}>
                                            <td className="client-name" data-label="Nombre">
                                                {fullName(u)}
                                            </td>
                                            <td data-label="Documento">{formatDocument(u.doc_type, u.doc_number)}<CopyButton value={u.doc_number} label="documento" /></td>
                                            <td data-label="Email">{u.email}<CopyButton value={u.email} label="email" /></td>
                                            <td data-label="Teléfono">{u.phone}<CopyButton value={u.phone} label="teléfono" /></td>
                                            <td data-label="Activo">
                                                <span className={`status-badge ${getActiveStatusClass(u.active)}`}>
                                                    {getActiveStatusLabel(u.active)}
                                                </span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="btn-icon"
                                                        title="Editar"
                                                        onClick={() => handleOpenEditModal(u)}
                                                    >
                                                        <i className="ri-edit-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="pagination pagination--bottom">
                            <button
                                type="button"
                                onClick={() => handlePageChange(page - 1)}
                                disabled={page === 1 || isPageFetching}
                                aria-label="Página anterior"
                            >
                                Anterior
                            </button>
                            <span className="pagination__info">
                                Página {page} de {totalPages}
                                {isPageFetching ? " - Actualizando..." : ""}
                            </span>
                            <button
                                type="button"
                                onClick={() => handlePageChange(page + 1)}
                                disabled={page === totalPages || isPageFetching}
                                aria-label="Página siguiente"
                            >
                                Siguiente
                            </button>
                        </div>
                    </>
                )}
            </div>

            <SubUserModal isOpen={isModalOpen} onClose={handleCloseModal} onSuccess={handleSuccess} subUser={selectedUser} />
        </main>
    );
};

export default SubUsersPage;

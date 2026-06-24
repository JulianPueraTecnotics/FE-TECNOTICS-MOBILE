import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Clients.css";
import type { IExternUser } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllClients, searchClients, deleteClient } from "../../../services/clients.service";
import ClientModal from "../../../components/modals/ClientModal/ClientModal";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const ClientsPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const [clients, setClients] = useState<IExternUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

    // Tiempo real: refrescar cuando se cree/edite/elimine un cliente en otra sesión.
    useRealtime(RealtimeEvents.CLIENT_CHANGED, (payload) => setClients((prev) => applyRealtimeChange(prev, payload)));

    // Estados para modales
    const [isClientModalOpen, setIsClientModalOpen] = useState(false);
    const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [clientToDelete, setClientToDelete] = useState<{ id: string; name: string } | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safePage));
            return params;
        });
    };

    // Abrir modal para crear cliente
    const handleOpenCreateModal = () => {
        setSelectedClient(null);
        setIsClientModalOpen(true);
    };

    // Abrir modal para editar cliente
    const handleOpenEditModal = (client: IExternUser) => {
        setSelectedClient(client);
        setIsClientModalOpen(true);
    };

    // Cerrar modal de cliente
    const handleCloseClientModal = () => {
        setIsClientModalOpen(false);
        setSelectedClient(null);
    };

    // Cuando se crea/edita un cliente exitosamente
    const handleClientSuccess = () => {
        setRefreshKey((k) => k + 1);
    };

    // Abrir modal de confirmación para eliminar
    const handleOpenDeleteModal = (clientId: string, clientName: string) => {
        setClientToDelete({ id: clientId, name: clientName });
        setIsConfirmModalOpen(true);
    };

    // Cerrar modal de confirmación
    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setClientToDelete(null);
    };

    // Confirmar eliminación
    const handleConfirmDelete = async () => {
        if (!clientToDelete) return;

        setIsDeleting(true);
        try {
            await deleteClient(clientToDelete.id);
            successToast("Cliente eliminado exitosamente");
            // Si era el último elemento de una página > 1, retroceder una página;
            // de lo contrario, refrescar la página actual respetando búsqueda.
            if (clients.length === 1 && page > 1) {
                handlePageChange(page - 1);
            } else {
                setRefreshKey((k) => k + 1);
            }
            handleCloseConfirmModal();
        } catch (error: any) {
            errorToast(error.message);
        } finally {
            setIsDeleting(false);
        }
    };

    // Formatear tipo de documento + número
    const formatDocument = (docType: string, docNumber: string, docDv?: string) => {
        if (docType === "Nit" && docDv) {
            return `${docType} ${docNumber}-${docDv}`;
        }
        return `${docType} ${docNumber}`;
    };

    // Dirección: API puede devolver string u objeto { value, ciudad_codigo, ... }
    const getAddressDisplay = (address: IExternUser["address"]): string => {
        if (address == null) return "N/A";
        if (typeof address === "string") return address || "N/A";
        const value = (address as { value?: string }).value ?? "";
        const zipCode = (address as { zip_code?: string }).zip_code ?? "";
        if (!value && !zipCode) return "N/A";
        return zipCode ? `${value || "Dirección sin descripción"} (CP: ${zipCode})` : value;
    };

    useEffect(() => {
        let ignore = false;
        const hasData = clients.length > 0;
        if (hasData) {
            setIsPageFetching(true);
        } else {
            setLoading(true);
        }
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q
                    ? await searchClients(q, page, 20)
                    : await getAllClients(page, 20);
                if (ignore || !response) return;
                setClients(response.clients);
                setTotalPages(response.pagination.totalPages);
            } catch (error: any) {
                if (!ignore) errorToast(error.message);
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
    }, [page, debouncedSearch, refreshKey]);

    useEffect(() => {
        if (page !== pageFromUrl) {
            setPage(pageFromUrl);
        }
    }, [pageFromUrl]);

    return (
        <main className="clients-page">
            <div className="clients-container">
                <div className="clients-header">
                    <div className="header-content">
                        <h1>Clientes</h1>
                        <p>Gestiona tu base de datos de clientes</p>
                    </div>
                    <div className="clients-actions">
                        <button className="btn-primary" onClick={handleOpenCreateModal}>
                            Nuevo Cliente
                        </button>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input
                                type="text"
                                placeholder="Buscar cliente..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
                        <p>Cargando clientes...</p>
                    </div>
                ) : clients.length === 0 ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: "40px" }}>
                        <p>No hay clientes para mostrar</p>
                    </div>
                ) : (
                    <>
                        <div className="pagination pagination--top">
                            <button
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
                                        <th>Dirección</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {clients.map((client) => (
                                        <tr key={client._id}>
                                            <td className="client-name" data-label="Nombre">{client.name}</td>
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
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button
                                                        className="btn-icon"
                                                        title="Editar"
                                                        onClick={() => handleOpenEditModal(client)}
                                                    >
                                                        <i className="ri-edit-line"></i>
                                                    </button>
                                                    <button
                                                        className="btn-icon"
                                                        title="Eliminar"
                                                        onClick={() => handleOpenDeleteModal(client._id, client.name)}
                                                    >
                                                        <i className="ri-delete-bin-line"></i>
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

            {/* Modales */}
            <ClientModal
                isOpen={isClientModalOpen}
                onClose={handleCloseClientModal}
                onSuccess={handleClientSuccess}
                client={selectedClient}
            />
            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleConfirmDelete}
                title="¿Eliminar Cliente?"
                message={`¿Estás seguro de que deseas eliminar a "${clientToDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={isDeleting}
            />
        </main>
    );
};

export default ClientsPage;



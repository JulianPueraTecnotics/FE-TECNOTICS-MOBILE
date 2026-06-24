import { useEffect, useState } from "react";
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
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const PAGE_SIZE = 20;

const statusClass = (status: QuoteStatus): string => `quote-status quote-status--${status}`;

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const QuotesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);

    const [quotes, setQuotes] = useState<IQuote[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAmount, setTotalAmount] = useState<number | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

    // Tiempo real QUIRÚRGICO: actualiza solo la fila afectada (creada/aprobada/eliminada).
    useRealtime(RealtimeEvents.QUOTE_CHANGED, (payload) => setQuotes((prev) => applyRealtimeChange(prev, payload)));

    // Acción en curso por fila (spinner): "send" | "download" | "convert"
    const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);

    // Modales
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [quoteToDelete, setQuoteToDelete] = useState<{ id: string; name: string } | null>(null);
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

    const handleOpenCreateModal = () => navigate(PATHS.SALES_COTIZACIONES_NUEVA);
    const handleOpenEditModal = (q: IQuote) => navigate(PATHS.SALES_COTIZACIONES_EDITAR(q._id));

    const handleOpenDeleteModal = (id: string, name: string) => {
        setQuoteToDelete({ id, name });
        setIsConfirmModalOpen(true);
    };
    const handleCloseConfirmModal = () => {
        setIsConfirmModalOpen(false);
        setQuoteToDelete(null);
    };

    const handleConfirmDelete = async () => {
        if (!quoteToDelete) return;
        setIsDeleting(true);
        try {
            await deleteQuote(quoteToDelete.id);
            successToast("Cotización eliminada exitosamente");
            if (quotes.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            handleCloseConfirmModal();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar la cotización");
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSend = async (q: IQuote) => {
        setRowBusy({ id: q._id, action: "send" });
        try {
            await sendQuoteEmail(q._id);
            successToast("Cotización enviada por correo");
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar la cotización");
        } finally {
            setRowBusy(null);
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

    const handleConvert = async (q: IQuote) => {
        setRowBusy({ id: q._id, action: "convert" });
        try {
            await convertQuoteToInvoice(q._id);
            successToast("Cotización convertida en factura (borrador)");
            setRefreshKey((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo convertir la cotización");
        } finally {
            setRowBusy(null);
        }
    };

    const handleRemision = async (q: IQuote) => {
        setRowBusy({ id: q._id, action: "remision" });
        try {
            await createRemision({ source: "quote", source_id: q._id, send_email: true });
            successToast("Remisión generada y enviada al cliente para firma");
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo generar la remisión");
        } finally {
            setRowBusy(null);
        }
    };

    useEffect(() => {
        let ignore = false;
        const hasData = quotes.length > 0;
        // Patrón de carga del proyecto (igual que Clients.tsx): marcar fetching/loading antes del fetch.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hasData) setIsPageFetching(true);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        else setLoading(true);
        (async () => {
            try {
                const q = debouncedSearch.trim();
                const response = q
                    ? await searchQuotes(q, page, PAGE_SIZE)
                    : await getAllQuotes(page, PAGE_SIZE, statusFilter ? { status: statusFilter } : undefined);
                if (ignore || !response) return;
                setQuotes(response.quotes);
                setTotalPages(response.pagination.totalPages || 1);
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
    }, [page, debouncedSearch, statusFilter, refreshKey]);

    useEffect(() => {
        // Sincroniza el estado de página con el ?page de la URL (navegación atrás/adelante).
        // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
        if (page !== pageFromUrl) setPage(pageFromUrl);
    }, [pageFromUrl]);

    const isRowBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;
    const anyRowBusy = (id: string) => rowBusy?.id === id;

    const renderPagination = (position: "top" | "bottom") => (
        <div className={`pagination pagination--${position}`}>
            <button onClick={() => handlePageChange(page - 1)} disabled={page === 1 || isPageFetching} aria-label="Página anterior">
                Anterior
            </button>
            <span className="pagination__info">
                Página {page} de {totalPages}
                {isPageFetching ? " - Actualizando..." : ""}
            </span>
            <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages || isPageFetching} aria-label="Página siguiente">
                Siguiente
            </button>
        </div>
    );

    return (
        <main className="quotes-page">
            <div className="quotes-container">
                <div className="quotes-header">
                    <div className="header-content">
                        <h1>Cotizaciones</h1>
                        <p>Crea cotizaciones y conviértelas en factura cuando el cliente acepte</p>
                    </div>
                    <div className="quotes-actions">
                        <button className="btn-primary" onClick={handleOpenCreateModal}>
                            <i className="ri-add-line"></i> Nueva Cotización
                        </button>
                        <select
                            className="quotes-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filtrar por estado"
                        >
                            <option value="">Todos los estados</option>
                            {Object.entries(QUOTE_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input
                                type="text"
                                placeholder="Buscar cotización..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {totalAmount !== null && (
                    <div className="quotes-summary">
                        Total cotizado: <strong>{formatCOP(totalAmount)}</strong>
                    </div>
                )}

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
                        {renderPagination("top")}
                        <div className="quotes-table-container">
                            <table className="quotes-table">
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
                                    {quotes.map((q) => (
                                        <tr key={q._id}>
                                            <td data-label="Número">{q.number}</td>
                                            <td data-label="Cliente">{q.client_name || "—"}</td>
                                            <td data-label="Creación">{formatDate(q.created_at)}</td>
                                            <td data-label="Vence">{formatDate(q.valid_until)}</td>
                                            <td data-label="Total">{formatCOP(q.totals?.total)}</td>
                                            <td data-label="Estado">
                                                <span className={statusClass(q.status)}>{QUOTE_STATUS_LABELS[q.status] ?? q.status}</span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button className="btn-icon" title="Editar" onClick={() => handleOpenEditModal(q)} disabled={anyRowBusy(q._id)}>
                                                        <i className="ri-edit-line"></i>
                                                    </button>
                                                    <button className="btn-icon" title="Enviar por correo" onClick={() => handleSend(q)} disabled={anyRowBusy(q._id)}>
                                                        <i className={isRowBusy(q._id, "send") ? "ri-loader-4-line rotating" : "ri-mail-send-line"}></i>
                                                    </button>
                                                    <button className="btn-icon" title="Descargar PDF" onClick={() => handleDownload(q)} disabled={anyRowBusy(q._id)}>
                                                        <i className={isRowBusy(q._id, "download") ? "ri-loader-4-line rotating" : "ri-download-line"}></i>
                                                    </button>
                                                    <button className="btn-icon" title="Generar remisión (firma del cliente)" onClick={() => handleRemision(q)} disabled={anyRowBusy(q._id)}>
                                                        <i className={isRowBusy(q._id, "remision") ? "ri-loader-4-line rotating" : "ri-truck-line"}></i>
                                                    </button>
                                                    {q.status !== "invoiced" && (
                                                        <button
                                                            className="btn-icon btn-icon--accent"
                                                            title="Convertir en factura"
                                                            onClick={() => handleConvert(q)}
                                                            disabled={anyRowBusy(q._id)}
                                                        >
                                                            <i className={isRowBusy(q._id, "convert") ? "ri-loader-4-line rotating" : "ri-file-transfer-line"}></i>
                                                        </button>
                                                    )}
                                                    <button className="btn-icon" title="Eliminar" onClick={() => handleOpenDeleteModal(q._id, q.number)} disabled={anyRowBusy(q._id)}>
                                                        <i className="ri-delete-bin-line"></i>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {renderPagination("bottom")}
                    </>
                )}
            </div>

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={handleCloseConfirmModal}
                onConfirm={handleConfirmDelete}
                title="¿Eliminar Cotización?"
                message={`¿Estás seguro de que deseas eliminar "${quoteToDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={isDeleting}
            />
        </main>
    );
};

export default QuotesPage;

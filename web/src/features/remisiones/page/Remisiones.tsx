import { useEffect, useState } from "react";
import "./Remisiones.css";
import type { IRemision } from "../../../types";
import { REMISION_STATUS_LABELS, type RemisionStatus } from "../../../types";
import { getRemisiones, sendRemisionEmail, downloadRemision, deleteRemision } from "../../../services/remisiones.service";
import { formatCOP } from "../../quotes/quotes.utils";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const PAGE_SIZE = 20;
const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const RemisionesPage: React.FC = () => {
    const [remisiones, setRemisiones] = useState<IRemision[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; label: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    // Tiempo real QUIRÚRGICO: actualiza solo la fila afectada (firma, nueva, eliminada)
    // sin recargar toda la lista ni perder la página/scroll.
    useRealtime(RealtimeEvents.REMISION_CHANGED, (payload) => setRemisiones((prev) => applyRealtimeChange(prev, payload)));

    useEffect(() => {
        let ignore = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        (async () => {
            try {
                const res = await getRemisiones(page, PAGE_SIZE, {
                    status: statusFilter || undefined,
                    cliente: search.trim() || undefined,
                });
                if (ignore || !res) return;
                setRemisiones(res.remisiones);
                setTotalPages(res.pagination.totalPages || 1);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las remisiones");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, statusFilter, refreshKey]);

    const handleSend = async (r: IRemision) => {
        setRowBusy({ id: r._id, action: "send" });
        try {
            await sendRemisionEmail(r._id);
            successToast("Link de firma enviado al cliente");
            setRefreshKey((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar");
        } finally {
            setRowBusy(null);
        }
    };

    const handleDownload = async (r: IRemision) => {
        setRowBusy({ id: r._id, action: "download" });
        try {
            const res = await downloadRemision(r._id);
            const uri = res?.data_uri || (res?.base64_remision ? `data:${res.mime_type || "application/pdf"};base64,${res.base64_remision}` : null);
            if (!uri) throw new Error("La respuesta no contiene el PDF");
            const link = document.createElement("a");
            link.href = uri;
            link.download = res?.file_name || `${r.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo descargar");
        } finally {
            setRowBusy(null);
        }
    };

    const handleConfirmDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteRemision(toDelete.id);
            successToast("Remisión eliminada");
            setToDelete(null);
            setRefreshKey((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const anyBusy = (id: string) => rowBusy?.id === id;
    const isBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;

    return (
        <main className="remisiones-page">
            <div className="remisiones-container">
                <div className="remisiones-header">
                    <div className="header-content">
                        <h1>Remisiones</h1>
                        <p>Entregas que el cliente firma. Genera una remisión desde una factura o cotización.</p>
                    </div>
                    <div className="remisiones-actions">
                        <select className="remisiones-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
                            <option value="">Todas</option>
                            {Object.entries(REMISION_STATUS_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar remisión o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading">
                        <p>Cargando remisiones...</p>
                    </div>
                ) : remisiones.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay remisiones. Genera una desde una factura o cotización (botón "Remisión").</p>
                    </div>
                ) : (
                    <div className="remisiones-table-container">
                        <table className="remisiones-table">
                            <thead>
                                <tr>
                                    <th>Remisión</th>
                                    <th>Origen</th>
                                    <th>Cliente</th>
                                    <th>Fecha</th>
                                    <th>Total</th>
                                    <th>Estado</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {remisiones.map((r) => (
                                    <tr key={r._id}>
                                        <td data-label="Remisión">{r.number}</td>
                                        <td data-label="Origen">{r.source_number || (r.source === "quote" ? "Cotización" : "Factura")}</td>
                                        <td data-label="Cliente">{r.client_name || "—"}</td>
                                        <td data-label="Fecha">{formatDate(r.createdAt)}</td>
                                        <td data-label="Total">{formatCOP(r.total)}</td>
                                        <td data-label="Estado">
                                            <span className={`rem-status rem-status--${r.status}`}>{REMISION_STATUS_LABELS[r.status as RemisionStatus] ?? r.status}</span>
                                        </td>
                                        <td data-label="Acciones">
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Enviar link de firma" onClick={() => handleSend(r)} disabled={anyBusy(r._id)}>
                                                    <i className={isBusy(r._id, "send") ? "ri-loader-4-line rotating" : "ri-mail-send-line"}></i>
                                                </button>
                                                <button className="btn-icon" title="Descargar PDF" onClick={() => handleDownload(r)} disabled={anyBusy(r._id)}>
                                                    <i className={isBusy(r._id, "download") ? "ri-loader-4-line rotating" : "ri-download-line"}></i>
                                                </button>
                                                <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: r._id, label: r.number })} disabled={anyBusy(r._id)}>
                                                    <i className="ri-delete-bin-line"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                        {totalPages > 1 && (
                            <div className="pagination pagination--bottom">
                                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} aria-label="Página anterior">
                                    Anterior
                                </button>
                                <span className="pagination__info">
                                    Página {page} de {totalPages}
                                </span>
                                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} aria-label="Página siguiente">
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!toDelete}
                onClose={() => setToDelete(null)}
                onConfirm={handleConfirmDelete}
                title="¿Eliminar remisión?"
                message={`La remisión "${toDelete?.label}" se eliminará. El documento origen no se ve afectado.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={deleting}
            />
        </main>
    );
};

export default RemisionesPage;

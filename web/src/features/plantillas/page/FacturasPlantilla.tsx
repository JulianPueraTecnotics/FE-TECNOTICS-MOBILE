import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./FacturasPlantilla.css";
import type { InvoiceTemplate } from "../../../types";
import { RECURRENCE_LABELS, type RecurrenceType } from "../../../types";
import { PATHS } from "../../../router/paths.contants";
import { getTemplates, setInvoiceTemplate, markTemplateInvoiced } from "../../../services/plantillas.service";
import { formatCOP } from "../../../utils/format";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const formatDate = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const FacturasPlantillaPage: React.FC = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
    const [pendingCount, setPendingCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [recFilter, setRecFilter] = useState("all");
    const [search, setSearch] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    // Tiempo real: refrescar cuando se marque/quite una plantilla en otra sesión.
    useRealtime(RealtimeEvents.TEMPLATE_CHANGED, () => setRefreshKey((k) => k + 1));

    // Confirmar quitar de plantillas
    const [toRemove, setToRemove] = useState<{ id: string; label: string } | null>(null);
    const [removing, setRemoving] = useState(false);

    useEffect(() => {
        let ignore = false;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setLoading(true);
        (async () => {
            try {
                const res = await getTemplates({ recurrence: recFilter, cliente: search.trim() || undefined });
                if (ignore || !res) return;
                setTemplates(res.templates);
                setPendingCount(res.pending_count);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las plantillas");
            } finally {
                if (!ignore) setLoading(false);
            }
        })();
        return () => {
            ignore = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [recFilter, refreshKey]);

    // "Recrear": lleva cliente+ítems de la plantilla al Dashboard para emitir una factura nueva,
    // y marca la plantilla como facturada (reinicia el contador de recurrencia).
    const handleRecreate = async (t: InvoiceTemplate) => {
        try {
            await markTemplateInvoiced(t._id);
        } catch {
            /* si falla el marcado, igual dejamos recrear */
        }
        navigate(PATHS.DASHBOARD, { state: { recreate_factura_id: t._id } });
    };

    const handleConfirmRemove = async () => {
        if (!toRemove) return;
        setRemoving(true);
        try {
            await setInvoiceTemplate(toRemove.id, { is_template: false });
            successToast("Quitada de plantillas");
            setToRemove(null);
            setRefreshKey((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo quitar");
        } finally {
            setRemoving(false);
        }
    };

    const visible = templates.filter(
        (t) => !search.trim() || `${t.number} ${t.client_name ?? ""} ${t.client_doc ?? ""}`.toLowerCase().includes(search.toLowerCase()),
    );

    return (
        <main className="plantillas-page">
            <div className="plantillas-container">
                <div className="plantillas-header">
                    <div className="header-content">
                        <h1>Facturas de plantilla</h1>
                        <p>Reutiliza facturas frecuentes y gestiona las recurrentes</p>
                    </div>
                    <div className="plantillas-actions">
                        <select className="plantillas-filter" value={recFilter} onChange={(e) => setRecFilter(e.target.value)} aria-label="Filtrar por recurrencia">
                            <option value="all">Todas</option>
                            <option value="recurrent">Solo recurrentes</option>
                            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </select>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar plantilla..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                    </div>
                </div>

                {/* Aviso de recurrentes pendientes por facturar */}
                {pendingCount > 0 && (
                    <div className="plantillas-pending-banner">
                        <i className="ri-alarm-warning-line"></i>
                        Tienes <strong>{pendingCount}</strong> factura(s) recurrente(s) pendiente(s) por facturar este periodo.
                    </div>
                )}

                {loading ? (
                    <div className="page-loading">
                        <p>Cargando plantillas...</p>
                    </div>
                ) : visible.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay plantillas. Guarda una factura como plantilla desde "Facturas".</p>
                    </div>
                ) : (
                    <div className="plantillas-table-container">
                        <table className="plantillas-table">
                            <thead>
                                <tr>
                                    <th>Documento</th>
                                    <th>Cliente</th>
                                    <th>Total</th>
                                    <th>Recurrencia</th>
                                    <th>Próx. facturación</th>
                                    <th>Acciones</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((t) => (
                                    <tr key={t._id} className={t.pending ? "plantillas-row--pending" : ""}>
                                        <td data-label="Documento">{t.number}</td>
                                        <td data-label="Cliente">{t.client_name || "—"}</td>
                                        <td data-label="Total">{formatCOP(t.total)}</td>
                                        <td data-label="Recurrencia">
                                            <span className={`plantilla-rec plantilla-rec--${t.recurrence}`}>
                                                {RECURRENCE_LABELS[t.recurrence as RecurrenceType] ?? t.recurrence}
                                            </span>
                                        </td>
                                        <td data-label="Próx. facturación">
                                            {t.recurrence === "none" ? (
                                                "—"
                                            ) : (
                                                <span className={t.pending ? "plantillas-due--pending" : ""}>
                                                    {formatDate(t.next_due)}
                                                    {t.pending && " · pendiente"}
                                                </span>
                                            )}
                                        </td>
                                        <td data-label="Acciones">
                                            <div className="action-buttons">
                                                <button className="btn-recreate" onClick={() => handleRecreate(t)} title="Crear factura desde esta plantilla">
                                                    <i className="ri-file-copy-line"></i> Recrear
                                                </button>
                                                <button className="btn-icon" title="Quitar de plantillas" onClick={() => setToRemove({ id: t._id, label: t.number })}>
                                                    <i className="ri-bookmark-2-line"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmModal
                isOpen={!!toRemove}
                onClose={() => setToRemove(null)}
                onConfirm={handleConfirmRemove}
                title="¿Quitar de plantillas?"
                message={`"${toRemove?.label}" dejará de aparecer en Facturas de plantilla. La factura original no se elimina.`}
                confirmText="Quitar"
                cancelText="Cancelar"
                type="warning"
                loading={removing}
            />
        </main>
    );
};

export default FacturasPlantillaPage;

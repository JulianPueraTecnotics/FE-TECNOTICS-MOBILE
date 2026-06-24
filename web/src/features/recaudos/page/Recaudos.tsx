import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Recaudos.css";
import type { ReceivableInvoice, ReceivablesSummary } from "../../../types";
import { RECEIVABLE_STATUS_LABELS, type ReceivableStatus } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getReceivables, getReceivablesSummary } from "../../../services/recaudos.service";
import { formatCOP, formatDateCO } from "../../../utils/format";
import PaymentModal from "../../../components/modals/PaymentModal/PaymentModal";
import BatchPaymentModal from "../../../components/modals/BatchPaymentModal/BatchPaymentModal";
import ReceiptsModal from "../../../components/modals/ReceiptsModal/ReceiptsModal";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const PAGE_SIZE = 20;

const statusClass = (status: ReceivableStatus): string => `recaudo-status recaudo-status--${status}`;

const RecaudosPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);

    const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
    const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debouncedSearch = useDebouncedValue(searchTerm, FILTER_DEBOUNCE_MS);

    // Tiempo real: refrescar cartera cuando se registre/anule un pago en otra sesión.
    useRealtime(RealtimeEvents.RECAUDO_CHANGED, () => setRefreshKey((k) => k + 1));

    // Modales
    const [payInvoice, setPayInvoice] = useState<ReceivableInvoice | null>(null);
    const [receiptsInvoice, setReceiptsInvoice] = useState<ReceivableInvoice | null>(null);
    const [batchOpen, setBatchOpen] = useState(false);

    // Selección múltiple (por _id)
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const toggleSelect = (id: string) =>
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
                // Si al deseleccionar ya no queda nada, limpiar el autofiltro por cliente.
                if (next.size === 0) setSearchTerm("");
            } else {
                next.add(id);
                // Al seleccionar la PRIMERA factura, autofiltrar la tabla por su cliente
                // para ver todas las facturas de ese cliente juntas y meterlas en un solo recibo.
                if (prev.size === 0) {
                    const inv = invoices.find((i) => i._id === id);
                    const term = inv?.client_doc || inv?.client_name;
                    if (term && searchTerm.trim() !== term) setSearchTerm(term);
                }
            }
            return next;
        });

    const selectedInvoices = invoices.filter((i) => selectedIds.has(i._id));

    // Un recaudo es de UN solo cliente: al seleccionar la primera factura, queda fijado ese cliente.
    // Identificamos al cliente por documento (o nombre si no hay doc).
    const clientKey = (i: ReceivableInvoice) => i.client_doc || i.client_name || "";
    const lockedClient = selectedInvoices.length > 0 ? clientKey(selectedInvoices[0]) : null;

    // Facturas que se pueden seleccionar: con saldo y (si ya hay cliente fijado) del mismo cliente.
    const isSelectable = (i: ReceivableInvoice) => i.balance > 0 && (lockedClient === null || clientKey(i) === lockedClient);

    const selectableInvoices = invoices.filter(isSelectable);
    const allSelected = selectableInvoices.length > 0 && selectableInvoices.every((i) => selectedIds.has(i._id));
    const toggleSelectAll = () =>
        setSelectedIds(allSelected ? new Set() : new Set(selectableInvoices.map((i) => i._id)));

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safePage));
            return params;
        });
    };

    const handlePaymentSuccess = () => {
        setSelectedIds(new Set());
        setSearchTerm("");
        setRefreshKey((k) => k + 1);
    };

    useEffect(() => {
        let ignore = false;
        const hasData = invoices.length > 0;
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (hasData) setIsPageFetching(true);
        else setLoading(true);
        (async () => {
            try {
                const response = await getReceivables(page, PAGE_SIZE, {
                    status: statusFilter || undefined,
                    cliente: debouncedSearch.trim() || undefined,
                });
                if (ignore || !response) return;
                setInvoices(response.invoices);
                setTotalPages(response.pagination.totalPages || 1);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "No se pudieron cargar las facturas por cobrar");
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

    // Resumen de cartera (se recalcula al refrescar tras un pago)
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const s = await getReceivablesSummary();
                if (!ignore && s) setSummary(s);
            } catch {
                /* el resumen es opcional; no bloquea la vista */
            }
        })();
        return () => {
            ignore = true;
        };
    }, [refreshKey]);

    useEffect(() => {
        // Sincroniza el estado de página con el ?page de la URL (navegación atrás/adelante).
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (page !== pageFromUrl) setPage(pageFromUrl);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageFromUrl]);

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
        <main className="recaudos-page">
            <div className="recaudos-container">
                <div className="recaudos-header">
                    <div className="header-content">
                        <h1>Recaudos</h1>
                        <p>Carga los pagos de tus facturas y envía el comprobante de ingreso al cliente</p>
                    </div>
                    <div className="recaudos-actions">
                        <select
                            className="recaudos-status-filter"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            aria-label="Filtrar por estado"
                        >
                            <option value="">Todas por cobrar</option>
                            <option value="pendiente">Pendientes</option>
                            <option value="parcial">Abonadas</option>
                            <option value="vencida">Vencidas</option>
                            <option value="pagada">Pagadas</option>
                        </select>
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input
                                type="text"
                                placeholder="Buscar por cliente o factura..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                {/* Resumen de cartera */}
                <div className="recaudos-summary">
                    <div className="recaudo-kpi">
                        <span className="recaudo-kpi__label">Total por cobrar</span>
                        <span className="recaudo-kpi__value">{summary ? formatCOP(summary.total_por_cobrar) : "—"}</span>
                    </div>
                    <div className="recaudo-kpi recaudo-kpi--overdue">
                        <span className="recaudo-kpi__label">Vencido</span>
                        <span className="recaudo-kpi__value">{summary ? formatCOP(summary.total_vencido) : "—"}</span>
                    </div>
                    <div className="recaudo-kpi">
                        <span className="recaudo-kpi__label">Facturas</span>
                        <span className="recaudo-kpi__value">{summary ? summary.cantidad_facturas : "—"}</span>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading">
                        <p>Cargando facturas...</p>
                    </div>
                ) : invoices.length === 0 ? (
                    <div className="page-loading">
                        <p>No hay facturas por cobrar</p>
                    </div>
                ) : (
                    <>
                        {/* Barra de selección múltiple */}
                        {selectedIds.size > 0 && (
                            <div className="recaudos-selbar">
                                <span>
                                    {selectedIds.size} factura(s) de <strong>{selectedInvoices[0]?.client_name}</strong> ·{" "}
                                    <strong>{formatCOP(selectedInvoices.reduce((s, i) => s + i.balance, 0))}</strong>
                                </span>
                                <div className="recaudos-selbar-actions">
                                    <button
                                        className="btn-link"
                                        onClick={() => {
                                            setSelectedIds(new Set());
                                            setSearchTerm("");
                                        }}
                                    >
                                        Limpiar
                                    </button>
                                    <button className="btn-pay" onClick={() => setBatchOpen(true)}>
                                        <i className="ri-money-dollar-circle-line"></i> Recaudar seleccionadas
                                    </button>
                                </div>
                            </div>
                        )}
                        {renderPagination("top")}
                        <div className="recaudos-table-container">
                            <table className="recaudos-table">
                                <thead>
                                    <tr>
                                        <th className="recaudos-col-check">
                                            <input
                                                type="checkbox"
                                                checked={allSelected}
                                                onChange={toggleSelectAll}
                                                aria-label="Seleccionar todas"
                                            />
                                        </th>
                                        <th>Factura</th>
                                        <th>Cliente</th>
                                        <th>Emisión</th>
                                        <th>Vence</th>
                                        <th>Total</th>
                                        <th>Abonado</th>
                                        <th>Saldo</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {invoices.map((inv) => (
                                        <tr key={inv._id} className={selectedIds.has(inv._id) ? "recaudos-row--selected" : ""}>
                                            <td data-label="" className="recaudos-col-check">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedIds.has(inv._id)}
                                                    onChange={() => toggleSelect(inv._id)}
                                                    disabled={inv.balance <= 0 || (!selectedIds.has(inv._id) && !isSelectable(inv))}
                                                    title={
                                                        !selectedIds.has(inv._id) && lockedClient !== null && clientKey(inv) !== lockedClient
                                                            ? "Solo puedes recaudar facturas del mismo cliente en un pago"
                                                            : undefined
                                                    }
                                                    aria-label={`Seleccionar ${inv.number}`}
                                                />
                                            </td>
                                            <td data-label="Factura">{inv.number}</td>
                                            <td data-label="Cliente">{inv.client_name || "—"}</td>
                                            <td data-label="Emisión">{formatDateCO(inv.issued_at)}</td>
                                            <td data-label="Vence">{formatDateCO(inv.due_date)}</td>
                                            <td data-label="Total">{formatCOP(inv.total)}</td>
                                            <td data-label="Abonado">{formatCOP(inv.paid)}</td>
                                            <td data-label="Saldo">
                                                <strong>{formatCOP(inv.balance)}</strong>
                                                {(inv.nota_credito ?? 0) > 0 && (
                                                    <small className="recaudos-nc-hint" title="Nota crédito aplicada">
                                                        NC −{formatCOP(inv.nota_credito)}
                                                    </small>
                                                )}
                                            </td>
                                            <td data-label="Estado">
                                                <span className={statusClass(inv.status)}>{RECEIVABLE_STATUS_LABELS[inv.status] ?? inv.status}</span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    {inv.balance > 0 && (
                                                        <button className="btn-pay" onClick={() => setPayInvoice(inv)} title="Registrar pago">
                                                            <i className="ri-money-dollar-circle-line"></i> Recaudar
                                                        </button>
                                                    )}
                                                    <button className="btn-icon" title="Comprobantes de ingreso" onClick={() => setReceiptsInvoice(inv)}>
                                                        <i className="ri-receipt-line"></i>
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

            <PaymentModal
                isOpen={!!payInvoice}
                onClose={() => setPayInvoice(null)}
                onSuccess={handlePaymentSuccess}
                invoice={payInvoice}
            />
            <ReceiptsModal isOpen={!!receiptsInvoice} onClose={() => setReceiptsInvoice(null)} invoice={receiptsInvoice} />
            <BatchPaymentModal
                isOpen={batchOpen}
                onClose={() => setBatchOpen(false)}
                onSuccess={handlePaymentSuccess}
                invoices={selectedInvoices}
            />
        </main>
    );
};

export default RecaudosPage;

import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import "./Treasury.css";
import { getBatches, downloadBatchFile, markBatchSent, reconcileBatch, sendComprobantes } from "../treasury.service";
import type { PaymentBatch } from "../treasury.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";

const formatCOP = (n: number) => (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });
const formatDate = (d?: string) => (d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—");

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
    generated: { label: "Generado", cls: "status-pending" },
    sent: { label: "Enviado al banco", cls: "status-pending" },
    reconciled: { label: "Conciliado", cls: "status-paid" },
};

const TreasuryBatchesPage: React.FC = () => {
    const [batches, setBatches] = useState<PaymentBatch[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [busyId, setBusyId] = useState<string | null>(null);

    useRealtime(RealtimeEvents.BATCH_CHANGED, (payload) => setBatches((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getBatches(1, 50);
            setBatches(res.batches);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar lotes");
        } finally {
            setLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const onDownload = async (b: PaymentBatch) => {
        try {
            await downloadBatchFile(b._id, b.archivo_nombre);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo descargar");
        }
    };

    const onSent = async (b: PaymentBatch) => {
        setBusyId(b._id);
        try {
            await markBatchSent(b._id);
            successToast("Lote marcado como enviado");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setBusyId(null);
        }
    };

    const onReconcile = async (b: PaymentBatch) => {
        if (!confirm(`¿Confirmas que el lote ${b.consecutivo} fue pagado? Las facturas se marcarán como pagadas.`)) return;
        setBusyId(b._id);
        try {
            const res = await reconcileBatch(b._id);
            successToast(res.message || "Lote conciliado");
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al conciliar");
        } finally {
            setBusyId(null);
        }
    };

    const onComprobantes = async (b: PaymentBatch) => {
        setBusyId(b._id);
        try {
            const res = await sendComprobantes(b._id);
            successToast(`Comprobantes: ${res.enviados} enviados, ${res.sinCorreo} sin correo, ${res.errores} con error`);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al enviar comprobantes");
        } finally {
            setBusyId(null);
        }
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Lotes de pago</h1>
                        <p>Descarga el archivo para el banco, marca el pago y envía comprobantes a los proveedores</p>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando lotes...</div>
                ) : batches.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-stack-line"></i>
                        <p>Aún no has generado lotes de pago. Hazlo desde <strong>Tesorería › Pagos a proveedores</strong>.</p>
                    </div>
                ) : (
                    <div className="purchases-table-container">
                        <table className="purchases-table">
                            <thead>
                                <tr><th>Lote</th><th>Banco</th><th>Fecha</th><th>Registros</th><th>Total</th><th>Estado</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {batches.map((b) => {
                                    const st = STATUS_LABEL[b.status] ?? { label: b.status, cls: "" };
                                    const busy = busyId === b._id;
                                    return (
                                        <tr key={b._id}>
                                            <td data-label="Lote" className="document-number">#{b.consecutivo}</td>
                                            <td data-label="Banco">{b.bank?.nombre}</td>
                                            <td data-label="Fecha">{formatDate(b.generado_en)}</td>
                                            <td data-label="Registros">{b.total_registros}</td>
                                            <td data-label="Total" className="document-total">{formatCOP(b.total_amount)}</td>
                                            <td data-label="Estado"><span className={`status-badge ${st.cls}`}>{st.label}</span></td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons treasury-actions">
                                                    <button className="btn-action" onClick={() => onDownload(b)} title="Descargar archivo para el banco">
                                                        <i className="ri-download-2-line" /> Archivo
                                                    </button>
                                                    {b.status === "generated" && (
                                                        <button className="btn-action" onClick={() => onSent(b)} disabled={busy} title="Marcar como enviado al banco">
                                                            <i className="ri-send-plane-line" /> Enviado
                                                        </button>
                                                    )}
                                                    {b.status !== "reconciled" && (
                                                        <button className="btn-action" onClick={() => onReconcile(b)} disabled={busy} title="Marcar facturas como pagadas">
                                                            <i className="ri-check-double-line" /> Conciliar
                                                        </button>
                                                    )}
                                                    {b.status === "reconciled" && (
                                                        <button className="btn-action" onClick={() => onComprobantes(b)} disabled={busy} title="Enviar comprobantes de egreso a los proveedores">
                                                            <i className="ri-mail-send-line" /> Comprobantes
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </main>
    );
};

export default TreasuryBatchesPage;

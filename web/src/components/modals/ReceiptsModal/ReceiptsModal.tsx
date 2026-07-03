import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { getInvoiceReceipts, downloadReceipt, sendReceiptEmail } from '../../../services/recaudos.service';
import type { ReceivableInvoice, ReceiptVoucher } from '../../../types';
import { PAYMENT_METHOD_LABELS } from '../../../types';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { formatCOP, formatDateCO } from '../../../utils/format';
import { AppModal } from '../../../components/design-system';
import './ReceiptsModal.css';

interface ReceiptsModalProps {
    isOpen: boolean;
    onClose: () => void;
    invoice: ReceivableInvoice | null;
}

const ReceiptsModal: React.FC<ReceiptsModalProps> = ({ isOpen, onClose, invoice }) => {
    const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
    const [loading, setLoading] = useState(false);
    const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);

    useBodyScrollLock(isOpen);

    const load = useCallback(async () => {
        if (!invoice) return;
        setLoading(true);
        try {
            const res = await getInvoiceReceipts(invoice._id);
            setReceipts(res?.receipts ?? []);
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudieron cargar los comprobantes');
        } finally {
            setLoading(false);
        }
    }, [invoice]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (isOpen && invoice) load();
    }, [isOpen, invoice, load]);

    const handleDownload = async (r: ReceiptVoucher) => {
        setRowBusy({ id: r._id, action: 'download' });
        try {
            const res = await downloadReceipt(r._id);
            const uri = res?.data_uri || (res?.base64_receipt ? `data:${res.mime_type || 'application/pdf'};base64,${res.base64_receipt}` : null);
            if (!uri) throw new Error('La respuesta no contiene el PDF');
            const link = document.createElement('a');
            link.href = uri;
            link.download = res?.file_name || `${r.number}.pdf`;
            document.body.appendChild(link);
            link.click();
            link.remove();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo descargar el comprobante');
        } finally {
            setRowBusy(null);
        }
    };

    const handleSend = async (r: ReceiptVoucher) => {
        setRowBusy({ id: r._id, action: 'send' });
        try {
            await sendReceiptEmail(r._id);
            toast.success('Comprobante enviado al cliente');
            load();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'No se pudo enviar el comprobante');
        } finally {
            setRowBusy(null);
        }
    };

    if (!isOpen || !invoice) return null;

    const isBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;
    const anyBusy = (id: string) => rowBusy?.id === id;

    return (
        <AppModal
            title="Comprobantes de ingreso"
            titleIcon="ri-receipt-line"
            ariaLabelledBy="receipts-modal-title"
            onClose={onClose}
            footer={
                <button type="button" className="export-cancel" onClick={onClose}>
                    Cerrar
                </button>
            }
        >
            <p className="receipts-intro">
                Factura <strong>{invoice.number}</strong> · {invoice.client_name || 'Cliente'}
            </p>

            {loading ? (
                <p className="receipts-empty">
                    <i className="ri-loader-4-line rotating" aria-hidden /> Cargando comprobantes…
                </p>
            ) : receipts.length === 0 ? (
                <p className="receipts-empty">Esta factura aún no tiene comprobantes de ingreso.</p>
            ) : (
                <ul className="receipts-list">
                    {receipts.map((r) => (
                        <li key={r._id} className="receipt-item">
                            <div className="receipt-info">
                                <div className="receipt-number">
                                    <i className="ri-receipt-line" aria-hidden /> {r.number}
                                </div>
                                <div className="receipt-meta">
                                    {formatDateCO(r.issued_at)} · {PAYMENT_METHOD_LABELS[r.method] ?? r.method}
                                    {r.emailed ? ' · Enviado ✓' : ''}
                                </div>
                            </div>
                            <div className="receipt-amount">{formatCOP(r.amount)}</div>
                            <div className="receipt-actions">
                                <button
                                    type="button"
                                    className="receipt-btn-icon"
                                    title="Descargar PDF"
                                    onClick={() => handleDownload(r)}
                                    disabled={anyBusy(r._id)}
                                >
                                    <i className={isBusy(r._id, 'download') ? 'ri-loader-4-line rotating' : 'ri-download-line'} aria-hidden />
                                </button>
                                <button
                                    type="button"
                                    className="receipt-btn-icon"
                                    title="Enviar al cliente"
                                    onClick={() => handleSend(r)}
                                    disabled={anyBusy(r._id)}
                                >
                                    <i className={isBusy(r._id, 'send') ? 'ri-loader-4-line rotating' : 'ri-mail-send-line'} aria-hidden />
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </AppModal>
    );
};

export default ReceiptsModal;

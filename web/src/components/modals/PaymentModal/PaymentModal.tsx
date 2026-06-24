import React, { useState, useEffect, useContext, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createInvoicePayment } from '../../../services/recaudos.service';
import type { ReceivableInvoice, CreatePaymentRequest, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { formatCOP } from '../../../utils/format';
import './PaymentModal.css';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    invoice: ReceivableInvoice | null;
}

/** Fecha de hoy en formato YYYY-MM-DD (input date), sin depender de Date.now en tests. */
function todayISO(): string {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}

const PaymentModal: React.FC<PaymentModalProps> = ({ isOpen, onClose, onSuccess, invoice }) => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [amount, setAmount] = useState<number>(0);
    const [method, setMethod] = useState<PaymentMethod>('transferencia');
    const [paidAt, setPaidAt] = useState<string>(todayISO());
    const [reference, setReference] = useState('');
    const [notes, setNotes] = useState('');
    const [sendReceipt, setSendReceipt] = useState(true);
    // "Pago total con retención": el cliente pagó menos que el saldo y la diferencia fue retención.
    const [esPagoTotal, setEsPagoTotal] = useState(true);

    useBodyScrollLock(isOpen);

    const balance = invoice?.balance ?? 0;

    // Al abrir, precargar el saldo completo como monto sugerido
    useEffect(() => {
        if (isOpen && invoice) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAmount(invoice.balance);
            setMethod('transferencia');
            setPaidAt(todayISO());
            setReference('');
            setNotes('');
            setSendReceipt(true);
            setEsPagoTotal(true);
        }
    }, [isOpen, invoice]);

    // Si es pago total con retención, la retención = saldo - lo pagado.
    const retencion = useMemo(() => {
        if (!esPagoTotal) return 0;
        return Math.max(0, Math.round((balance - (amount || 0)) * 100) / 100);
    }, [esPagoTotal, balance, amount]);

    // % de retención sobre la base imponible (subtotal antes de impuestos) de la factura.
    const base = invoice?.base ?? 0;
    const retencionPct = useMemo(() => {
        if (retencion <= 0 || base <= 0) return 0;
        return Math.round((retencion / base) * 1000) / 10; // 1 decimal
    }, [retencion, base]);

    const applied = Math.round(((amount || 0) + retencion) * 100) / 100;
    const newBalance = useMemo(() => Math.max(0, Math.round((balance - applied) * 100) / 100), [balance, applied]);
    const willBePaid = newBalance <= 0.0001 && balance > 0;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!invoice) return;
        if (!amount || amount <= 0) {
            toast.error('Ingresa el valor pagado (mayor a 0)');
            return;
        }
        if (amount > balance + 1) {
            toast.error(`El valor pagado no puede superar el saldo (${formatCOP(balance)})`);
            return;
        }
        const payload: CreatePaymentRequest = {
            amount,
            // Solo enviamos retención si es pago total y hay diferencia.
            retencion: esPagoTotal && retencion > 0 ? retencion : 0,
            method,
            paid_at: paidAt,
            reference: reference.trim() || undefined,
            notes: notes.trim() || undefined,
            send_receipt: sendReceipt,
            executed_by: user?.razon_social,
        };
        setLoading(true);
        try {
            await createInvoicePayment(invoice._id, payload);
            toast.success(
                sendReceipt
                    ? 'Pago registrado y comprobante enviado al cliente'
                    : 'Pago registrado',
            );
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al registrar el pago');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen || !invoice) return null;

    return (
        <div className="modal-overlay payment-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="payment-modal-title">
            <div className="modal-container payment-modal">
                <div className="modal-header">
                    <h2 id="payment-modal-title">Registrar pago</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {/* Resumen de la factura */}
                    <div className="payment-invoice-summary">
                        <div className="payment-invoice-row">
                            <span>Factura</span>
                            <strong>{invoice.number}</strong>
                        </div>
                        <div className="payment-invoice-row">
                            <span>Cliente</span>
                            <strong>{invoice.client_name || '—'}</strong>
                        </div>
                        <div className="payment-invoice-row">
                            <span>Total</span>
                            <strong>{formatCOP(invoice.total)}</strong>
                        </div>
                        <div className="payment-invoice-row">
                            <span>Abonado</span>
                            <strong>{formatCOP(invoice.paid)}</strong>
                        </div>
                        <div className="payment-invoice-row payment-invoice-row--balance">
                            <span>Saldo pendiente</span>
                            <strong>{formatCOP(balance)}</strong>
                        </div>
                    </div>

                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="amount">Valor pagado por el cliente *</label>
                            <input
                                id="amount"
                                type="number"
                                min="0"
                                max={balance}
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                disabled={loading}
                            />
                            <button
                                type="button"
                                className="payment-fill-balance"
                                onClick={() => setAmount(balance)}
                                disabled={loading}
                            >
                                Pagó el saldo completo sin retención ({formatCOP(balance)})
                            </button>
                        </div>
                        <div className="form-group">
                            <label htmlFor="method">Medio de pago *</label>
                            <select id="method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} disabled={loading}>
                                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="paid_at">Fecha de pago *</label>
                            <input id="paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label htmlFor="reference">Referencia</label>
                            <input
                                id="reference"
                                type="text"
                                placeholder="N° de transacción / consignación"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="notes">Observaciones</label>
                            <textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} disabled={loading} />
                        </div>
                    </div>

                    {/* Toggle: ¿el cliente aplicó retención? */}
                    <label className="payment-toggle-ret">
                        <input
                            type="checkbox"
                            checked={esPagoTotal}
                            onChange={(e) => setEsPagoTotal(e.target.checked)}
                            disabled={loading}
                        />
                        El cliente aplicó retención (pagó menos que el saldo y el resto fue retenido)
                    </label>

                    {/* Desglose calculado */}
                    <div className="payment-breakdown">
                        <div className="payment-breakdown-row">
                            <span>Efectivo recibido</span>
                            <strong>{formatCOP(amount)}</strong>
                        </div>
                        {esPagoTotal && retencion > 0 && (
                            <div className="payment-breakdown-row payment-breakdown-row--ret">
                                <span>
                                    Retención calculada
                                    {retencionPct > 0 ? ` (${retencionPct}% sobre base ${formatCOP(base)})` : ''}
                                </span>
                                <strong>{formatCOP(retencion)}</strong>
                            </div>
                        )}
                        <div className="payment-breakdown-row payment-breakdown-row--total">
                            <span>Total aplicado al saldo</span>
                            <strong>{formatCOP(applied)}</strong>
                        </div>
                        <div className="payment-breakdown-row">
                            <span>Saldo después del pago</span>
                            <strong className={willBePaid ? 'payment-result--paid' : ''}>
                                {formatCOP(newBalance)} {willBePaid ? '· Factura quedará PAGADA' : ''}
                            </strong>
                        </div>
                    </div>

                    <label className="payment-send-receipt">
                        <input type="checkbox" checked={sendReceipt} onChange={(e) => setSendReceipt(e.target.checked)} disabled={loading} />
                        Enviar comprobante de ingreso al cliente por correo
                        {invoice.client_email ? ` (${invoice.client_email})` : ''}
                    </label>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating"></i> Registrando...
                                </>
                            ) : (
                                'Registrar pago'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PaymentModal;

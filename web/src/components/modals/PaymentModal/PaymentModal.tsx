import React, { useState, useEffect, useContext, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createInvoicePayment } from '../../../services/recaudos.service';
import type { ReceivableInvoice, CreatePaymentRequest, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import { formatCOP } from '../../../utils/format';
import { AppDrawer, FilterField, FieldControl } from '../../../components/design-system';
import './PaymentModal.css';

interface PaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    invoice: ReceivableInvoice | null;
}

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
    const [sendReceipt, setSendReceipt] = useState(false);
    const [esPagoTotal, setEsPagoTotal] = useState(true);

    const balance = invoice?.balance ?? 0;

    useEffect(() => {
        if (isOpen && invoice) {
            setAmount(invoice.balance);
            setMethod('transferencia');
            setPaidAt(todayISO());
            setReference('');
            setNotes('');
            setSendReceipt(false);
            setEsPagoTotal(true);
        }
    }, [isOpen, invoice]);

    const retencion = useMemo(() => {
        if (!esPagoTotal) return 0;
        return Math.max(0, Math.round((balance - (amount || 0)) * 100) / 100);
    }, [esPagoTotal, balance, amount]);

    const base = invoice?.base ?? 0;
    const retencionPct = useMemo(() => {
        if (retencion <= 0 || base <= 0) return 0;
        return Math.round((retencion / base) * 1000) / 10;
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
            toast.success(sendReceipt ? 'Pago registrado y comprobante enviado al cliente' : 'Pago registrado');
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
        <AppDrawer
            wide
            title="Registrar pago"
            titleIcon="ri-hand-coin-line"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>
                        Cancelar
                    </button>
                    <button type="submit" form="payment-form" className="export-submit" disabled={loading}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden /> Registrando…
                            </>
                        ) : (
                            'Registrar pago'
                        )}
                    </button>
                </>
            }
        >
            <form id="payment-form" onSubmit={handleSubmit} className="payment-drawer__body">
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

                <div className="payment-form-grid">
                    <div className="payment-form-grid__amount">
                        <FilterField label="Valor pagado por el cliente *" htmlFor="amount" icon="ri-money-dollar-circle-line">
                            <FieldControl
                                id="amount"
                                type="number"
                                min={0}
                                max={balance}
                                step="0.01"
                                value={amount}
                                onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                                disabled={loading}
                            />
                        </FilterField>
                        <button
                            type="button"
                            className="payment-fill-balance"
                            onClick={() => setAmount(balance)}
                            disabled={loading}
                        >
                            Pagó el saldo completo sin retención ({formatCOP(balance)})
                        </button>
                    </div>
                    <FilterField label="Medio de pago *" htmlFor="method" icon="ri-bank-card-line">
                        <FieldControl
                            as="select"
                            id="method"
                            value={method}
                            onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                            disabled={loading}
                        >
                            {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>{label}</option>
                            ))}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Fecha de pago *" htmlFor="paid_at" icon="ri-calendar-line">
                        <FieldControl id="paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={loading} />
                    </FilterField>
                    <FilterField label="Referencia" htmlFor="reference" icon="ri-hashtag">
                        <FieldControl
                            id="reference"
                            type="text"
                            placeholder="N° de transacción / consignación"
                            value={reference}
                            onChange={(e) => setReference(e.target.value)}
                            disabled={loading}
                        />
                    </FilterField>
                    <div className="payment-form-grid__full">
                        <FilterField label="Observaciones" htmlFor="notes" icon="ri-file-text-line">
                            <FieldControl
                                as="textarea"
                                id="notes"
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                disabled={loading}
                            />
                        </FilterField>
                    </div>
                </div>

                <label className="payment-toggle-ret">
                    <input type="checkbox" checked={esPagoTotal} onChange={(e) => setEsPagoTotal(e.target.checked)} disabled={loading} />
                    El cliente aplicó retención (pagó menos que el saldo y el resto fue retenido)
                </label>

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
            </form>
        </AppDrawer>
    );
};

export default PaymentModal;

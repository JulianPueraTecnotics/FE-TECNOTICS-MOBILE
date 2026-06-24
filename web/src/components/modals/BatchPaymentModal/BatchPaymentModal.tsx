import React, { useState, useEffect, useContext, useMemo } from 'react';
import toast from 'react-hot-toast';
import { createBatchPayment } from '../../../services/recaudos.service';
import type { ReceivableInvoice, CreateBatchPaymentRequest, PaymentMethod } from '../../../types';
import { PAYMENT_METHOD_LABELS } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { formatCOP } from '../../../utils/format';
import './BatchPaymentModal.css';

interface BatchPaymentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    invoices: ReceivableInvoice[];
}

function todayISO(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Estado editable por factura dentro del lote. */
interface Row {
    invoice: ReceivableInvoice;
    /** Efectivo recibido para esta factura. */
    amount: number;
    /** ¿Se aplicó retención individual? (retención = saldo - amount de esta factura). */
    conRetencion: boolean;
}

/**
 * Modo de retención:
 * - "individual": cada factura calcula su retención = saldo - valor pagado (si tiene el check).
 * - "general": NO hay retención por factura; el valor total pagado se reparte llenando saldos y
 *   la diferencia con el saldo total se trata como retención global (repartida a la última factura cubierta).
 * - "ninguna": pago limpio, sin retención (el total debe cubrir todos los saldos).
 */
type RetMode = 'individual' | 'general' | 'ninguna';

const BatchPaymentModal: React.FC<BatchPaymentModalProps> = ({ isOpen, onClose, onSuccess, invoices }) => {
    const { user } = useContext(AuthContext);
    const [loading, setLoading] = useState(false);
    const [rows, setRows] = useState<Row[]>([]);
    const [method, setMethod] = useState<PaymentMethod>('transferencia');
    const [paidAt, setPaidAt] = useState<string>(todayISO());
    const [reference, setReference] = useState('');
    const [sendReceipt, setSendReceipt] = useState(true);
    const [retMode, setRetMode] = useState<RetMode>('individual');
    /** Valor total pagado global (modo general/ninguna): el usuario lo digita y se reparte. */
    const [totalPagadoGlobal, setTotalPagadoGlobal] = useState<number>(0);

    useBodyScrollLock(isOpen);

    const saldoTotal = useMemo(() => round2(invoices.reduce((s, i) => s + i.balance, 0)), [invoices]);

    useEffect(() => {
        if (isOpen) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setRows(invoices.map((inv) => ({ invoice: inv, amount: inv.balance, conRetencion: false })));
            setMethod('transferencia');
            setPaidAt(todayISO());
            setReference('');
            setSendReceipt(true);
            setRetMode('individual');
            setTotalPagadoGlobal(round2(invoices.reduce((s, i) => s + i.balance, 0)));
        }
    }, [isOpen, invoices]);

    const updateRow = (idx: number, patch: Partial<Row>) =>
        setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

    /**
     * Reparte un valor total entre las filas llenando el saldo de cada una en orden;
     * la última cubierta puede quedar con abono parcial. Devuelve un nuevo array de filas.
     */
    const repartirTotal = (total: number): Row[] => {
        let restante = round2(total);
        return rows.map((r) => {
            const aplica = Math.min(restante, r.invoice.balance);
            restante = round2(restante - Math.max(0, aplica));
            return { ...r, amount: Math.max(0, round2(aplica)) };
        });
    };

    const onChangeTotalGlobal = (val: number) => {
        setTotalPagadoGlobal(val);
        setRows(repartirTotal(val));
    };

    // Cálculo por fila según el modo de retención.
    const calcRow = (r: Row) => {
        let retencion = 0;
        if (retMode === 'individual' && r.conRetencion) {
            retencion = Math.max(0, round2(r.invoice.balance - (r.amount || 0)));
        } else if (retMode === 'general') {
            // En modo general, la retención de la fila = saldo - efectivo aplicado (lo que faltó del reparto).
            retencion = Math.max(0, round2(r.invoice.balance - (r.amount || 0)));
        }
        const applied = round2((r.amount || 0) + retencion);
        const pct = retencion > 0 && (r.invoice.base ?? 0) > 0 ? Math.round((retencion / (r.invoice.base as number)) * 1000) / 10 : 0;
        return { retencion, applied, pct };
    };

    const totals = useMemo(() => {
        let efectivo = 0;
        let retencion = 0;
        for (const r of rows) {
            const c = calcRow(r);
            efectivo += r.amount || 0;
            retencion += c.retencion;
        }
        return { efectivo: round2(efectivo), retencion: round2(retencion), aplicado: round2(efectivo + retencion) };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rows, retMode]);

    const usaTotalGlobal = retMode === 'general' || retMode === 'ninguna';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (rows.length === 0) {
            toast.error('No hay facturas seleccionadas');
            return;
        }
        // Validación: el total aplicado no puede exceder el saldo total.
        if (totals.aplicado > saldoTotal + 1) {
            toast.error(`El total aplicado (${formatCOP(totals.aplicado)}) supera el saldo total (${formatCOP(saldoTotal)})`);
            return;
        }
        if (totals.aplicado <= 0) {
            toast.error('Ingresa el valor pagado');
            return;
        }
        const payload: CreateBatchPaymentRequest = {
            items: rows
                .map((r) => {
                    const c = calcRow(r);
                    return { invoice_id: r.invoice._id, amount: round2(r.amount || 0), retencion: c.retencion > 0 ? c.retencion : 0 };
                })
                .filter((it) => it.amount > 0 || (it.retencion ?? 0) > 0),
            method,
            paid_at: paidAt,
            reference: reference.trim() || undefined,
            send_receipt: sendReceipt,
            executed_by: user?.razon_social,
        };
        if (payload.items.length === 0) {
            toast.error('Ninguna factura tiene valor a aplicar');
            return;
        }
        setLoading(true);
        try {
            const res = await createBatchPayment(payload);
            toast.success(res?.message || `Pago registrado para ${payload.items.length} factura(s)`);
            onSuccess();
            onClose();
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Error al registrar el pago');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const clientName = rows[0]?.invoice.client_name;

    return (
        <div className="modal-overlay batch-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="batch-modal-title">
            <div className="modal-container batch-modal">
                <div className="modal-header">
                    <h2 id="batch-modal-title">Recaudar {rows.length} facturas</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="modal-body">
                    {clientName && (
                        <div className="batch-client">
                            <i className="ri-user-3-line"></i> Cliente: <strong>{clientName}</strong>
                        </div>
                    )}

                    {/* Modo de retención */}
                    <div className="batch-retmode">
                        <span className="batch-retmode-lbl">Retención:</span>
                        <label>
                            <input type="radio" name="retmode" checked={retMode === 'individual'} onChange={() => setRetMode('individual')} disabled={loading} />
                            Individual por factura
                        </label>
                        <label>
                            <input type="radio" name="retmode" checked={retMode === 'general'} onChange={() => setRetMode('general')} disabled={loading} />
                            General (sobre el total)
                        </label>
                        <label>
                            <input type="radio" name="retmode" checked={retMode === 'ninguna'} onChange={() => setRetMode('ninguna')} disabled={loading} />
                            Sin retención
                        </label>
                    </div>

                    {/* Valor total pagado global (modos general / ninguna) */}
                    {usaTotalGlobal && (
                        <div className="batch-global">
                            <label htmlFor="batch_total_global">
                                Valor total pagado
                                <small> · saldo total {formatCOP(saldoTotal)}</small>
                            </label>
                            <input
                                id="batch_total_global"
                                type="number"
                                min="0"
                                max={saldoTotal}
                                step="0.01"
                                value={totalPagadoGlobal}
                                onChange={(e) => onChangeTotalGlobal(parseFloat(e.target.value) || 0)}
                                disabled={loading}
                            />
                            <button type="button" className="batch-fill-link" onClick={() => onChangeTotalGlobal(saldoTotal)} disabled={loading}>
                                Pagó el total ({formatCOP(saldoTotal)})
                            </button>
                        </div>
                    )}

                    {/* Tabla de facturas del lote */}
                    <div className="batch-table">
                        <div className={`batch-head${retMode !== 'individual' ? ' batch-head--noret' : ''}`}>
                            <span>Factura</span>
                            <span>Saldo</span>
                            <span>Valor pagado</span>
                            {retMode === 'individual' && <span>Ret.</span>}
                            <span>Retención</span>
                        </div>
                        {rows.map((r, idx) => {
                            const c = calcRow(r);
                            return (
                                <div className={`batch-row${retMode !== 'individual' ? ' batch-row--noret' : ''}`} key={r.invoice._id}>
                                    <span className="batch-cell-factura">
                                        {r.invoice.number}
                                        <small>{r.invoice.client_name}</small>
                                    </span>
                                    <span>{formatCOP(r.invoice.balance)}</span>
                                    <span>
                                        <input
                                            type="number"
                                            min="0"
                                            max={r.invoice.balance}
                                            step="0.01"
                                            value={r.amount}
                                            onChange={(e) => updateRow(idx, { amount: parseFloat(e.target.value) || 0 })}
                                            disabled={loading}
                                        />
                                    </span>
                                    {retMode === 'individual' && (
                                        <span className="batch-cell-check">
                                            <input
                                                type="checkbox"
                                                checked={r.conRetencion}
                                                onChange={(e) => updateRow(idx, { conRetencion: e.target.checked })}
                                                disabled={loading}
                                                title="Aplicó retención"
                                            />
                                        </span>
                                    )}
                                    <span className="batch-cell-ret">
                                        {c.retencion > 0 ? (
                                            <>
                                                {formatCOP(c.retencion)}
                                                {c.pct > 0 && <small>{c.pct}%</small>}
                                            </>
                                        ) : (
                                            '—'
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    {/* Datos del pago */}
                    <div className="form-grid">
                        <div className="form-group">
                            <label htmlFor="batch_method">Medio de pago *</label>
                            <select id="batch_method" value={method} onChange={(e) => setMethod(e.target.value as PaymentMethod)} disabled={loading}>
                                {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                                    <option key={value} value={value}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label htmlFor="batch_paid_at">Fecha de pago *</label>
                            <input id="batch_paid_at" type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={loading} />
                        </div>
                        <div className="form-group full-width">
                            <label htmlFor="batch_reference">Referencia</label>
                            <input
                                id="batch_reference"
                                type="text"
                                placeholder="N° de transacción / consignación"
                                value={reference}
                                onChange={(e) => setReference(e.target.value)}
                                disabled={loading}
                            />
                        </div>
                    </div>

                    {/* Totales del lote */}
                    <div className="batch-totals">
                        <div className="batch-totals-row">
                            <span>Efectivo recibido</span>
                            <strong>{formatCOP(totals.efectivo)}</strong>
                        </div>
                        {totals.retencion > 0 && (
                            <div className="batch-totals-row batch-totals-row--ret">
                                <span>Retención total</span>
                                <strong>{formatCOP(totals.retencion)}</strong>
                            </div>
                        )}
                        <div className="batch-totals-row batch-totals-row--total">
                            <span>Total aplicado</span>
                            <strong>{formatCOP(totals.aplicado)}</strong>
                        </div>
                    </div>

                    <label className="batch-send-receipt">
                        <input type="checkbox" checked={sendReceipt} onChange={(e) => setSendReceipt(e.target.checked)} disabled={loading} />
                        Enviar comprobante de ingreso al cliente por correo
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
                                `Registrar pago (${formatCOP(totals.aplicado)})`
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BatchPaymentModal;

import { API_ROUTES } from "../utils/global";
import type {
    ReceivablesResponse,
    ReceivablesSummary,
    CreatePaymentRequest,
    CreatePaymentResponse,
    CreateBatchPaymentRequest,
    CreateBatchPaymentResponse,
    PaymentsResponse,
    ReceiptsResponse,
    DeleteResponse,
} from "../types";

export interface GetReceivablesFilters {
    /** "pendiente" | "parcial" | "vencida" | "pagada" */
    status?: string;
    cliente?: string;
    /** Solo facturas vencidas */
    overdue?: boolean;
}

// ============================================
// LISTAR FACTURAS POR COBRAR
// ============================================
export const getReceivables = async (page = 1, limit = 20, filters?: GetReceivablesFilters): Promise<ReceivablesResponse | null> => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status?.trim()) query.set("status", filters.status.trim());
    if (filters?.cliente?.trim()) query.set("cliente", filters.cliente.trim());
    if (filters?.overdue) query.set("overdue", "true");

    const response = await fetch(`${API_ROUTES.RECAUDOS}?${query.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// RESUMEN DE CARTERA
// ============================================
export const getReceivablesSummary = async (): Promise<ReceivablesSummary | null> => {
    const response = await fetch(API_ROUTES.RECAUDOS_SUMMARY, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// PAGOS DE UNA FACTURA
// ============================================
export const getInvoicePayments = async (facturaId: string): Promise<PaymentsResponse | null> => {
    const response = await fetch(API_ROUTES.INVOICE_PAYMENTS(facturaId), {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// REGISTRAR PAGO / ABONO
// ============================================
export const createInvoicePayment = async (
    facturaId: string,
    payload: CreatePaymentRequest,
): Promise<CreatePaymentResponse | null> => {
    const response = await fetch(API_ROUTES.INVOICE_PAYMENTS(facturaId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo registrar el pago");
    return data;
};

// ============================================
// REGISTRAR PAGO MÚLTIPLE (varias facturas, un comprobante)
// ============================================
export const createBatchPayment = async (payload: CreateBatchPaymentRequest): Promise<CreateBatchPaymentResponse | null> => {
    const response = await fetch(API_ROUTES.RECAUDOS_BATCH_PAYMENT, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo registrar el pago múltiple");
    return data;
};

// ============================================
// ANULAR / ELIMINAR UN PAGO
// ============================================
export const deleteInvoicePayment = async (facturaId: string, paymentId: string): Promise<DeleteResponse | null> => {
    const response = await fetch(API_ROUTES.INVOICE_PAYMENT_BY_ID(facturaId, paymentId), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo anular el pago");
    return data;
};

// ============================================
// COMPROBANTES DE INGRESO DE UNA FACTURA
// ============================================
export const getInvoiceReceipts = async (facturaId: string): Promise<ReceiptsResponse | null> => {
    const response = await fetch(API_ROUTES.INVOICE_RECEIPTS(facturaId), {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// DESCARGAR PDF DE UN COMPROBANTE
// ============================================
export const downloadReceipt = async (
    receiptId: string,
): Promise<{ ok: boolean; base64_receipt?: string; mime_type?: string; file_name?: string; data_uri?: string; message?: string } | null> => {
    const response = await fetch(API_ROUTES.RECEIPT_DOWNLOAD(receiptId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo descargar el comprobante");
    return data;
};

// ============================================
// ENVIAR COMPROBANTE AL CLIENTE POR CORREO
// ============================================
export const sendReceiptEmail = async (receiptId: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.RECEIPT_SEND_EMAIL(receiptId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    let data: { ok?: boolean; message?: string } = {};
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
    } catch {
        /* cuerpo vacío o no JSON */
    }

    if (!response.ok) throw new Error(data.message || "No se pudo enviar el comprobante");
    return data;
};

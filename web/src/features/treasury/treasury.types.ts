export interface AchBank {
    nombre: string;
    codigo_simple: string;
    codigo_ach: string;
}

export interface Bank {
    _id: string;
    company_id: string;
    nombre_banco: string;
    numero_cuenta: string;
    tipo_cuenta: "ahorros" | "corriente";
    identificador: string;
    validacion_id: string;
    descripcion_lote: string;
    active: boolean;
}

export interface PayableSupplierBank {
    banco: string;
    tipo_cuenta: string;
    numero_cuenta: string;
    codigo_ach_banco: string;
    complete: boolean;
}

export interface PayableInvoice {
    _id: string;
    kind: "purchase" | "expense";
    supplier_id: string;
    supplier_name: string;
    supplier_doc: string;
    prefix?: string;
    number?: string;
    issue_date?: string;
    currency?: string;
    total: number;
    paid_amount: number;
    balance: number;
    payment_status: "pending" | "in_batch" | "partial" | "paid";
    supplier_bank: PayableSupplierBank;
}

export interface PayableResponse {
    ok: boolean;
    purchases: PayableInvoice[];
    total_pending: number;
}

export interface PaymentBatchItem {
    purchase_id: string;
    supplier_name: string;
    supplier_nit: string;
    banco_proveedor?: string;
    codigo_ach_banco?: string;
    numero_cuenta_proveedor?: string;
    tipo_cuenta?: string;
    monto: number;
    referencia: string;
}

export interface PaymentBatch {
    _id: string;
    consecutivo: number;
    bank: { bank_id: string; nombre: string; numero_cuenta: string; identificador: string; validacion_id: string };
    generado_por?: string;
    generado_en: string;
    total_amount: number;
    total_registros: number;
    status: "generated" | "sent" | "reconciled";
    archivo_nombre: string;
    items?: PaymentBatchItem[];
}

export interface BatchesResponse {
    ok: boolean;
    batches: PaymentBatch[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface GenerateItem {
    purchase_id: string;
    monto?: number;
    referencia?: string;
}

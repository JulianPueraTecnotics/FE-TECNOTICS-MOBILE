export type PurchaseKind = "purchase" | "expense";

export interface SupplierBankInfo {
    banco?: string;
    tipo_cuenta?: string;
    numero_cuenta?: string;
    codigo_ach_banco?: string;
}

export interface SupplierAddress {
    value?: string;
    ciudad?: string;
    departamento?: string;
    pais?: string;
}

export interface Supplier {
    _id: string;
    company_id: string;
    name: string;
    doc_type?: string;
    doc_number: string;
    doc_number_dv?: string;
    email?: string;
    phone?: string;
    address?: SupplierAddress;
    bank?: SupplierBankInfo;
    source?: "manual" | "import";
    active?: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface PurchaseLine {
    code?: string;
    description: string;
    quantity: number;
    unit_price: number;
    iva_percent?: number;
    iva_value?: number;
    line_total: number;
    item_id?: string | null;
}

export interface Purchase {
    _id: string;
    company_id: string;
    kind: PurchaseKind;
    supplier_id: string;
    supplier_name: string;
    supplier_doc: string;
    document_type_code?: string;
    prefix?: string;
    number?: string;
    cufe?: string;
    issue_date?: string;
    currency?: string;
    subtotal: number;
    /** Ingresos para terceros (no son base gravable de la empresa). */
    ingresos_terceros?: number;
    iva_total: number;
    /** Impuesto al consumo (INC). */
    impuesto_consumo?: number;
    total: number;
    lines: PurchaseLine[];
    status: "imported" | "reviewed" | "paid" | "void";
    import_source: "manual" | "email";
    received_from?: string;
    total_retenido?: number;
    retenciones?: { codigo?: string; tipo?: string; cuenta?: string; base?: number; tarifa?: number; valor?: number }[];
    createdAt?: string;
    updatedAt?: string;
}

export interface SuppliersResponse {
    ok: boolean;
    suppliers: Supplier[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface PurchasesResponse {
    ok: boolean;
    purchases: Purchase[];
    total_amount: number;
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export interface ImportResultItem {
    fileName: string;
    ok: boolean;
    code: "IMPORTED" | "DUPLICATE" | "ERROR";
    message: string;
    purchase_id?: string;
    supplier_name?: string;
    document?: string;
    total?: number;
}

export interface ImportResponse {
    ok: boolean;
    results: ImportResultItem[];
    imported: number;
    duplicates: number;
    errors: number;
}

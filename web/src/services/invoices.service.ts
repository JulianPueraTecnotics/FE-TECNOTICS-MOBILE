import { API_ROUTES } from "../utils/global";
import type { Factura, CrearFacturaRequest, FacturasResponse } from "../types";

export interface GetInvoicesFilters {
    tipo_documento?: string;
    prefijo?: string;
    cliente?: string;
    total?: string;
    status?: string;
}

// ============================================
// OBTENER TODAS LAS FACTURAS
// ============================================
export const getAllInvoices = async (page = 1, limit = 20, filters?: GetInvoicesFilters): Promise<FacturasResponse | null> => {
    const query = new URLSearchParams({
        page: String(page),
        limit: String(limit),
    });

    if (filters?.tipo_documento?.trim()) query.set("tipo_documento", filters.tipo_documento.trim());
    if (filters?.prefijo?.trim()) query.set("prefijo", filters.prefijo.trim());
    if (filters?.cliente?.trim()) query.set("cliente", filters.cliente.trim());
    if (filters?.total?.trim()) query.set("total", filters.total.trim());
    if (filters?.status?.trim()) query.set("status", filters.status.trim().toUpperCase());

    const response = await fetch(`${API_ROUTES.INVOICES}?${query.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// OBTENER FACTURA POR ID
// ============================================
export const getInvoiceById = async (facturaId: string): Promise<{ ok: boolean; factura: Factura } | null> => {
    const response = await fetch(API_ROUTES.INVOICE_BY_ID(facturaId), {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// CREAR FACTURA
// ============================================
export const createInvoice = async (facturaData: CrearFacturaRequest): Promise<{ ok: boolean; factura: Factura; message: string } | null> => {
    const response = await fetch(API_ROUTES.INVOICES, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(facturaData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// DESCARGAR FACTURA (base64 PDF)
// ============================================
export const downloadInvoiceById = async (
    facturaId: string
): Promise<{
    ok: boolean;
    base64_factura?: string;
    mime_type?: string;
    file_name?: string;
    data_uri?: string;
    factura: Factura;
    message?: string;
} | null> => {
    const response = await fetch(API_ROUTES.INVOICE_DOWNLOAD(facturaId), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "No se pudo descargar la factura");
    }

    return data;
};

// ============================================
// REENVIAR FACTURA POR CORREO (POST sin cuerpo)
// ============================================
export const resendInvoiceEmail = async (facturaId: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.INVOICE_RESEND_EMAIL(facturaId), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    let data: { ok?: boolean; message?: string } = {};
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
    } catch {
        /* cuerpo vacío o no JSON */
    }

    if (!response.ok) {
        throw new Error(data.message || "No se pudo reenviar el correo");
    }

    return data;
};

// ============================================
// CONFIRMAR BORRADOR Y ENVIAR A LA DIAN (POST)
// ============================================
export const submitDraftInvoice = async (facturaId: string): Promise<{ ok?: boolean; message?: string; factura?: Factura } | null> => {
    const response = await fetch(API_ROUTES.INVOICE_SUBMIT_DRAFT(facturaId), {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
    });

    let data: { ok?: boolean; message?: string; factura?: Factura } = {};
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
    } catch {
        /* cuerpo vacío o no JSON */
    }

    if (!response.ok) {
        throw new Error(data.message || "No se pudo enviar el borrador a la DIAN");
    }

    return data;
};

// ============================================
// DESCARTAR (ELIMINAR) BORRADOR (DELETE)
// ============================================
export const discardDraftInvoice = async (facturaId: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.INVOICE_DISCARD_DRAFT(facturaId), {
        method: "DELETE",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    let data: { ok?: boolean; message?: string } = {};
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
    } catch {
        /* cuerpo vacío o no JSON */
    }

    if (!response.ok) {
        throw new Error(data.message || "No se pudo descartar el borrador");
    }

    return data;
};

// ============================================
// EXPORTAR FACTURAS A EXCEL (.xlsx)
// GET /invoices/export/excel?{start_date/end_date|month}&cliente&status
// ============================================
export interface ExportInvoicesExcelParams {
    start_date?: string; // YYYY-MM-DD
    end_date?: string; // YYYY-MM-DD
    month?: string; // YYYY-MM
    cliente?: string; // nombre o documento (NIT/ID)
    status?: string; // se compara en mayúsculas
}

export const exportInvoicesExcel = async (
    params: ExportInvoicesExcelParams,
): Promise<{ blob: Blob; fileName: string } | null> => {
    const query = new URLSearchParams();

    const hasRange = Boolean(params.start_date?.trim() && params.end_date?.trim());
    const hasMonth = Boolean(params.month?.trim());

    if (hasRange) {
        query.set("start_date", params.start_date!.trim());
        query.set("end_date", params.end_date!.trim());
    } else if (hasMonth) {
        query.set("month", params.month!.trim());
    } else {
        throw new Error("Debes enviar un rango de fechas (start_date/end_date) o un mes (month).");
    }

    if (params.cliente?.trim()) query.set("cliente", params.cliente.trim());
    if (params.status?.trim()) query.set("status", params.status.trim().toUpperCase());

    const url = `${API_ROUTES.INVOICES_EXPORT_EXCEL}?${query.toString()}`;

    const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers: {
            Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        },
    });

    if (!response.ok) {
        // El backend puede devolver JSON de error aunque el endpoint sea "descarga".
        const message =
            (await (async () => {
                try {
                    const data = await response.json();
                    return data?.message || data?.error || JSON.stringify(data);
                } catch {
                    try {
                        return await response.text();
                    } catch {
                        return `Error ${response.status} al exportar Excel`;
                    }
                }
            })()) as string;
        throw new Error(message || `Error ${response.status} al exportar Excel`);
    }

    const blob = await response.blob();

    const contentDisposition = response.headers.get("Content-Disposition") || "";
    const fileNameMatch = contentDisposition.match(/filename\*?=(?:UTF-8'')?["']?([^"';\n]+)["']?/i);
    const fileNameFromHeader = fileNameMatch?.[1];

    let fileName = fileNameFromHeader || "facturas.xlsx";
    if (!fileNameFromHeader) {
        if (hasRange) {
            fileName = `facturas-${params.start_date}-${params.end_date}.xlsx`;
        } else if (hasMonth) {
            fileName = `facturas-${params.month}.xlsx`;
        }
    }

    return { blob, fileName };
};

// ============================================
// CREAR FACTURA (formato fe-billing / POST /invoices)
// ============================================
export interface BillingInvoiceItem {
    code?: string;
    name: string;
    price: number;
    quantity: number;
    total: number;
    description: string;
    kind?: string;
    unidad_medida?: string;
    taxes: { iva: number; other?: number };
}

export interface CreateBillingInvoicePayload {
    client_id: string;
    items: BillingInvoiceItem[];
    headers: {
        f_elaboracion: string;
        f_vencimiento: string | null;
        forma_pago: string;
        moneda: string;
        prefijo: string;
        observaciones?: string;
        valor_letras?: string;
        tipo_documento?: string;
        tipo_factura?: string;
    };
    totales: {
        TotalMonetario: {
            ValorBruto: { IdMoneda: string; Value: number };
            ValorBaseImpuestos: { IdMoneda: string; Value: number };
            TotalMasImpuestos: { IdMoneda: string; Value: number };
            ValorAPagar: { IdMoneda: string; Value: number };
        };
    };
}

export interface CreateBillingInvoiceResponse {
    ok?: boolean;
    message?: string;
    factura?: Factura;
    _id?: string;
    id?: string;
}

export const createBillingInvoice = async (
    payload: CreateBillingInvoicePayload
): Promise<CreateBillingInvoiceResponse> => {
    const response = await fetch(API_ROUTES.INVOICES, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || data.error || "Error al crear la factura");
    }

    return data;
};

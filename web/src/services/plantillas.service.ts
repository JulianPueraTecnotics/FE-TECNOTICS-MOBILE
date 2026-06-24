import { API_ROUTES } from "../utils/global";
import type { TemplatesResponse, SetTemplateRequest } from "../types";

export interface GetTemplatesFilters {
    /** "all" | "recurrent" | una RecurrenceType específica */
    recurrence?: string;
    cliente?: string;
}

// ============================================
// LISTAR PLANTILLAS
// ============================================
export const getTemplates = async (filters?: GetTemplatesFilters): Promise<TemplatesResponse | null> => {
    const query = new URLSearchParams();
    if (filters?.recurrence?.trim()) query.set("recurrence", filters.recurrence.trim());
    if (filters?.cliente?.trim()) query.set("cliente", filters.cliente.trim());
    const qs = query.toString();

    const response = await fetch(`${API_ROUTES.PLANTILLAS}${qs ? `?${qs}` : ""}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// MARCAR/DESMARCAR UNA FACTURA COMO PLANTILLA
// ============================================
export const setInvoiceTemplate = async (
    facturaId: string,
    payload: SetTemplateRequest,
): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.INVOICE_SET_TEMPLATE(facturaId), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo actualizar la plantilla");
    return data;
};

// ============================================
// MARCAR PLANTILLA COMO FACTURADA (tras recrear)
// ============================================
export const markTemplateInvoiced = async (facturaId: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.PLANTILLA_MARK_INVOICED(facturaId), {
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
        /* cuerpo vacío */
    }
    if (!response.ok) throw new Error(data.message || "No se pudo registrar la facturación");
    return data;
};

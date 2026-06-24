import { API_ROUTES } from "../utils/global";
import type {
    IQuote,
    CreateQuoteRequest,
    UpdateQuoteRequest,
    QuotesResponse,
    CreateQuoteResponse,
    ConvertQuoteResponse,
    DeleteResponse,
} from "../types";

export interface GetQuotesFilters {
    status?: string;
    cliente?: string;
}

// ============================================
// OBTENER TODAS LAS COTIZACIONES
// ============================================
export const getAllQuotes = async (page = 1, limit = 20, filters?: GetQuotesFilters): Promise<QuotesResponse | null> => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status?.trim()) query.set("status", filters.status.trim());
    if (filters?.cliente?.trim()) query.set("cliente", filters.cliente.trim());

    const response = await fetch(`${API_ROUTES.QUOTES}?${query.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// BUSCAR COTIZACIONES
// ============================================
export const searchQuotes = async (searchTerm: string, page = 1, limit = 20): Promise<QuotesResponse | null> => {
    const response = await fetch(
        `${API_ROUTES.QUOTES_SEARCH}?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`,
        { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } },
    );

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// OBTENER COTIZACIÓN POR ID
// ============================================
export const getQuoteById = async (quoteId: string): Promise<{ ok: boolean; quote: IQuote } | null> => {
    const response = await fetch(API_ROUTES.QUOTE_BY_ID(quoteId), {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// CREAR COTIZACIÓN
// ============================================
export const createQuote = async (quoteData: CreateQuoteRequest): Promise<CreateQuoteResponse | null> => {
    const response = await fetch(API_ROUTES.QUOTES, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// ACTUALIZAR COTIZACIÓN
// ============================================
export const updateQuote = async (quoteId: string, quoteData: UpdateQuoteRequest): Promise<CreateQuoteResponse | null> => {
    const response = await fetch(API_ROUTES.QUOTE_BY_ID(quoteId), {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(quoteData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// ELIMINAR COTIZACIÓN
// ============================================
export const deleteQuote = async (quoteId: string): Promise<DeleteResponse | null> => {
    const response = await fetch(API_ROUTES.QUOTE_BY_ID(quoteId), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// REENVIAR COTIZACIÓN POR CORREO
// ============================================
export const sendQuoteEmail = async (
    quoteId: string,
    recipients?: string[],
): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.QUOTE_SEND_EMAIL(quoteId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(recipients?.length ? { recipients } : {}),
    });

    let data: { ok?: boolean; message?: string } = {};
    try {
        const text = await response.text();
        if (text.trim()) data = JSON.parse(text) as typeof data;
    } catch {
        /* cuerpo vacío o no JSON */
    }

    if (!response.ok) {
        throw new Error(data.message || "No se pudo enviar la cotización por correo");
    }

    return data;
};

// ============================================
// DESCARGAR PDF (base64)
// ============================================
export const downloadQuoteById = async (
    quoteId: string,
): Promise<{
    ok: boolean;
    base64_quote?: string;
    mime_type?: string;
    file_name?: string;
    data_uri?: string;
    message?: string;
} | null> => {
    const response = await fetch(API_ROUTES.QUOTE_DOWNLOAD(quoteId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "No se pudo descargar la cotización");
    }

    return data;
};

// ============================================
// CONVERTIR COTIZACIÓN → FACTURA
// ============================================
export const convertQuoteToInvoice = async (quoteId: string): Promise<ConvertQuoteResponse | null> => {
    const response = await fetch(API_ROUTES.QUOTE_CONVERT_TO_INVOICE(quoteId), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message || "No se pudo convertir la cotización en factura");
    }

    return data;
};

// ============================================
// VISTA PÚBLICA (sin auth)
// ============================================
export const getPublicQuote = async (slug: string): Promise<{ ok?: boolean; quote?: IQuote } | null> => {
    const response = await fetch(API_ROUTES.QUOTE_PUBLIC_BY_SLUG(slug), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Cotización no encontrada");
    return data;
};

export const downloadPublicQuote = async (
    slug: string,
): Promise<{ ok: boolean; base64_quote?: string; mime_type?: string; file_name?: string; data_uri?: string } | null> => {
    const response = await fetch(API_ROUTES.QUOTE_PUBLIC_DOWNLOAD(slug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo descargar la cotización");
    return data;
};

export const approvePublicQuote = async (slug: string, code: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.QUOTE_PUBLIC_APPROVE(slug), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ s_code: code }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Código inválido");
    return data;
};

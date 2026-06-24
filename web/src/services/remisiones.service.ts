import { API_ROUTES } from "../utils/global";
import type { RemisionesResponse, CreateRemisionRequest, CreateRemisionResponse, IRemision, DeleteResponse } from "../types";

export interface GetRemisionesFilters {
    status?: string;
    cliente?: string;
}

// ============================================
// LISTAR REMISIONES
// ============================================
export const getRemisiones = async (page = 1, limit = 20, filters?: GetRemisionesFilters): Promise<RemisionesResponse | null> => {
    const query = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (filters?.status?.trim()) query.set("status", filters.status.trim());
    if (filters?.cliente?.trim()) query.set("cliente", filters.cliente.trim());

    const response = await fetch(`${API_ROUTES.REMISIONES}?${query.toString()}`, {
        method: "GET",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// CREAR REMISIÓN (desde factura o cotización)
// ============================================
export const createRemision = async (payload: CreateRemisionRequest): Promise<CreateRemisionResponse | null> => {
    const response = await fetch(API_ROUTES.REMISIONES, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo crear la remisión");
    return data;
};

// ============================================
// ENVIAR LINK DE FIRMA AL CLIENTE
// ============================================
export const sendRemisionEmail = async (id: string): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.REMISION_SEND_EMAIL(id), {
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
        /* vacío */
    }
    if (!response.ok) throw new Error(data.message || "No se pudo enviar la remisión");
    return data;
};

// ============================================
// DESCARGAR PDF
// ============================================
export const downloadRemision = async (
    id: string,
): Promise<{ ok: boolean; base64_remision?: string; mime_type?: string; file_name?: string; data_uri?: string } | null> => {
    const response = await fetch(API_ROUTES.REMISION_DOWNLOAD(id), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo descargar la remisión");
    return data;
};

// ============================================
// ELIMINAR
// ============================================
export const deleteRemision = async (id: string): Promise<DeleteResponse | null> => {
    const response = await fetch(API_ROUTES.REMISION_BY_ID(id), {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message);
    return data;
};

// ============================================
// VISTA PÚBLICA (sin auth)
// ============================================
export const getPublicRemision = async (slug: string): Promise<{ ok?: boolean; remision?: IRemision } | null> => {
    const response = await fetch(API_ROUTES.REMISION_PUBLIC_BY_SLUG(slug), {
        method: "GET",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Remisión no encontrada");
    return data;
};

export const downloadPublicRemision = async (
    slug: string,
): Promise<{ ok: boolean; base64_remision?: string; mime_type?: string; file_name?: string; data_uri?: string } | null> => {
    const response = await fetch(API_ROUTES.REMISION_PUBLIC_DOWNLOAD(slug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo descargar");
    return data;
};

export const signPublicRemision = async (
    slug: string,
    token: string,
    signatureDataUrl: string,
    signedBy?: string,
): Promise<{ ok?: boolean; message?: string } | null> => {
    const response = await fetch(API_ROUTES.REMISION_PUBLIC_SIGN(slug), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ t: token, signature_data_url: signatureDataUrl, signed_by: signedBy }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "No se pudo firmar");
    return data;
};

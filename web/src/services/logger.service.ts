import { API_ROUTES } from "../utils/global";

export interface LogEntry {
    _id: string;
    date: string;
    company_id: string;
    description: string;
}

export interface LoggerPagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
}

export interface LoggerResponse {
    ok: boolean;
    logs: LogEntry[];
    pagination: LoggerPagination;
}

export interface LoggerClearResponse {
    ok: boolean;
    deletedCount: number;
    message: string;
}

/**
 * Lista los logs de la compañía del usuario autenticado (orden descendente por fecha).
 */
export const getLogs = async (
    page = 1,
    limit = 20
): Promise<LoggerResponse | null> => {
    try {
        const response = await fetch(
            `${API_ROUTES.LOGGER}?page=${page}&limit=${limit}`,
            {
                method: "GET",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
            }
        );

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message ?? "Error al cargar el registro de actividad");
        }

        return data;
    } catch (error) {
        throw error;
    }
};

// ── Pista de auditoría estructurada (quién/cuándo/qué) ──
export interface AuditEntry {
    _id: string;
    company_id: string;
    fecha: string;
    usuario?: string;
    rol?: string;
    accion: "create" | "update" | "delete" | "post" | "annul" | "send";
    entidad: "factura" | "compra" | "asiento" | "nomina" | "tercero" | "pago" | "otro";
    entidad_id?: string;
    referencia?: string;
    cambios?: unknown;
    descripcion?: string;
    ip?: string;
}
export interface AuditResponse {
    ok: boolean;
    items: AuditEntry[];
    pagination: LoggerPagination;
}
export interface AuditFilters {
    page?: number;
    limit?: number;
    entidad?: string;
    usuario?: string;
    accion?: string;
    desde?: string;
    hasta?: string;
}

/** Lista la pista de auditoría con filtros (paginada, más recientes primero). */
export const getAudit = async (filters: AuditFilters = {}): Promise<AuditResponse> => {
    const qs = new URLSearchParams();
    if (filters.page) qs.set("page", String(filters.page));
    if (filters.limit) qs.set("limit", String(filters.limit));
    if (filters.entidad) qs.set("entidad", filters.entidad);
    if (filters.usuario) qs.set("usuario", filters.usuario);
    if (filters.accion) qs.set("accion", filters.accion);
    if (filters.desde) qs.set("desde", filters.desde);
    if (filters.hasta) qs.set("hasta", filters.hasta);
    const url = qs.toString() ? `${API_ROUTES.AUDIT}?${qs.toString()}` : API_ROUTES.AUDIT;
    const response = await fetch(url, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message ?? "Error al cargar la pista de auditoría");
    return data;
};

/**
 * Elimina todos los logs de la compañía. Requiere confirmación en la UI.
 */
export const clearLogs = async (): Promise<LoggerClearResponse | null> => {
    try {
        const response = await fetch(API_ROUTES.LOGGER, {
            method: "DELETE",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message ?? "Error al vaciar el historial");
        }

        return data;
    } catch (error) {
        throw error;
    }
};

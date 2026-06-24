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

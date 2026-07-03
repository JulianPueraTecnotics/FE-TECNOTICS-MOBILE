import { API_ROUTES } from "../../utils/global";
import { getTecContext } from "./tec-context";

/**
 * Capa de servicio del asistente virtual TEC. Usa `fetch` con cookies (sesión HttpOnly),
 * igual que el resto del portal.
 */

export type TecRole = "user" | "assistant";

export interface TecMessage {
    role: TecRole;
    content: string;
    timestamp: string;
}

export interface SendMessageResponse {
    conversationId: string;
    reply: string;
    messages: TecMessage[];
}

const jsonOpts = (method: string, body?: unknown): RequestInit => ({
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((data as { message?: string }).message || "No pude responderte ahora. Intenta de nuevo.");
        (err as { status?: number }).status = res.status;
        throw err;
    }
    return data as T;
}

/** El módulo TEC es opcional; si el backend no tiene IA configurada responde 503. */
export const isTecUnavailable = (error: unknown): boolean => (error as { status?: number } | null)?.status === 503;

export const sendTecMessage = async (message: string, conversationId?: string | null): Promise<SendMessageResponse> => {
    // Adjunta el contexto de la pantalla actual (si la pantalla lo publicó), para respuestas específicas.
    const contexto = getTecContext() ?? undefined;
    return parse(await fetch(API_ROUTES.TEC_MESSAGE, jsonOpts("POST", { message, conversationId: conversationId ?? undefined, contexto })));
};

export const sendTecByEmail = async (conversationId: string, messageIndex?: number): Promise<{ message: string; email: string }> =>
    parse(await fetch(API_ROUTES.TEC_SEND_BY_EMAIL, jsonOpts("POST", { conversationId, messageIndex })));

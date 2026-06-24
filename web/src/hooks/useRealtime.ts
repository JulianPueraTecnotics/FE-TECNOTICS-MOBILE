import { useContext, useEffect, useRef } from "react";
import { AuthContext } from "../store/auth.context";
import { connectSocket, type RealtimeEvent, type RealtimePayload } from "../services/socket";

/**
 * Suscribe un handler a un evento de tiempo real del backend (socket.io).
 * Conecta el socket a la room de la empresa del usuario y limpia al desmontar.
 *
 * Uso típico en una página de listado:
 *   useRealtime(RealtimeEvents.RECAUDO_CHANGED, () => setRefreshKey(k => k + 1));
 */
export function useRealtime(event: RealtimeEvent, handler: (payload: RealtimePayload) => void): void {
    const { user } = useContext(AuthContext);
    const handlerRef = useRef(handler);

    // Mantener el handler actualizado sin re-suscribir el socket en cada render.
    useEffect(() => {
        handlerRef.current = handler;
    }, [handler]);

    useEffect(() => {
        const companyId = user?.company_id;
        if (!companyId) return;
        const socket = connectSocket(companyId);
        const listener = (payload: RealtimePayload) => handlerRef.current(payload);
        socket.on(event, listener);
        return () => {
            socket.off(event, listener);
        };
    }, [event, user?.company_id]);
}

/**
 * Aplica un cambio de tiempo real a una lista de forma QUIRÚRGICA (sin recargar todo):
 * - created: inserta la fila al inicio (si no existe ya).
 * - updated/signed/paid: reemplaza la fila por su id.
 * - deleted: quita la fila por id.
 * Devuelve la nueva lista. `getId` extrae el id de cada elemento (por defecto `_id`).
 */
export function applyRealtimeChange<T extends { _id: string }>(
    list: T[],
    payload: RealtimePayload,
    getId: (x: T) => string = (x) => x._id,
): T[] {
    const item = payload.item as T | undefined;
    const id = payload.id;
    if (payload.action === "deleted" && id) {
        return list.filter((x) => getId(x) !== id);
    }
    if (!item) return list; // sin entidad no podemos actualizar quirúrgicamente
    const itemId = getId(item);
    const exists = list.some((x) => getId(x) === itemId);
    if (payload.action === "created") {
        return exists ? list.map((x) => (getId(x) === itemId ? item : x)) : [item, ...list];
    }
    // updated / signed / paid
    return exists ? list.map((x) => (getId(x) === itemId ? item : x)) : [item, ...list];
}

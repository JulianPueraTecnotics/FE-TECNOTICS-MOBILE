import { io, type Socket } from "socket.io-client";
import { ENV } from "../utils/global";

/** Eventos de tiempo real (deben coincidir con RealtimeEvents del backend). */
export const RealtimeEvents = {
    INVOICE_CHANGED: "invoice:changed",
    RECAUDO_CHANGED: "recaudo:changed",
    QUOTE_CHANGED: "quote:changed",
    REMISION_CHANGED: "remision:changed",
    TEMPLATE_CHANGED: "template:changed",
    CLIENT_CHANGED: "client:changed",
    SUPPLIER_CHANGED: "supplier:changed",
    PURCHASE_CHANGED: "purchase:changed",
    BANK_CHANGED: "bank:changed",
    BATCH_CHANGED: "batch:changed",
    JOURNAL_CHANGED: "journal:changed",
    TERCERO_CHANGED: "tercero:changed",
    ASSET_CHANGED: "asset:changed",
} as const;
export type RealtimeEvent = (typeof RealtimeEvents)[keyof typeof RealtimeEvents];

export interface RealtimePayload {
    action: "created" | "updated" | "deleted" | "signed" | "paid";
    id?: string;
    label?: string;
    /** Entidad afectada (fila/DTO) para actualizar quirúrgicamente sin re-fetch. */
    item?: unknown;
}

let socket: Socket | null = null;
let joinedCompany: string | null = null;

/** Conecta el socket (una sola vez) y se une a la room de la empresa. */
export function connectSocket(companyId: string): Socket {
    if (!socket) {
        socket = io(ENV.API_URL, {
            transports: ["websocket", "polling"],
            withCredentials: true,
            autoConnect: true,
        });
        socket.on("connect", () => {
            if (joinedCompany) socket?.emit("join", { company_id: joinedCompany });
        });
    }
    if (companyId && companyId !== joinedCompany) {
        joinedCompany = companyId;
        if (socket.connected) socket.emit("join", { company_id: companyId });
    }
    return socket;
}

export function getSocket(): Socket | null {
    return socket;
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect();
        socket = null;
        joinedCompany = null;
    }
}

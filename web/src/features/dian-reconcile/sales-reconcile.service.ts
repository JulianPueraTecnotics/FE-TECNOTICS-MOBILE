import { API_ROUTES } from "../../utils/global";
import type { ReconStatus, ReconSummary } from "./reconcile.service";

/** Servicio de conciliación DIAN de EMITIDAS (ventas) ↔ facturas locales. */

export interface SalesReconItem {
    _id: string;
    sync_job_id: string;
    status: ReconStatus;
    dian_document_id?: string | null;
    factura_id?: string | null;
    cufe?: string;
    prefijo?: string;
    folio?: string;
    /** En ventas, el "nit_emisor" de la fila contiene el NIT del CLIENTE (receptor). */
    nit_emisor?: string;
    nombre_emisor?: string;
    fecha_emision?: string;
    total?: number;
    message?: string;
    resolved_at?: string | null;
}

const json = (method: string, body?: unknown): RequestInit => ({
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((data as { message?: string }).message || "Error en la conciliación de emitidas") as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return data as T;
}

export const runReconcileSales = async (syncJobId: string): Promise<{ matchOk: number; mismatch: number; dianOnly: number; localOnly: number }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILE_SALES(syncJobId), json("POST")));

export const getSalesSummary = async (syncJobId: string): Promise<{ summary: ReconSummary }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILE_SALES_SUMMARY(syncJobId), json("GET")));

export const listSalesReconciliations = async (opts: { syncJobId?: string; status?: string; active?: boolean; nit?: string; page?: number; pageSize?: number }): Promise<{ items: SalesReconItem[]; total: number; page: number; pageSize: number; pageCount: number }> => {
    const p = new URLSearchParams();
    if (opts.syncJobId) p.set("syncJobId", opts.syncJobId);
    if (opts.status) p.set("status", opts.status);
    if (opts.active) p.set("active", "true");
    if (opts.nit) p.set("nit", opts.nit);
    p.set("page", String(opts.page ?? 1));
    p.set("pageSize", String(opts.pageSize ?? 20));
    return parse(await fetch(`${API_ROUTES.DIAN_SALES_RECONCILIATIONS}?${p.toString()}`, json("GET")));
};

/** Importa una factura emitida faltante (dian_only) como factura externa local. */
export const importSalesFaltante = async (itemId: string): Promise<{ message: string; facturaId: string }> =>
    parse(await fetch(API_ROUTES.DIAN_SALES_RECONCILIATION_IMPORT(itemId), json("POST")));

/** Importa en lote varias facturas emitidas (ej. todas las de un cliente). */
export const importSalesBulk = async (itemIds: string[]): Promise<{ message: string; imported: number; failed: number }> =>
    parse(await fetch(API_ROUTES.DIAN_SALES_RECONCILIATION_IMPORT_BULK, json("POST", { itemIds })));

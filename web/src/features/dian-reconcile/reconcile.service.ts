import { API_ROUTES } from "../../utils/global";

/** Servicio de conciliación DIAN ↔ local (compras). Usa fetch con cookies. */

export type ReconStatus = "match_ok" | "mismatch" | "dian_only" | "local_only";

export interface ReconItem {
    _id: string;
    sync_job_id: string;
    status: ReconStatus;
    dian_document_id?: string | null;
    purchase_id?: string | null;
    cufe?: string;
    prefijo?: string;
    folio?: string;
    nit_emisor?: string;
    nombre_emisor?: string;
    fecha_emision?: string;
    total?: number;
    message?: string;
    resolved_at?: string | null;
}

export interface ReconSummary { match_ok: number; mismatch: number; dian_only: number; local_only: number }

const json = (method: string, body?: unknown): RequestInit => ({
    method,
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(res: Response): Promise<T> {
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error((data as { message?: string }).message || "Error en la conciliación") as Error & { status?: number };
        err.status = res.status;
        throw err;
    }
    return data as T;
}

/** Lista los sync jobs (para elegir cuál conciliar). Reusa el endpoint de sync. */
export const listSyncJobs = async (): Promise<{ jobs: { _id: string; created: string; filters: { fromDate: string; toDate: string }; status: string }[] }> =>
    parse(await fetch(`${API_ROUTES.DIAN_SYNC}?page=1&pageSize=50`, json("GET")));

export const runReconcile = async (syncJobId: string): Promise<{ matchOk: number; mismatch: number; dianOnly: number; localOnly: number }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILE(syncJobId), json("POST")));

export const getSummary = async (syncJobId: string): Promise<{ summary: ReconSummary }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILE_SUMMARY(syncJobId), json("GET")));

export const listReconciliations = async (opts: { syncJobId?: string; status?: string; active?: boolean; nit?: string; page?: number; pageSize?: number }): Promise<{ items: ReconItem[]; total: number; page: number; pageSize: number; pageCount: number }> => {
    const p = new URLSearchParams();
    if (opts.syncJobId) p.set("syncJobId", opts.syncJobId);
    if (opts.status) p.set("status", opts.status);
    if (opts.active) p.set("active", "true");
    if (opts.nit) p.set("nit", opts.nit);
    p.set("page", String(opts.page ?? 1));
    p.set("pageSize", String(opts.pageSize ?? 20));
    return parse(await fetch(`${API_ROUTES.DIAN_RECONCILIATIONS}?${p.toString()}`, json("GET")));
};

/** Importa una factura faltante (dian_only) como compra o gasto. */
export const importFaltante = async (itemId: string, kind: "purchase" | "expense"): Promise<{ message: string; purchaseId: string }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILIATION_IMPORT(itemId), json("POST", { kind })));

/** Importa en lote varios items (ej. todos los de un proveedor) como compra o gasto. */
export const importBulk = async (itemIds: string[], kind: "purchase" | "expense"): Promise<{ message: string; imported: number; failed: number }> =>
    parse(await fetch(API_ROUTES.DIAN_RECONCILIATION_IMPORT_BULK, json("POST", { itemIds, kind })));

/** Reclasifica una compra a gasto (o viceversa). */
export const setPurchaseKind = async (purchaseId: string, kind: "purchase" | "expense"): Promise<{ message: string }> =>
    parse(await fetch(API_ROUTES.PURCHASE_SET_KIND(purchaseId), json("PATCH", { kind })));

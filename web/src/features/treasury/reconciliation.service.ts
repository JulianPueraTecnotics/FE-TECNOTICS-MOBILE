import { API_ROUTES } from "../../utils/global";

const json = (method: string, body?: unknown) => ({
    method,
    credentials: "include" as RequestCredentials,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
}

export interface StatementLine {
    fecha?: string;
    descripcion: string;
    referencia?: string;
    valor: number;
    estado: "pendiente" | "conciliado";
    match_libro_idx?: number | null;
}
export interface BookMovement {
    entry_id: string;
    tipo: string;
    consecutivo: number;
    fecha?: string;
    descripcion: string;
    valor: number;
    estado: "pendiente" | "conciliado";
    match_extracto_idx?: number | null;
}
export interface ReconItem { tipo: string; descripcion: string; valor: number }
export interface Reconciliation {
    _id: string;
    cuenta: string;
    cuenta_nombre?: string;
    desde?: string;
    hasta?: string;
    saldo_banco: number;
    saldo_libros: number;
    statement: StatementLine[];
    books: BookMovement[];
    conciliatorias: ReconItem[];
    estado: "borrador" | "cerrada";
}
export interface ReconSummary {
    conciliado_extracto: number;
    pendiente_extracto: number;
    pendiente_libros: number;
    conciliatorias: number;
    diferencia: number;
}

export const getReconciliations = async (): Promise<{ ok: boolean; recons: Reconciliation[] }> => parse(await fetch(API_ROUTES.TREASURY_RECONS, json("GET")));
export const getReconciliation = async (id: string): Promise<{ ok: boolean; recon: Reconciliation }> => parse(await fetch(API_ROUTES.TREASURY_RECON_BY_ID(id), json("GET")));
export const buildReconciliation = async (payload: { desde?: string; hasta?: string; saldo_banco: number; statement: { fecha?: string; descripcion: string; referencia?: string; valor: number }[] }): Promise<{ ok: boolean; recon: Reconciliation }> =>
    parse(await fetch(API_ROUTES.TREASURY_RECONS, json("POST", payload)));
export const getReconSummary = async (id: string): Promise<{ ok: boolean; resumen: ReconSummary }> => parse(await fetch(API_ROUTES.TREASURY_RECON_SUMMARY(id), json("GET")));
export const toggleMatch = async (id: string, extractoIdx: number, libroIdx: number | null): Promise<{ ok: boolean; recon: Reconciliation }> =>
    parse(await fetch(API_ROUTES.TREASURY_RECON_MATCH(id), json("POST", { extractoIdx, libroIdx })));
export const setConciliatorias = async (id: string, items: ReconItem[]): Promise<{ ok: boolean; recon: Reconciliation; resumen: ReconSummary }> =>
    parse(await fetch(API_ROUTES.TREASURY_RECON_CONCILIATORIAS(id), json("POST", { items })));
export const postAdjustment = async (id: string, descripcion: string, valor: number, cuentaGasto: string): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_RECON_ADJUSTMENT(id), json("POST", { descripcion, valor, cuentaGasto })));
export const closeReconciliation = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.TREASURY_RECON_CLOSE(id), json("POST")));

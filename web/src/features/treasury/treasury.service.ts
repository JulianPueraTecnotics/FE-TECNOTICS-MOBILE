import { API_ROUTES } from "../../utils/global";
import type { AchBank, Bank, PayableResponse, BatchesResponse, PaymentBatch, GenerateItem } from "./treasury.types";

const json = (method: string, body?: unknown) => ({
    method,
    credentials: "include" as RequestCredentials,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(response: Response): Promise<T> {
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
}

// ── Catálogo ACH ──
export const getAchCatalog = async (): Promise<{ ok: boolean; banks: AchBank[] }> =>
    parse(await fetch(API_ROUTES.TREASURY_ACH_CATALOG, json("GET")));

// ── Bancos de la empresa ──
export const getBanks = async (): Promise<{ ok: boolean; banks: Bank[] }> => parse(await fetch(API_ROUTES.TREASURY_BANKS, json("GET")));
export const createBank = async (payload: Partial<Bank>): Promise<{ ok: boolean; bank: Bank }> => parse(await fetch(API_ROUTES.TREASURY_BANKS, json("POST", payload)));
export const updateBank = async (id: string, payload: Partial<Bank>): Promise<{ ok: boolean; bank: Bank }> => parse(await fetch(API_ROUTES.TREASURY_BANK_BY_ID(id), json("PUT", payload)));
export const deleteBank = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.TREASURY_BANK_BY_ID(id), json("DELETE")));

// ── Pagos / lotes ──
export const getPayable = async (search = "", supplierId = ""): Promise<PayableResponse> => {
    const qs = new URLSearchParams();
    if (search) qs.set("search", search);
    if (supplierId) qs.set("supplierId", supplierId);
    return parse(await fetch(`${API_ROUTES.TREASURY_PAYABLE}?${qs.toString()}`, json("GET")));
};

export const generateBatch = async (bankId: string, items: GenerateItem[]): Promise<{ ok: boolean; batch: PaymentBatch; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BATCHES, json("POST", { bankId, items })));

export const getBatches = async (page = 1, limit = 20): Promise<BatchesResponse> => parse(await fetch(`${API_ROUTES.TREASURY_BATCHES}?page=${page}&limit=${limit}`, json("GET")));
export const getBatch = async (id: string): Promise<{ ok: boolean; batch: PaymentBatch }> => parse(await fetch(API_ROUTES.TREASURY_BATCH_BY_ID(id), json("GET")));
export const markBatchSent = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.TREASURY_BATCH_SENT(id), json("POST")));
export const reconcileBatch = async (id: string, purchaseIds?: string[]): Promise<{ ok: boolean; conciliados: number; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BATCH_RECONCILE(id), json("POST", { purchaseIds })));
export const sendComprobantes = async (id: string): Promise<{ ok: boolean; enviados: number; sinCorreo: number; errores: number }> =>
    parse(await fetch(API_ROUTES.TREASURY_BATCH_COMPROBANTES(id), json("POST")));

/** Descarga el archivo ACH del lote como .txt. */
export const downloadBatchFile = async (id: string, fileName: string): Promise<void> => {
    const res = await fetch(API_ROUTES.TREASURY_BATCH_DOWNLOAD(id), { method: "GET", credentials: "include" });
    if (!res.ok) throw new Error("No se pudo descargar el archivo del lote");
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName || "lote.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

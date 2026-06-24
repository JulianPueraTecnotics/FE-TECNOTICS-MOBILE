import { API_ROUTES } from "../../utils/global";
import type { Supplier, SuppliersResponse, PurchasesResponse, Purchase, ImportResponse, PurchaseKind } from "./purchases.types";

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

// ===== Proveedores =====
export const getAllSuppliers = async (page = 1, limit = 20, search = ""): Promise<SuppliersResponse> => {
    const url = `${API_ROUTES.SUPPLIERS}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
    return parse<SuppliersResponse>(await fetch(url, json("GET")));
};

export const createSupplier = async (payload: Partial<Supplier>): Promise<{ ok: boolean; supplier: Supplier }> => {
    return parse(await fetch(API_ROUTES.SUPPLIERS, json("POST", payload)));
};

export const updateSupplier = async (id: string, payload: Partial<Supplier>): Promise<{ ok: boolean; supplier: Supplier }> => {
    return parse(await fetch(API_ROUTES.SUPPLIER_BY_ID(id), json("PUT", payload)));
};

export const deleteSupplier = async (id: string): Promise<{ ok: boolean; message: string }> => {
    return parse(await fetch(API_ROUTES.SUPPLIER_BY_ID(id), json("DELETE")));
};

// ===== Compras / Gastos =====
export const getPurchases = async (kind: PurchaseKind, page = 1, limit = 20, search = ""): Promise<PurchasesResponse> => {
    const url = `${API_ROUTES.PURCHASES_LIST(kind)}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`;
    return parse<PurchasesResponse>(await fetch(url, json("GET")));
};

export const getPurchaseById = async (id: string): Promise<{ ok: boolean; purchase: Purchase }> => {
    return parse(await fetch(API_ROUTES.PURCHASE_BY_ID(id), json("GET")));
};

export const deletePurchase = async (id: string): Promise<{ ok: boolean; message: string }> => {
    return parse(await fetch(API_ROUTES.PURCHASE_BY_ID(id), json("DELETE")));
};

// ===== Retenciones =====
export interface RetentionLine {
    concepto_id: string;
    codigo: string;
    descripcion: string;
    tipo: string;
    cuenta: string;
    base: number;
    tarifa: number;
    base_minima: number;
    aplica: boolean;
    valor: number;
}
export interface RetentionPreview {
    ok: boolean;
    base: number;
    anio: number;
    uvt: number;
    lines: RetentionLine[];
    total_retenido: number;
}
export const previewRetention = async (purchaseId: string, conceptoIds: string[]): Promise<RetentionPreview> =>
    parse<RetentionPreview>(await fetch(API_ROUTES.PURCHASE_RETENTION_PREVIEW(purchaseId), json("POST", { conceptoIds })));
export const applyRetention = async (purchaseId: string, conceptoIds: string[]): Promise<{ ok: boolean; total_retenido: number; aplicadas: number; message: string }> =>
    parse(await fetch(API_ROUTES.PURCHASE_RETENTION_APPLY(purchaseId), json("POST", { conceptoIds })));

/** Archivo web (File) o asset nativo para multipart en React Native. */
export type PurchaseUploadFile = File | { uri: string; name: string; type: string };

/** Importa uno o varios archivos (XML o ZIP) al módulo compras/gastos. */
export const importPurchaseFiles = async (
  kind: PurchaseKind,
  files: PurchaseUploadFile[]
): Promise<ImportResponse> => {
    const formData = new FormData();
    files.forEach((f) => formData.append("files", f as unknown as Blob));
    formData.append("kind", kind);
    const response = await fetch(API_ROUTES.PURCHASES_IMPORT(kind), {
        method: "POST",
        credentials: "include",
        body: formData, // sin Content-Type: el navegador pone el boundary del multipart
    });
    return parse<ImportResponse>(response);
};

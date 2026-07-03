import { API_ROUTES } from "../../utils/global";
import { appendNativeFiles, type NativeUploadFile } from "../treasury/uploadFiles.shared";
import type { Supplier, SuppliersResponse, PurchasesResponse, Purchase, ImportResponse, PurchaseKind } from "./purchases.types";

export type PurchaseUploadFile = NativeUploadFile;

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

/** Reclasifica un documento entre compra y gasto (por si se importó/causó en el módulo equivocado). */
export const setPurchaseKind = async (id: string, kind: PurchaseKind): Promise<{ ok: boolean; message: string }> => {
    return parse(await fetch(API_ROUTES.PURCHASE_SET_KIND(id), json("PATCH", { kind })));
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

// ===== Retefuente AGRUPADA POR CATEGORÍA (por factura) =====
export interface RetentionGroup {
    categoria: string;
    base: number;
    concepto_id?: string;
    codigo?: string;
    descripcion?: string;
    cuenta?: string;
    tarifa: number;
    base_minima: number;
    aplica: boolean;
    valor: number;
    items: { descripcion: string; base: number }[];
}
export interface GroupedRetentionResult {
    ok: boolean;
    anio: number;
    uvt: number;
    groups: RetentionGroup[];
    total_retenido: number;
}
/** Previsualiza la retefuente agrupada por categoría de la factura (suma ítems por categoría vs tope). */
export const previewGroupedRetention = async (purchaseId: string): Promise<GroupedRetentionResult> =>
    parse<GroupedRetentionResult>(await fetch(API_ROUTES.PURCHASE_RETENTION_GROUPED(purchaseId), json("GET")));
/** Aplica la retefuente agrupada por categoría y recontabiliza. */
export const applyGroupedRetention = async (purchaseId: string): Promise<{ ok: boolean; total_retenido: number; aplicadas: number; message: string }> =>
    parse(await fetch(API_ROUTES.PURCHASE_RETENTION_GROUPED(purchaseId), json("POST")));

/** Importa uno o varios archivos (XML o ZIP) al módulo compras/gastos. */
export const importPurchaseFiles = async (
  kind: PurchaseKind,
  files: (File | PurchaseUploadFile)[],
): Promise<ImportResponse> => {
  const formData = new FormData();
  const native = files.filter((f): f is PurchaseUploadFile => "uri" in f);
  const web = files.filter((f): f is File => !("uri" in f));
  appendNativeFiles(formData, native);
  web.forEach((f) => formData.append("files", f));
  formData.append("kind", kind);
  const response = await fetch(API_ROUTES.PURCHASES_IMPORT(kind), {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  return parse<ImportResponse>(response);
};

/** Obtiene el PDF de la factura (subido manual o el de la DIAN). Devuelve un blob URL para abrir/incrustar. */
export const getPurchasePdfUrl = async (id: string): Promise<string> => {
    const response = await fetch(API_ROUTES.PURCHASE_PDF(id), { method: "GET", credentials: "include" });
    if (!response.ok) {
        let msg = "No se pudo obtener el PDF";
        try { msg = (await response.json()).message || msg; } catch { /* respuesta no-JSON */ }
        throw new Error(msg);
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
};

/** Sube un PDF para adjuntarlo a la factura (para que el contador revise a qué corresponde). */
export const uploadPurchasePdf = async (
  id: string,
  file: File | PurchaseUploadFile,
): Promise<{ ok: boolean; message: string }> => {
  const formData = new FormData();
  if ("uri" in file) {
    appendNativeFiles(formData, [file]);
  } else {
    formData.append("files", file);
  }
  const response = await fetch(API_ROUTES.PURCHASE_PDF(id), { method: "POST", credentials: "include", body: formData });
  return parse(response);
};

export interface ExcelImportResult { fila: number; ok: boolean; code: string; message: string }
/** Importa compras/gastos desde la plantilla Excel (1 fila = 1 factura). */
export const importPurchaseExcel = async (kind: PurchaseKind, file: File): Promise<{ ok: boolean; imported: number; duplicates: number; errors: number; results: ExcelImportResult[] }> => {
    const formData = new FormData();
    formData.append("files", file);
    formData.append("kind", kind);
    const response = await fetch(API_ROUTES.PURCHASES_IMPORT_EXCEL(kind), { method: "POST", credentials: "include", body: formData });
    return parse(response);
};

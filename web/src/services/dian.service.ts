import { API_ROUTES } from "../utils/global";

/**
 * Capa de servicios del módulo de Sincronización con la DIAN. Usa `fetch` con cookies (igual que el
 * resto del frontend). El backend automatiza el portal DIAN con Playwright; aquí solo consumimos la API.
 */

const jsonHeaders = { "Content-Type": "application/json" };

// ── Tipos ─────────────────────────────────────────────────────────────────

export interface DianCredential {
    _id: string;
    company_id: string;
    label: string;
    nit: string;
    token_pk: string;
    token_rk: string;
    token_received_at: string;
    token_expires_at: string;
    responsible_doc_type?: string;
    responsible_id?: string;
    responsible_first_name?: string;
    responsible_last_name?: string;
    last_login_at?: string;
    last_login_error?: string;
    created: string;
}

export type DianSyncGroup = "received" | "emitted" | "all";
export type DianSyncStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface DianSyncFilters {
    fromDate: string;
    toDate: string;
    documentTypeId?: string;
    senderCode?: string;
    group?: DianSyncGroup;
}

export interface DianSyncJob {
    _id: string;
    company_id: string;
    credential_id: string;
    status: DianSyncStatus;
    /** Mensaje de fase mientras corre (ej. "Descargando PDFs 12/127"). */
    progress?: string;
    total_listed: number;
    /** Documentos con PDF descargable (excluye acuses). Objetivo real de la descarga. */
    total_pdf_target?: number;
    total_downloaded: number;
    total_imported: number;
    total_skipped: number;
    total_failed: number;
    /** Enriquecimiento desde PDF (función 3): proveedores y productos creados al leer los PDFs. */
    enrich_providers_created?: number;
    enrich_items_created?: number;
    enrich_docs_failed?: number;
    error_message?: string;
    started_at?: string;
    finished_at?: string;
    excel_file_path?: string | null;
    excel_filename?: string | null;
    filters: DianSyncFilters;
    created: string;
}

export interface DianDocument {
    _id: string;
    company_id: string;
    sync_job_id: string;
    cufe: string;
    tipo_documento?: string;
    folio?: string;
    prefijo?: string;
    fecha_emision?: string;
    fecha_recepcion?: string;
    nit_emisor?: string;
    nombre_emisor?: string;
    nit_receptor?: string;
    nombre_receptor?: string;
    iva?: number;
    total?: number;
    estado?: string;
    grupo?: string;
    /** "venta" (emitida), "compra" (recibida válida), "ajena". Los "acuse" no se listan. */
    clasificacion?: DianClasificacion;
    pdf_file_path?: string | null;
}

export type DianClasificacion = "venta" | "compra" | "ajena";
export const DIAN_CLASIFICACION_LABELS: Record<DianClasificacion, string> = {
    venta: "Venta (emitida)",
    compra: "Compra/gasto",
    ajena: "Ajena",
};

export type DianEventCode = "030" | "031" | "032" | "033";
export type DianEventStatus = "pending" | "emitted" | "failed";

export interface DianEvent {
    _id: string;
    company_id: string;
    cufe: string;
    event_code: DianEventCode;
    event_prefix?: string;
    status: DianEventStatus;
    error_message?: string;
    emitted_at?: string;
    created: string;
}

export interface DianLog {
    _id: string;
    company_id: string;
    event: string;
    message?: string;
    duration_ms?: number;
    createdAt: string;
}

export interface Paginated {
    total: number;
    page: number;
    pageSize: number;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function jsonRequest<T>(url: string, method: string, body?: unknown): Promise<T> {
    const response = await fetch(url, {
        method,
        credentials: "include",
        headers: jsonHeaders,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error((data as { message?: string }).message || "Error en la solicitud") as Error & { status?: number };
        err.status = response.status;
        throw err;
    }
    return data as T;
}

/** True si el error proviene de que el módulo DIAN no está configurado (503): es opcional, no un fallo real. */
export const isDianModuleUnavailable = (error: unknown): boolean =>
    (error as { status?: number } | null)?.status === 503;

/** Descarga un blob de un endpoint protegido y dispara la descarga en el navegador. */
async function downloadBlob(url: string, fallbackName: string): Promise<{ total?: number; succeeded?: number; failed?: number }> {
    const response = await fetch(url, { method: "GET", credentials: "include" });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "No se pudo descargar el archivo");
    }
    const meta = {
        total: Number(response.headers.get("X-PDFs-Total")) || undefined,
        succeeded: Number(response.headers.get("X-PDFs-Succeeded")) || undefined,
        failed: Number(response.headers.get("X-PDFs-Failed")) || undefined,
    };
    const disposition = response.headers.get("Content-Disposition") || "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || fallbackName;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    return meta;
}

// ── Estado del módulo ────────────────────────────────────────────────────────

/** Estado del módulo DIAN. No lanza 503: `enabled=false` cuando está apagado por defecto. */
export const getDianStatus = async (): Promise<{ enabled: boolean }> =>
    jsonRequest(API_ROUTES.DIAN_STATUS, "GET");

// ── Credenciales ─────────────────────────────────────────────────────────────

export const listCredentials = async (): Promise<{ credentials: DianCredential[] }> =>
    jsonRequest(API_ROUTES.DIAN_CREDENTIALS, "GET");

export const upsertCredential = async (accessUrl: string, label?: string): Promise<{ credential: DianCredential }> =>
    jsonRequest(API_ROUTES.DIAN_CREDENTIALS, "POST", { accessUrl, label });

export const refreshCredentialToken = async (id: string, accessUrl: string): Promise<{ credential: DianCredential }> =>
    jsonRequest(API_ROUTES.DIAN_CREDENTIAL_REFRESH_TOKEN(id), "PUT", { accessUrl });

export const updateResponsible = async (
    id: string,
    input: Pick<DianCredential, "responsible_doc_type" | "responsible_id" | "responsible_first_name" | "responsible_last_name">,
): Promise<{ credential: DianCredential }> => jsonRequest(API_ROUTES.DIAN_CREDENTIAL_RESPONSIBLE(id), "PATCH", input);

export const validateCredential = async (id: string): Promise<{ ok: boolean }> =>
    jsonRequest(API_ROUTES.DIAN_CREDENTIAL_VALIDATE(id), "POST");

export const deleteCredential = async (id: string): Promise<{ message: string }> =>
    jsonRequest(API_ROUTES.DIAN_CREDENTIAL_BY_ID(id), "DELETE");

// ── Sincronización ─────────────────────────────────────────────────────────

export const triggerSync = async (input: {
    credentialId: string;
    fromDate: string;
    toDate: string;
    documentTypeId?: string;
    senderCode?: string;
    group?: DianSyncGroup;
}): Promise<{ jobId: string; status: string }> => jsonRequest(API_ROUTES.DIAN_SYNC, "POST", input);

export const listSyncJobs = async (page = 1, pageSize = 20): Promise<Paginated & { jobs: DianSyncJob[] }> =>
    jsonRequest(`${API_ROUTES.DIAN_SYNC}?page=${page}&pageSize=${pageSize}`, "GET");

export const getSyncJob = async (id: string): Promise<{ job: DianSyncJob }> =>
    jsonRequest(API_ROUTES.DIAN_SYNC_BY_ID(id), "GET");

export const deleteSyncJob = async (id: string): Promise<{ message: string }> =>
    jsonRequest(API_ROUTES.DIAN_SYNC_BY_ID(id), "DELETE");

export interface EnrichResult {
    docsProcessed: number;
    providersCreated: number;
    providersExisting: number;
    itemsCreated: number;
    docsFailed: number;
    docsSkipped: number;
}
/** Re-ejecuta la función 3: lee los PDFs del job y crea proveedores + productos. */
export const enrichSyncJob = async (id: string): Promise<{ message: string; result: EnrichResult }> =>
    jsonRequest(API_ROUTES.DIAN_SYNC_ENRICH(id), "POST");

export const listSyncDocuments = async (
    id: string,
    opts: { page?: number; pageSize?: number; clasificacion?: string; nit_emisor?: string; tipo_documento?: string } = {},
): Promise<Paginated & { documents: DianDocument[] }> => {
    const params = new URLSearchParams();
    params.set("page", String(opts.page ?? 1));
    params.set("pageSize", String(opts.pageSize ?? 20));
    if (opts.clasificacion) params.set("clasificacion", opts.clasificacion);
    if (opts.nit_emisor) params.set("nit_emisor", opts.nit_emisor);
    if (opts.tipo_documento) params.set("tipo_documento", opts.tipo_documento);
    return jsonRequest(`${API_ROUTES.DIAN_SYNC_DOCUMENTS(id)}?${params.toString()}`, "GET");
};

export const downloadSyncExcel = (id: string): Promise<{ total?: number }> =>
    downloadBlob(API_ROUTES.DIAN_SYNC_EXCEL(id), `dian-export-${id}.xlsx`);

export const downloadSyncPdfs = (id: string): Promise<{ total?: number; succeeded?: number; failed?: number }> =>
    downloadBlob(API_ROUTES.DIAN_SYNC_DOWNLOAD_PDFS(id), `dian-pdfs-${id}.zip`);

/** Reintenta la descarga de los PDFs faltantes de un job (cuando el sync se cayó a mitad). */
export const retryPdfs = (id: string): Promise<{ message: string; succeeded: number; missing: number }> =>
    jsonRequest(API_ROUTES.DIAN_SYNC_RETRY_PDFS(id), "POST");

/** Cancela un job en proceso (descarga colgada). El background se detiene en pocos segundos. */
export const cancelSyncJob = (id: string): Promise<{ message: string }> =>
    jsonRequest(API_ROUTES.DIAN_SYNC_CANCEL(id), "POST");

/** Importación manual: sube el .xlsx de la DIAN y procesa documentos + PDFs + proveedores/productos. */
export const importDianExcel = async (file: File, credentialId?: string): Promise<{ jobId: string; status: string }> => {
    const form = new FormData();
    form.append("file", file);
    if (credentialId) form.append("credentialId", credentialId);
    const response = await fetch(API_ROUTES.DIAN_IMPORT_EXCEL, { method: "POST", credentials: "include", body: form });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
        const err = new Error((data as { message?: string }).message || "No se pudo importar el Excel") as Error & { status?: number };
        err.status = response.status;
        throw err;
    }
    return data as { jobId: string; status: string };
};

/** Abre el PDF de un documento en una pestaña nueva. */
export const openDocumentPdf = async (id: string): Promise<void> => {
    const response = await fetch(API_ROUTES.DIAN_DOCUMENT_PDF(id), { method: "GET", credentials: "include" });
    if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "No se pudo abrir el PDF");
    }
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    window.open(objectUrl, "_blank");
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
};

// ── Eventos ──────────────────────────────────────────────────────────────────

export const emitEvent = async (input: {
    credentialId: string;
    cufe: string;
    eventCode: DianEventCode;
    serie: string;
    senderNit: string;
    documentTypeId?: string;
    eventPrefix?: string;
}): Promise<{ event: DianEvent }> => jsonRequest(API_ROUTES.DIAN_EVENTS, "POST", input);

export const listEvents = async (cufe?: string, eventCode?: string): Promise<{ events: DianEvent[] }> => {
    const params = new URLSearchParams();
    if (cufe) params.set("cufe", cufe);
    if (eventCode) params.set("eventCode", eventCode);
    const qs = params.toString();
    return jsonRequest(`${API_ROUTES.DIAN_EVENTS}${qs ? `?${qs}` : ""}`, "GET");
};

// ── Auditoría ──────────────────────────────────────────────────────────────

export const listLogs = async (page = 1, pageSize = 30): Promise<Paginated & { logs: DianLog[] }> =>
    jsonRequest(`${API_ROUTES.DIAN_LOGS}?page=${page}&pageSize=${pageSize}`, "GET");

// ── Constantes UI ────────────────────────────────────────────────────────────

export const DIAN_EVENT_LABELS: Record<DianEventCode, string> = {
    "030": "Acuse de recibo",
    "031": "Reclamo",
    "032": "Aprobación expresa",
    "033": "Aprobación tácita",
};

export const DIAN_GROUP_LABELS: Record<DianSyncGroup, string> = {
    received: "Recibidos",
    emitted: "Emitidos",
    all: "Todos",
};

/** Tipos de documento DIAN más comunes (para el filtro de sync/eventos). */
export const DIAN_DOCUMENT_TYPES: { value: string; label: string }[] = [
    { value: "", label: "Todos" },
    { value: "1", label: "Factura de venta (01)" },
    { value: "2", label: "Factura de exportación (02)" },
    { value: "3", label: "Factura de contingencia (03)" },
    { value: "9", label: "Nota de ajuste (09)" },
    { value: "13", label: "Documento soporte (13)" },
];

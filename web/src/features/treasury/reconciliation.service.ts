import { API_ROUTES } from "../../utils/global";
import { appendNativeFiles, type NativeUploadFile } from "./uploadFiles.shared";

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

// ===== Importar extracto desde el PDF del banco =====
export interface ValorMatch {
    tipo: "factura" | "compra";
    id: string;
    numero: string;
    tercero: string;
    saldo: number;
}
export interface BankMovementPdf {
    fecha: string;
    canal: string;
    descripcion: string;
    referencia1?: string;
    referencia2?: string;
    valor: number;
    es_pago_cliente: boolean;
    cliente_match?: { tercero_id: string; nombre: string; doc_number: string } | null;
    facturas_pendientes?: { factura_id: string; numero: string; total: number; saldo: number }[];
    /** Documentos con valor exacto = el del movimiento (para confirmar a qué corresponde). */
    coincidencias_valor?: ValorMatch[];
}
export interface BankStatementPdfResult {
    cuenta?: string;
    nit_empresa?: string;
    empresa?: string;
    saldo_actual?: number;
    movimientos: BankMovementPdf[];
    agrupados: { descripcion: string; cantidad: number; total: number }[];
    total_abonos: number;
    total_cargos: number;
    pagos_cliente: number;
}
/** Importa el extracto desde el PDF del banco (parsea + cruza PAGO INTERBANC con clientes). */
export const importStatementPdf = async (file: File): Promise<BankStatementPdfResult> => {
    const fd = new FormData();
    fd.append("files", file);
    const res = await fetch(API_ROUTES.TREASURY_RECON_IMPORT_PDF, { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "No se pudo importar el PDF");
    return data as BankStatementPdfResult;
};

export interface PostStatementsResult {
    ok: boolean;
    message: string;
    creados: number;
    duplicados: number;
    errores: number;
    detalle: { archivo: string; creados: number; duplicados: number; errores: number }[];
}
/** Registra en el libro banco los movimientos de uno o varios extractos (asientos DEP). */
export const postStatements = async (files: File[]): Promise<PostStatementsResult> => {
    const fd = new FormData();
    files.forEach((f) => fd.append("files", f));
    const res = await fetch(API_ROUTES.TREASURY_RECON_POST_STATEMENTS, { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "No se pudieron registrar los movimientos");
    return data as PostStatementsResult;
};

/** Nativo: importa extractos con archivos de expo-document-picker. */
export const postStatementsNative = async (files: NativeUploadFile[]): Promise<PostStatementsResult> => {
    const fd = new FormData();
    appendNativeFiles(fd, files);
    const res = await fetch(API_ROUTES.TREASURY_RECON_POST_STATEMENTS, { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "No se pudieron registrar los movimientos");
    return data as PostStatementsResult;
};

// ===== Importador GENÉRICO (CSV/XLSX con mapeo de columnas, cualquier banco) =====
export interface StatementPreview {
    filas: string[][];
    total_filas: number;
    columnas: number;
}
export interface StatementProfile {
    _id?: string;
    nombre: string;
    header_row: number;
    col_fecha: number;
    col_descripcion: number;
    col_valor?: number | null;
    col_debito?: number | null;
    col_credito?: number | null;
    col_referencia?: number | null;
    formato_fecha: "dmy" | "mdy" | "ymd" | "iso";
    decimal: "," | ".";
    debito_negativo: boolean;
}

const postFile = async <T>(url: string, file: File, profile?: StatementProfile): Promise<T> => {
    const fd = new FormData();
    fd.append("files", file);
    if (profile) fd.append("profile", JSON.stringify(profile));
    const res = await fetch(url, { method: "POST", credentials: "include", body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
};

/** Vista previa de las primeras filas crudas del Excel/CSV para mapear columnas. */
export const genericPreview = (file: File): Promise<StatementPreview> => postFile(API_ROUTES.TREASURY_STMT_GENERIC_PREVIEW, file);
/** Importa el extracto con el mapeo indicado y devuelve los movimientos enriquecidos (preview). */
export const genericImport = (file: File, profile: StatementProfile): Promise<BankStatementPdfResult> => postFile(API_ROUTES.TREASURY_STMT_GENERIC_IMPORT, file, profile);
/** Importa con mapeo Y registra los movimientos en el libro banco (idempotente). */
export const genericPost = (file: File, profile: StatementProfile): Promise<PostStatementsResult> => postFile(API_ROUTES.TREASURY_STMT_GENERIC_POST, file, profile);

export const getStatementProfiles = async (): Promise<StatementProfile[]> => parse(await fetch(API_ROUTES.TREASURY_STMT_PROFILES, json("GET")));
export const saveStatementProfile = async (p: StatementProfile): Promise<StatementProfile> => parse(await fetch(API_ROUTES.TREASURY_STMT_PROFILES, json("POST", p)));
export const deleteStatementProfile = async (id: string): Promise<{ ok: boolean }> => parse(await fetch(API_ROUTES.TREASURY_STMT_PROFILE_BY_ID(id), json("DELETE")));

// ===== Conciliación ASISTIDA del banco =====
export interface CompraSugerida {
    compra_id: string;
    numero: string;
    proveedor: string;
    supplier_doc: string;
    saldo: number;
    dias: number;
    candidatos: number;
}
export interface RetencionSugerida { pct: number; valor: number; cuenta: string; nombre: string }
export interface FacturaSugerida {
    factura_id: string;
    numero: string;
    cliente: string;
    cliente_doc: string;
    saldo: number;
    /** "exacta" = pago igual al saldo; "retencion" = pago + retefuente = saldo. */
    motivo: "exacta" | "retencion";
    retencion?: RetencionSugerida | null;
}
export interface ConcMovimiento {
    asiento_id: string;
    fecha: string;
    descripcion: string;
    valor: number;
    es_pago_cliente: boolean;
    cliente_sugerido?: { tercero_id: string; nombre: string; doc_number: string } | null;
    /** Compra sugerida para egresos (valor exacto + fecha más cercana). */
    compra_sugerida?: CompraSugerida | null;
    /** Factura sugerida para ingresos de cliente (saldo = pago, o saldo = pago + retención). */
    factura_sugerida?: FacturaSugerida | null;
}
export interface ConcDocumento { tipo: "factura" | "compra"; id: string; numero: string; total: number; saldo: number }

export interface ConcTercero { nombre: string; cantidad: number }
export const getConcPendientes = async (opts: { search?: string; desde?: string; hasta?: string; page?: number; pageSize?: number; soloSugeridas?: boolean; tercero?: string } = {}): Promise<{ ok: boolean; movimientos: ConcMovimiento[]; terceros: ConcTercero[]; pagination: { page: number; pageSize: number; total: number; totalPages: number } }> => {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.desde) p.set("desde", opts.desde);
    if (opts.hasta) p.set("hasta", opts.hasta);
    p.set("page", String(opts.page ?? 1));
    p.set("pageSize", String(opts.pageSize ?? 30));
    if (opts.soloSugeridas) p.set("soloSugeridas", "true");
    if (opts.tercero) p.set("tercero", opts.tercero);
    return parse(await fetch(`${API_ROUTES.TREASURY_BANKCONC_PENDING}?${p.toString()}`, json("GET")));
};
export const getConcDocumentos = async (doc: string, tipo: "cliente" | "proveedor"): Promise<{ ok: boolean; documentos: ConcDocumento[] }> =>
    parse(await fetch(`${API_ROUTES.TREASURY_BANKCONC_DOCUMENTS}?doc=${encodeURIComponent(doc)}&tipo=${tipo}`, json("GET")));
/** Concilia N movimientos contra UNA factura/compra. Para clientes, opcionalmente registra la retención sufrida (el resto del saldo). */
export const aplicarConc = async (asientoIds: string[], doc_tipo: "factura" | "compra", doc_id: string, retencion?: { valor: number; cuenta?: string; pct?: number } | null): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY, json("POST", { asientoIds, doc_tipo, doc_id, retencion: retencion ?? null })));
/** Concilia N movimientos (suma) repartidos en VARIAS facturas del mismo cliente (antiguas primero). */
export const aplicarConcMultiple = async (asientoIds: string[], facturaIds: string[]): Promise<{ ok: boolean; conciliados: number; aplicadas: { numero: string; abono: number; estado: string }[]; total_aplicado: number; sobrante: number; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY_MULTIPLE, json("POST", { asientoIds, facturaIds })));
/** Concilia N movimientos (suma) repartidos en VARIAS compras de un proveedor (antiguas primero). Si no se pasan compraIds, toma TODA su cartera. */
export const aplicarConcMultipleCompras = async (asientoIds: string[], supplierDoc?: string, compraIds?: string[]): Promise<{ ok: boolean; conciliados: number; aplicadas: { numero: string; abono: number; estado: string }[]; total_aplicado: number; sobrante: number; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY_MULTIPLE_PURCHASES, json("POST", { asientoIds, supplierDoc, compraIds })));
/** Concilia EN LOTE varios pares (cada movimiento con SU compra/factura sugerida), 1 a 1. */
export const aplicarConcLote = async (pares: { asiento_id: string; doc_tipo: "factura" | "compra"; doc_id: string }[]): Promise<{ ok: boolean; conciliados: number; monto: number; errores: { asiento_id: string; doc_id: string; error: string }[]; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY_BATCH, json("POST", { pares })));
/** Concilia TODAS las sugeridas que cumplen los filtros (search/tercero), en todas las páginas. */
export const aplicarConcTodas = async (filtros: { search?: string; tercero?: string }): Promise<{ ok: boolean; conciliados: number; monto: number; errores: { asiento_id: string; doc_id: string; error: string }[]; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY_ALL, json("POST", filtros)));
export const aplicarConcCuenta = async (asientoIds: string[], cuenta: string, descripcion?: string): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.TREASURY_BANKCONC_APPLY_ACCOUNT, json("POST", { asientoIds, cuenta, descripcion })));

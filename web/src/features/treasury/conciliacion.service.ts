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

export interface RetencionAplicada {
    retefuente?: number;
    reteIVA?: number;
    reteICA?: number;
    tarifaRetefuente?: number;
}

export interface ConciliacionItem {
    _id: string;
    tipo_factura: "venta" | "compra";
    factura_ids: string[];
    movimiento_ids: string[];
    valor_conciliado: number;
    valor_facturas: number;
    diferencia: number;
    retencion_aplicada?: RetencionAplicada | null;
    confianza: number;
    estado: "sugerido" | "confirmado" | "rechazado";
    dias_diferencia?: number | null;
    origen: "auto" | "manual";
    nit_tercero?: string;
    nombre_tercero?: string;
}

interface ListResp {
    ok: boolean;
    items: ConciliacionItem[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

/** Sugerencia adjunta a un movimiento (o null si no la hay). */
export interface SugerenciaMov {
    conciliacion_id: string;
    estado: "sugerido" | "confirmado" | "rechazado";
    tipo_factura: "venta" | "compra";
    factura_ids: string[];
    numeros_factura?: string[];
    fecha_factura?: string | null;
    valor_documento?: number;
    valor_facturas: number;
    diferencia: number;
    confianza: number;
    retencion_aplicada?: RetencionAplicada | null;
    dias_diferencia?: number | null;
    nombre_tercero?: string;
    nit_tercero?: string;
}

/** Movimiento del banco enriquecido con su sugerencia. */
export interface MovimientoConc {
    asiento_id: string;
    fecha: string;
    descripcion: string;
    valor: number;
    signo: "ingreso" | "egreso";
    sugerencia: SugerenciaMov | null;
}

export interface DocPendiente { tipo: "venta" | "compra"; id: string; numero: string; total: number; saldo: number }

/** Genera las sugerencias automáticas (ingresos + egresos) y las persiste. */
export const generarSugerencias = async (filtros: { desde?: string; hasta?: string; search?: string } = {}): Promise<{ ok: boolean; ingresos: number; egresos: number; con_retencion: number; persistidas: number }> =>
    parse(await fetch(API_ROUTES.CONC2_GENERATE, json("POST", filtros)));

/** Lista TODOS los movimientos del banco de un signo, cada uno con su sugerencia (o null). */
export const listarMovimientos = async (opts: { signo: "ingreso" | "egreso"; search?: string; soloSugeridos?: boolean; soloAltaConfianza?: boolean; page?: number; pageSize?: number }): Promise<{ ok: boolean; movimientos: MovimientoConc[]; total: number; con_sugerencia: number; con_alta_confianza?: number; page: number; pageSize: number; totalPages: number }> => {
    const p = new URLSearchParams();
    p.set("signo", opts.signo);
    if (opts.search) p.set("search", opts.search);
    if (opts.soloSugeridos) p.set("soloSugeridos", "true");
    if (opts.soloAltaConfianza) p.set("soloAltaConfianza", "true");
    p.set("page", String(opts.page ?? 1));
    p.set("pageSize", String(opts.pageSize ?? 50));
    return parse(await fetch(`${API_ROUTES.CONC2_MOVEMENTS}?${p.toString()}`, json("GET")));
};

/** Facturas/compras pendientes de un tercero (para el selector manual). */
export const documentosTercero = async (doc: string, tipo: "venta" | "compra"): Promise<{ ok: boolean; documentos: DocPendiente[] }> =>
    parse(await fetch(`${API_ROUTES.CONC2_DOCUMENTS}?doc=${encodeURIComponent(doc)}&tipo=${tipo}`, json("GET")));

/** Busca terceros (cliente/proveedor) por nombre o NIT. */
export const buscarTerceros = async (q: string, tipo: "venta" | "compra"): Promise<{ ok: boolean; terceros: { doc: string; nombre: string }[] }> =>
    parse(await fetch(`${API_ROUTES.CONC2_SEARCH_TERCEROS}?q=${encodeURIComponent(q)}&tipo=${tipo}`, json("GET")));

/** Registra N movimientos de un cliente como ANTICIPO (saldo a favor), sin aplicar a factura aún. */
export const registrarAnticipo = async (movimientoIds: string[], clienteDoc: string, clienteNombre?: string): Promise<{ ok: boolean; conciliados: number; total: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_ANTICIPO, json("POST", { movimientoIds, clienteDoc, clienteNombre })));

/** Lista las conciliaciones por tipo (venta=ingresos, compra=egresos) y estado. */
export const listarConciliaciones = async (opts: { tipo?: "venta" | "compra"; estado?: string; search?: string; page?: number; pageSize?: number } = {}): Promise<ListResp> => {
    const p = new URLSearchParams();
    if (opts.tipo) p.set("tipo", opts.tipo);
    if (opts.estado) p.set("estado", opts.estado);
    if (opts.search) p.set("search", opts.search);
    p.set("page", String(opts.page ?? 1));
    p.set("pageSize", String(opts.pageSize ?? 50));
    return parse(await fetch(`${API_ROUTES.CONC2_LIST}?${p.toString()}`, json("GET")));
};

/** Confirma una conciliación (postea asientos + abona factura + marca conciliado). */
export const confirmarConciliacion = async (id: string): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_CONFIRM, json("POST", { id })));

/** Confirma EN LOTE: por lista de ids de conciliación, o por filtro signo/concepto (todas las sugerencias). */
export const confirmarLote = async (args: { ids?: string[]; signo?: "ingreso" | "egreso"; concepto?: string; soloExactas?: boolean; soloAlta?: boolean; async?: boolean; titulo?: string }): Promise<{ ok: boolean; confirmadas?: number; total: number; monto?: number; errores?: { id: string; error: string }[]; jobId?: string; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_CONFIRM_BATCH, json("POST", args)));

/** Rechaza una sugerencia. Con buscarNueva, el backend propone otra factura para ese movimiento. */
export const rechazarConciliacion = async (id: string, buscarNueva = false): Promise<{ ok: boolean; message: string; nueva?: SugerenciaMov | null }> =>
    parse(await fetch(API_ROUTES.CONC2_REJECT, json("POST", { id, buscarNueva })));

/** Crea una agrupación manual por tercero (N movimientos ↔ M facturas). `retencion` lleva el restante a retención sufrida (ventas). */
export const crearConciliacionManual = async (tipo: "venta" | "compra", movimientoIds: string[], facturaIds: string[], retencion?: number): Promise<{ ok: boolean; id: string; valor_conciliado: number; valor_facturas: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_MANUAL, json("POST", { tipo, movimientoIds, facturaIds, retencion })));

/** Devuelve los ids de movimientos con descripción similar (selección masiva). */
export const movimientosSimilares = async (id: string): Promise<{ ok: boolean; ids: string[] }> =>
    parse(await fetch(`${API_ROUTES.CONC2_SIMILAR}?id=${encodeURIComponent(id)}`, json("GET")));

/** Un grupo de pagos recurrentes (mismo concepto + valor repetido en varios meses). */
export interface GrupoRecurrente {
    concepto: string;
    valor: number;
    veces: number;
    meses: number;
    desde: string;
    hasta: string;
    total: number;
    ids: string[];
}
/** Detecta pagos recurrentes (nómina, arriendos, pagos fijos) en un signo. */
export const pagosRecurrentes = async (signo: "ingreso" | "egreso", minVeces = 3): Promise<{ ok: boolean; grupos: GrupoRecurrente[]; total_grupos: number }> =>
    parse(await fetch(`${API_ROUTES.CONC2_RECURRING}?signo=${signo}&minVeces=${minVeces}`, json("GET")));

// ── Cartera por cliente ───────────────────────────────────────────────────────
export interface ClienteCartera {
    nit: string;
    nombre: string;
    facturado: number;
    pagado: number;
    saldo: number;
    nFacturas: number;
    nPendientes: number;
}
export interface PagoAplicado { fecha: string | null; valor: number; retencion: number; aplicado: number; referencia: string; metodo: string }
export interface FacturaCartera {
    id: string;
    numero: string;
    fecha: string | null;
    total: number;
    pagado: number;
    saldo: number;
    estado: string;
    pagos: PagoAplicado[];
}
/** Cartera consolidada por cliente (facturado, pagado, saldo). */
export const carteraPorCliente = async (opts: { search?: string; soloPendientes?: boolean } = {}): Promise<{ ok: boolean; clientes: ClienteCartera[]; totales: { clientes: number; facturado: number; pagado: number; saldo: number } }> => {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.soloPendientes === false) p.set("soloPendientes", "false");
    return parse(await fetch(`${API_ROUTES.CONC2_CARTERA}?${p.toString()}`, json("GET")));
};
/** Detalle de cartera de un cliente: sus facturas con saldo y pagos aplicados. */
export const carteraDetalleCliente = async (doc: string, soloPendientes = true): Promise<{ ok: boolean; cliente: { doc: string; nombre: string }; documentos: FacturaCartera[]; totales: { facturas: number; total: number; pagado: number; saldo: number } }> =>
    parse(await fetch(`${API_ROUTES.CONC2_CARTERA_CLIENTE}?doc=${encodeURIComponent(doc)}${soloPendientes ? "" : "&soloPendientes=false"}`, json("GET")));

// ── Cuentas por pagar por proveedor ───────────────────────────────────────────
export interface ProveedorCxp { doc: string; nombre: string; total: number; pagado: number; saldo: number; nFacturas: number; nPendientes: number }
export interface CompraCxp { id: string; numero: string; fecha: string | null; total: number; pagado: number; saldo: number; estado: string; pagos: { fecha: string | null; valor: number; banco: string; referencia: string }[] }
/** Cuentas por pagar consolidadas por proveedor (total, pagado, saldo). */
export const cxpPorProveedor = async (opts: { search?: string; soloPendientes?: boolean } = {}): Promise<{ ok: boolean; proveedores: ProveedorCxp[]; totales: { proveedores: number; total: number; pagado: number; saldo: number } }> => {
    const p = new URLSearchParams();
    if (opts.search) p.set("search", opts.search);
    if (opts.soloPendientes === false) p.set("soloPendientes", "false");
    return parse(await fetch(`${API_ROUTES.CONC2_CXP}?${p.toString()}`, json("GET")));
};
/** Detalle de cuentas por pagar de un proveedor: sus compras con saldo y pagos. */
export const cxpDetalleProveedor = async (doc: string, soloPendientes = true): Promise<{ ok: boolean; proveedor: { doc: string; nombre: string }; documentos: CompraCxp[]; totales: { facturas: number; total: number; pagado: number; saldo: number } }> =>
    parse(await fetch(`${API_ROUTES.CONC2_CXP_PROVEEDOR}?doc=${encodeURIComponent(doc)}${soloPendientes ? "" : "&soloPendientes=false"}`, json("GET")));

/** Paga facturas de un proveedor desde la bolsa 22050501. `facturaIds`: pago total; `parciales`: abonos parciales; sin nada: todas. */
export const pagarProveedor = async (proveedorDoc: string, opts: { facturaIds?: string[]; parciales?: { id: string; monto: number }[] } = {}): Promise<{ ok: boolean; pagado: number; facturas: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_PAGAR_PROVEEDOR, json("POST", { proveedorDoc, ...opts })));

/** Recauda facturas de un cliente (lo deja al día). `facturaIds` opcional; sin él, todas las pendientes. */
export const recaudarCliente = async (clienteDoc: string, facturaIds?: string[]): Promise<{ ok: boolean; recaudado: number; facturas: number; notasCredito: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_RECAUDAR_CLIENTE, json("POST", { clienteDoc, facturaIds })));

// ── Bolsa de pagos sin asignar (22050501) ─────────────────────────────────────
export interface ConceptoBolsa { concepto: string; n: number; suma: number }
/** Composición del saldo sin asignar de la bolsa de proveedores. */
export const saldoBolsa = async (): Promise<{ ok: boolean; cuenta: string; metido: number; asignado: number; saldoSinAsignar: number; conceptos: ConceptoBolsa[] }> =>
    parse(await fetch(API_ROUTES.CONC2_BOLSA, json("GET")));
/** Reclasifica de la bolsa a otra cuenta (por concepto o por valores). */
export const reclasificarBolsa = async (cuentaDestino: string, opts: { concepto?: string; valores?: number[] } = {}): Promise<{ ok: boolean; reclasificados: number; total: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_BOLSA_RECLASIFICAR, json("POST", { cuentaDestino, ...opts })));

/** Audita un cliente/proveedor: cruza banco recibido vs aplicado y detecta recaudos sin aplicar. */
export const auditarTercero = async (doc: string, tipo: "cliente" | "proveedor"): Promise<{ ok: boolean; tipo: string; doc: string; nombre: string; saldo: number; aplicado?: number; recibidoBanco?: number; faltanteSinAplicar?: number; hallazgo: string }> =>
    parse(await fetch(`${API_ROUTES.CONC2_AUDITAR}?doc=${encodeURIComponent(doc)}&tipo=${tipo}`, json("GET")));

/** Lleva movimientos a una cuenta contable directa. `async:true` lo procesa en segundo plano (job). */
export const enviarACuenta = async (cuenta: string, opts: { asientoIds?: string[]; descripcion?: string; bancoNombre?: string; bancoNit?: string; signo?: "ingreso" | "egreso"; concepto?: string; titulo?: string; async?: boolean } = {}): Promise<{ ok: boolean; conciliados?: number; jobId?: string; total?: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_TO_ACCOUNT, json("POST", { cuenta, ...opts })));

/** Sugerencia de la cuenta contable del PUC (IA) para un movimiento que no es cartera. */
export interface CuentaSugeridaIA {
    ok: boolean;
    cuenta: { codigo: string; nombre: string } | null;
    concepto?: string;
    razonamiento?: string;
    confianza?: "alta" | "media" | "baja";
    advertencia?: string;
}
export const sugerirCuentaIA = async (descripcion: string, opts: { signo?: "ingreso" | "egreso"; valor?: number } = {}): Promise<CuentaSugeridaIA> =>
    parse(await fetch(API_ROUTES.CONC2_SUGGEST_ACCOUNT, json("POST", { descripcion, ...opts })));

/** Crea una cuenta de movimiento en el PUC (cuando la cuenta a reclasificar no existe). */
export const crearCuentaPuc = async (codigo: string, nombre: string): Promise<{ ok: boolean; creada: boolean; cuenta: { codigo: string; nombre: string }; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_CREATE_ACCOUNT, json("POST", { codigo, nombre })));

/** Job en background del centro de actividades. */
export interface BankJob {
    _id: string;
    tipo: "enviar_a_cuenta" | "confirmar_lote" | "otro";
    titulo: string;
    estado: "running" | "completado" | "error" | "parcial";
    total: number;
    procesados: number;
    errores: number;
    mensaje: string;
    params?: { cuenta?: string; signo?: string; concepto?: string } | null;
    started_at: string;
    finished_at?: string | null;
}

/** Lista los jobs recientes (centro de actividades). */
export const listarJobs = async (): Promise<{ ok: boolean; jobs: BankJob[] }> =>
    parse(await fetch(API_ROUTES.CONC2_JOBS, json("GET")));

/** Reanuda una actividad que quedó en error/parcial (procesa solo los movimientos que faltaron). */
export const reanudarJob = async (jobId: string): Promise<{ ok: boolean; jobId: string; restantes: number; message: string }> =>
    parse(await fetch(API_ROUTES.CONC2_JOBS_RESUME, json("POST", { jobId })));

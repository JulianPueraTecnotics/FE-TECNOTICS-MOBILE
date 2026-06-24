import { API_ROUTES } from "../utils/global";

export interface HoraExtraInput {
    /** Clave del tipo: HED, HEN, HRN, HEDDF, HRDDF, HENDF, HRNDF. */
    Tipo?: string;
    Cantidad: string;
    Porcentaje: string;
    Pago: string;
}

/** Concepto salarial / no salarial (bonificaciones, auxilios). */
export interface ConceptoSNSInput {
    pago_s?: number;
    pago_ns?: number;
}

export interface NominaDevengadosInput {
    dias_trabajados: number;
    sueldo_trabajado?: number;
    auxilio_transporte?: number;
    horas_extra?: HoraExtraInput[];
    vacaciones_compensadas?: { cantidad: number; pago: number };
    cesantias?: { pago: number; porcentaje: number; pago_intereses: number };
    bonificaciones?: ConceptoSNSInput[];
    auxilios?: ConceptoSNSInput[];
    otros?: Record<string, number>;
}

export interface NominaDeduccionesInput {
    salud?: { porcentaje: number; deduccion: number };
    fondo_pension?: { porcentaje: number; deduccion: number };
    otros?: Record<string, number>;
}

export interface CreateNominaPayload {
    empleadoId: string;
    periodo: {
        fecha_liquidacion_inicio: string;
        fecha_liquidacion_fin: string;
        periodo_nomina?: string;
        fechas_pago: string[];
    };
    pago?: { forma?: string; metodo?: string };
    devengados: NominaDevengadosInput;
    deducciones?: NominaDeduccionesInput;
    prefijo?: string;
    isDraft?: boolean;
}

/** Lote de nóminas: un periodo + una nómina por trabajador. */
export interface CreateNominaLotePayload {
    periodo_key: string;
    periodo_label: string;
    items: CreateNominaPayload[];
}

/** Resultado por trabajador dentro de un lote. */
export interface LoteItemResult {
    empleadoId: string;
    nominaId?: string;
    numero?: string;
    status: "APPROVED" | "REJECTED" | "SENT" | "PENDING" | "ERROR";
    cune?: string;
    error?: string;
}

export interface CreateNominaLoteResponse {
    message: string;
    ok: boolean;
    lote_id: string;
    periodo_key: string;
    results: LoteItemResult[];
}

/** Resumen de un periodo/lote para la vista agrupada. */
export interface LoteResumen {
    periodo_key: string;
    periodo_label: string;
    lote_ids: string[];
    trabajadores: number;
    total: number;
    aprobadas: number;
    rechazadas: number;
    pendientes: number;
    fecha_inicio?: string;
    fecha_fin?: string;
    ultima: string;
}

/** Plantilla del siguiente periodo (clon del último lote, editable). */
export interface PlantillaLote {
    periodo_key: string;
    periodo_label: string;
    periodo_nomina: string;
    items: CreateNominaPayload[];
    source_periodo_key: string | null;
}

export interface PredecesorNomina {
    NumeroPred: string;
    CUNEPred: string;
    FechaGenPred: string;
}

export interface NominaSystemInfo {
    nominaStatus: "PENDING" | "APPROVED" | "REJECTED" | "SENT";
    cune?: string;
    dianDocKey?: string;
    dianStatusDescr?: string;
    empleado_id?: string;
    is_draft?: boolean;
    send_by?: string;
}

export interface Nomina {
    _id: string;
    NominaElectronica: {
        TipoDeNomina: string;
        NumeroSecuenciaXML?: { CodigoTrabajador?: string; Prefijo?: string; Consecutivo?: string; Numero?: string };
        Empleador?: {
            RazonSocial?: string;
            NIT?: string;
            DV?: string;
            Pais?: string;
            DepartamentoEstado?: string;
            MunicipioCiudad?: string;
            Direccion?: string;
        };
        Trabajador?: {
            PrimerNombre?: string;
            OtrosNombres?: string;
            PrimerApellido?: string;
            SegundoApellido?: string;
            TipoDocumento?: string;
            NumeroDocumento?: string;
            TipoContrato?: string;
            TipoTrabajador?: string;
            Sueldo?: string;
            LugarTrabajoDireccion?: string;
            CodigoTrabajador?: string;
        };
        Periodo?: {
            FechaIngreso?: string;
            FechaLiquidacionInicio?: string;
            FechaLiquidacionFin?: string;
            TiempoLaborado?: string;
            FechaGen?: string;
        };
        InformacionGeneral?: { PeriodoNomina?: string; TipoMoneda?: string; FechaGen?: string; HoraGen?: string };
        Pago?: { Forma?: string; Metodo?: string };
        FechasPagos?: string[];
        Devengados?: Record<string, unknown>;
        Deducciones?: Record<string, unknown>;
        ComprobanteTotal?: string;
        DevengadosTotal?: string;
        DeduccionesTotal?: string;
    };
    systemInfo: NominaSystemInfo;
    createdAt?: string;
    updatedAt?: string;
}

export interface NominasResponse {
    items: Nomina[];
    total: number;
    page: number;
    limit: number;
}

const jsonHeaders = { "Content-Type": "application/json" };

/** Prefijo de nómina de la empresa (subconjunto de los prefijos de la compañía). */
export interface NominaPrefix {
    prefix: string;
    default: boolean;
    consecutivo_inicial: number;
}

/** Patrón de prefijos reconocidos como de nómina electrónica por convención de nombre (fallback). */
const NOMINA_PREFIX_PATTERN = /^NE/i; // NE (producción), NESET (pruebas), NExxx...

/**
 * Obtiene los prefijos de NÓMINA configurados en la empresa.
 * Prioriza los marcados con `is_nomina`; si ninguno lo trae (prefijos creados sin el flag),
 * recurre a la convención de nombre (empiezan por "NE") para no caer al de pruebas por error.
 */
export const getNominaPrefixes = async (): Promise<NominaPrefix[]> => {
    const response = await fetch(API_ROUTES.GET_PROFILE, {
        method: "GET",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener los prefijos de nómina");
    const prefixes = (data?.company?.prefixes ?? []) as Array<{
        prefix: string;
        default?: boolean;
        is_nomina?: boolean;
        resolution?: { init?: number };
    }>;

    const toNominaPrefix = (p: (typeof prefixes)[number]): NominaPrefix => ({
        prefix: p.prefix,
        default: Boolean(p.default),
        consecutivo_inicial: Number(p.resolution?.init ?? 1),
    });

    // 1) Los marcados explícitamente como nómina.
    const flagged = prefixes.filter((p) => p.is_nomina);
    if (flagged.length) return flagged.map(toNominaPrefix);

    // 2) Fallback: prefijos de nómina por convención de nombre (NE / NESET) no marcados con el flag.
    return prefixes.filter((p) => NOMINA_PREFIX_PATTERN.test(String(p.prefix ?? "").trim())).map(toNominaPrefix);
};

export const getAllNominas = async (page = 1, limit = 20): Promise<NominasResponse> => {
    const response = await fetch(`${API_ROUTES.NOMINA}?page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener nóminas");
    return data;
};

/** Detalle completo de una nómina por id. */
export const getNominaById = async (nominaId: string): Promise<{ nomina: Nomina }> => {
    const response = await fetch(API_ROUTES.NOMINA_BY_ID(nominaId), {
        method: "GET",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener la nómina");
    return data;
};

/** Re-evalúa el estado DIAN desde la respuesta de SIMBA ya almacenada (sin reemitir). */
export const resyncNominaStatus = async (nominaId: string): Promise<{ nomina: Nomina }> => {
    const response = await fetch(`${API_ROUTES.NOMINA_BY_ID(nominaId)}/resync`, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al actualizar el estado de la nómina");
    return data;
};

export const createNomina = async (payload: CreateNominaPayload): Promise<{ nomina: Nomina }> => {
    const response = await fetch(API_ROUTES.NOMINA, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al emitir la nómina");
    return data;
};

/** Emite un lote de nóminas (varios trabajadores en un mismo periodo). */
export const createNominaLote = async (payload: CreateNominaLotePayload): Promise<CreateNominaLoteResponse> => {
    const response = await fetch(API_ROUTES.NOMINA_LOTE, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al emitir el lote de nómina");
    return data;
};

/** Lista las nóminas agrupadas por periodo (lote mensual). */
export const getNominaLotes = async (): Promise<{ lotes: LoteResumen[] }> => {
    const response = await fetch(API_ROUTES.NOMINA_LOTES, { method: "GET", credentials: "include", headers: jsonHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener los lotes de nómina");
    return data;
};

/** Nóminas de un periodo concreto (detalle del lote). */
export const getNominasByPeriodo = async (periodoKey: string): Promise<{ items: Nomina[]; periodo_key: string }> => {
    const response = await fetch(API_ROUTES.NOMINA_BY_PERIODO(periodoKey), { method: "GET", credentials: "include", headers: jsonHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al obtener las nóminas del periodo");
    return data;
};

/** Obtiene la plantilla del siguiente periodo (clon del último lote, o de `from`). */
export const getNominaPlantilla = async (from?: string): Promise<PlantillaLote> => {
    const url = from ? `${API_ROUTES.NOMINA_PLANTILLA}?from=${encodeURIComponent(from)}` : API_ROUTES.NOMINA_PLANTILLA;
    const response = await fetch(url, { method: "GET", credentials: "include", headers: jsonHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al generar la plantilla de nómina");
    return data;
};

/** Nota de eliminación (anula) sobre una nómina ya emitida. */
export const deleteNomina = async (payload: CreateNominaPayload & { predecesor: PredecesorNomina }): Promise<{ nomina: Nomina }> => {
    const response = await fetch(API_ROUTES.NOMINA_DELETE, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al eliminar la nómina");
    return data;
};

/** Nota de reemplazo (corrige) sobre una nómina ya emitida. */
export const replaceNomina = async (payload: CreateNominaPayload & { predecesor: PredecesorNomina }): Promise<{ nomina: Nomina }> => {
    const response = await fetch(API_ROUTES.NOMINA_REPLACE, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al reemplazar la nómina");
    return data;
};

// ── Certificados (Formulario 220) ──
export interface EmpleadoConNomina {
    _id: string;
    nombre: string;
    numero_documento: string;
    tipo_documento?: string;
}

/** Empleados con nómina aprobada en el año (para el certificado F220). */
export const getEmpleadosConNomina = async (anio: number): Promise<{ ok: boolean; anio: number; empleados: EmpleadoConNomina[] }> => {
    const response = await fetch(`${API_ROUTES.NOMINA_CERT_EMPLEADOS}?anio=${anio}`, { method: "GET", credentials: "include", headers: jsonHeaders });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Error al cargar empleados");
    return data;
};

/** Descarga el certificado de ingresos y retenciones (Formulario 220) en PDF. */
export const downloadForm220 = async (anio: number, empleadoId: string, nombre: string): Promise<void> => {
    const res = await fetch(`${API_ROUTES.NOMINA_CERT_FORM220}?anio=${anio}&empleadoId=${empleadoId}`, { method: "GET", credentials: "include" });
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || "No se pudo generar el certificado");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `form220-${nombre.replace(/[^a-z0-9]+/gi, "_")}-${anio}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

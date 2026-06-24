import { API_ROUTES } from "../../utils/global";

const get = (url: string) => fetch(url, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
}

export interface RetentionConceptRow {
    cuenta: string;
    tipo?: string;
    descripcion?: string;
    base: number;
    retenido: number;
}
export interface RetentionParty {
    tercero: string;
    total_retenido: number;
    conceptos: RetentionConceptRow[];
}

export interface ExogenaRow { nit: string; dv?: string; tipo_doc?: string; tercero: string; municipio?: string; identificado: boolean; valor: number }
export interface ExogenaFormat { nombre: string; rows: ExogenaRow[]; identificados: number; sin_identificar: number }
export interface ExogenaResponse {
    ok: boolean;
    anio: number;
    formatos: Record<string, ExogenaFormat>;
}

export const getRetentionParties = async (anio: number): Promise<{ ok: boolean; anio: number; parties: RetentionParty[] }> =>
    parse(await get(`${API_ROUTES.LEDGER_DIAN_RET_PARTIES}?anio=${anio}`));

export const getExogena = async (anio: number): Promise<ExogenaResponse> =>
    parse(await get(`${API_ROUTES.LEDGER_DIAN_EXOGENA}?anio=${anio}`));

export interface ExogenaValidacionRow {
    codigo: string;
    nombre: string;
    total_contable: number;
    total_formato: number;
    total_identificado: number;
    valor_sin_identificar: number;
    terceros_sin_identificar: number;
    diferencia: number;
    cuadra: boolean;
    alertas: string[];
}
export interface ExogenaValidacionResponse {
    ok: boolean;
    anio: number;
    validaciones: ExogenaValidacionRow[];
}

/** Validación previa de exógena (cuadres contra contabilidad y terceros sin NIT). */
export const getExogenaValidacion = async (anio: number): Promise<ExogenaValidacionResponse> =>
    parse(await get(`${API_ROUTES.LEDGER_DIAN_EXOGENA_VALIDACION}?anio=${anio}`));

/** Descarga el XML oficial DIAN de un formato de exógena. */
export const downloadExogenaXml = async (anio: number, formato: string): Promise<void> => {
    const res = await get(`${API_ROUTES.LEDGER_DIAN_EXOGENA_XML}?anio=${anio}&formato=${formato}`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || "No se pudo generar el XML");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `exogena-${formato}-${anio}.xml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ── Exógena distrital: Retención de ICA por municipio ──
export interface IcaTerceroRow { nit: string; dv?: string; tipo_doc?: string; tercero: string; municipio?: string; identificado: boolean; valor: number }
export interface IcaMunicipioRow { codigo_municipio: string; municipio: string; total: number; terceros: number; rows: IcaTerceroRow[] }
export interface IcaMunicipioResponse { ok: boolean; anio: number; total: number; municipios: IcaMunicipioRow[]; sin_identificar: number }

/** ReteICA practicada agrupada por municipio del tercero (insumo de la exógena distrital). */
export const getIcaPorMunicipio = async (anio: number): Promise<IcaMunicipioResponse> =>
    parse(await get(`${API_ROUTES.LEDGER_DIAN_ICA_MUNICIPIO}?anio=${anio}`));

/** Descarga el certificado de retención (PDF) de un tercero. */
export const downloadRetentionCertificate = async (anio: number, tercero: string): Promise<void> => {
    const res = await get(`${API_ROUTES.LEDGER_DIAN_RET_CERT}?anio=${anio}&tercero=${encodeURIComponent(tercero)}`);
    if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as any).message || "No se pudo generar el certificado");
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `certificado-retencion-${tercero.replace(/[^a-z0-9]+/gi, "_")}-${anio}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

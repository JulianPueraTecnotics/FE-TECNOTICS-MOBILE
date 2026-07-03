import { API_ROUTES } from "../../utils/global";

const json = (method: string, body?: unknown) => ({
    method,
    credentials: "include" as const,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
async function parse<T>(r: Response): Promise<T> {
    const d = await r.json();
    if (!r.ok) throw new Error(d.message || "Error");
    return d as T;
}

export type IvaPeriodicidad = "bimestral" | "cuatrimestral" | "no_responsable";

export interface VencimientoProximo {
    obligacion: string;
    obligacion_label: string;
    periodicidad: string;
    periodo: number;
    periodo_label: string;
    fecha_limite: string;
    fecha_exacta: boolean;
    dias_restantes: number;
    estado: "vencido" | "critico" | "por_vencer" | "al_dia";
}

export interface TaxCalendar {
    ok: true;
    periodicidad_iva: IvaPeriodicidad;
    digito_nit: number;
    vencimientos: VencimientoProximo[];
    meta: { ingresos_anio_anterior: number; umbral_uvt_cop: number; autodetectado: boolean };
}

export interface TaxProfile {
    iva_periodicidad?: IvaPeriodicidad;
    iva_periodicidad_manual?: boolean;
    agente_retencion?: boolean;
    gran_contribuyente?: boolean;
    responsable_iva?: boolean;
    declara_reteica?: boolean;
    declara_ica?: boolean;
    autorretenedor_renta?: boolean;
    declara_renta?: boolean;
    presenta_exogena?: boolean;
    regimen_simple?: boolean;
    ingresos_anio_anterior?: number;
    notificaciones?: {
        enabled: boolean;
        dias_anticipacion: number;
        dashboard: boolean;
        campana: boolean;
        correo: boolean;
        emails: string[];
    };
}

export interface TaxProfileResponse {
    ok: true;
    profile: TaxProfile;
    deteccion: { periodicidad: IvaPeriodicidad; ingresos: number; umbral: number; autodetectado: boolean };
}

export const getTaxCalendar = async (horizonteDias?: number): Promise<TaxCalendar> =>
    parse(await fetch(API_ROUTES.TAX_CALENDAR + (horizonteDias ? `?horizonteDias=${horizonteDias}` : ""), json("GET")));

export const getTaxProfile = async (): Promise<TaxProfileResponse> =>
    parse(await fetch(API_ROUTES.TAX_PROFILE, json("GET")));

export const updateTaxProfile = async (patch: Partial<TaxProfile>): Promise<{ ok: true; profile: TaxProfile }> =>
    parse(await fetch(API_ROUTES.TAX_PROFILE, json("PUT", patch)));

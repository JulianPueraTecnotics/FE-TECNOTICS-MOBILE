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

export type AssetStatus = "activo" | "dado_de_baja" | "vendido";

export interface FixedAsset {
    _id: string;
    codigo: string;
    nombre: string;
    descripcion?: string;
    categoria?: string;
    usuario?: string;
    ubicacion?: string;
    tasa_depreciacion_anual?: number;
    fecha_adquisicion: string;
    costo: number;
    valor_residual: number;
    vida_util_meses: number;
    metodo_depreciacion?: "linea_recta" | "saldos_decrecientes" | "unidades_producidas";
    factor_decreciente?: number;
    unidades_vida_util?: number;
    unidades_producidas_acum?: number;
    cuenta_activo: string;
    cuenta_depreciacion_acumulada: string;
    cuenta_gasto_depreciacion: string;
    estado: AssetStatus;
    depreciacion_acumulada: number;
    ultimo_periodo?: string | null;
    cuota_mensual?: number;
    valor_libros?: number;
    venta_valor?: number | null;
    resultado_venta?: number | null;
}

export interface AssetsResponse {
    ok: boolean;
    assets: FixedAsset[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const getAssets = async (params: { estado?: string; search?: string; page?: number } = {}): Promise<AssetsResponse> => {
    const qs = new URLSearchParams({ page: String(params.page ?? 1), limit: "30" });
    if (params.estado) qs.set("estado", params.estado);
    if (params.search) qs.set("search", params.search);
    return parse<AssetsResponse>(await fetch(`${API_ROUTES.FIXED_ASSETS}?${qs.toString()}`, json("GET")));
};

export const createAsset = async (payload: Partial<FixedAsset>): Promise<{ ok: boolean; asset: FixedAsset }> => parse(await fetch(API_ROUTES.FIXED_ASSETS, json("POST", payload)));
export const updateAsset = async (id: string, payload: Partial<FixedAsset>): Promise<{ ok: boolean; asset: FixedAsset }> => parse(await fetch(API_ROUTES.FIXED_ASSET_BY_ID(id), json("PUT", payload)));
export const deleteAsset = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.FIXED_ASSET_BY_ID(id), json("DELETE")));
export const importAssets = async (rows: Partial<FixedAsset>[]): Promise<{ ok: boolean; importados: number }> => parse(await fetch(API_ROUTES.FIXED_ASSETS_IMPORT, json("POST", { rows })));
export const depreciate = async (periodo: string, assetIds?: string[]): Promise<{ ok: boolean; contabilizados: number; omitidos: number; total: number; message: string }> =>
    parse(await fetch(API_ROUTES.FIXED_ASSETS_DEPRECIATE, json("POST", { periodo, assetIds })));
export const disposeAsset = async (id: string, payload: { tipo: "baja" | "venta"; fecha?: string; motivo?: string; ventaValor?: number; cuentaContrapartida?: string; cuentaResultado: string }): Promise<{ ok: boolean; resultado: number; message: string }> =>
    parse(await fetch(API_ROUTES.FIXED_ASSET_DISPOSE(id), json("POST", payload)));

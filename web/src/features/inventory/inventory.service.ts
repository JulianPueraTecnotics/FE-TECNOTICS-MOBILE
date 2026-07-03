import { API_ROUTES } from "../../utils/global";
import type {
    Warehouse,
    CreateWarehousePayload,
    UpdateWarehousePayload,
    StockRow,
    ValorizadoResponse,
    KardexMov,
    AjustePayload,
    TrasladoPayload,
    SaldoInicialRow,
    SaldosInicialesResponse,
} from "./inventory.types";

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

// ============================================
// BODEGAS
// ============================================
export const getWarehouses = async (): Promise<Warehouse[]> =>
    parse(await fetch(API_ROUTES.INVENTORY_WAREHOUSES, json("GET")));

export const createWarehouse = async (payload: CreateWarehousePayload): Promise<Warehouse> =>
    parse(await fetch(API_ROUTES.INVENTORY_WAREHOUSES, json("POST", payload)));

export const updateWarehouse = async (id: string, payload: UpdateWarehousePayload): Promise<Warehouse> =>
    parse(await fetch(API_ROUTES.INVENTORY_WAREHOUSE_BY_ID(id), json("PUT", payload)));

// ============================================
// EXISTENCIAS / VALORIZADO
// ============================================
export const getStock = async (warehouseId?: string): Promise<StockRow[]> => {
    const qs = warehouseId ? `?warehouse_id=${encodeURIComponent(warehouseId)}` : "";
    return parse(await fetch(`${API_ROUTES.INVENTORY_STOCK}${qs}`, json("GET")));
};

export const getValorizado = async (warehouseId?: string): Promise<ValorizadoResponse> => {
    const qs = warehouseId ? `?warehouse_id=${encodeURIComponent(warehouseId)}` : "";
    return parse(await fetch(`${API_ROUTES.INVENTORY_VALORIZADO}${qs}`, json("GET")));
};

// ============================================
// KARDEX
// ============================================
export const getKardex = async (
    itemId: string,
    params: { warehouse_id?: string; desde?: string; hasta?: string } = {},
): Promise<KardexMov[]> => {
    const qs = new URLSearchParams();
    if (params.warehouse_id) qs.set("warehouse_id", params.warehouse_id);
    if (params.desde) qs.set("desde", params.desde);
    if (params.hasta) qs.set("hasta", params.hasta);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return parse(await fetch(`${API_ROUTES.INVENTORY_KARDEX(itemId)}${suffix}`, json("GET")));
};

// ============================================
// MOVIMIENTOS (ajuste / traslado)
// ============================================
export const createAjuste = async (payload: AjustePayload): Promise<KardexMov> =>
    parse(await fetch(API_ROUTES.INVENTORY_AJUSTE, json("POST", payload)));

export const createTraslado = async (payload: TrasladoPayload): Promise<KardexMov> =>
    parse(await fetch(API_ROUTES.INVENTORY_TRASLADO, json("POST", payload)));

// ============================================
// SALDOS INICIALES (carga en lote)
// ============================================
export const cargarSaldosIniciales = async (rows: SaldoInicialRow[]): Promise<SaldosInicialesResponse> =>
    parse(await fetch(API_ROUTES.INVENTORY_SALDOS_INICIALES, json("POST", { rows })));

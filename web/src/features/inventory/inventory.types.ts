// Tipos del módulo de inventario. Forma de datos según los endpoints del backend
// (MC-TECNOTICS-FACTURACION, rutas /inventory/*).

export type WarehouseEstado = "activa" | "inactiva";

export interface Warehouse {
    _id: string;
    company_id?: string;
    codigo: string;
    nombre: string;
    direccion?: string;
    municipio?: string;
    es_principal: boolean;
    estado: WarehouseEstado;
}

export interface CreateWarehousePayload {
    codigo: string;
    nombre: string;
    direccion?: string;
    municipio?: string;
    es_principal?: boolean;
}

export interface UpdateWarehousePayload {
    nombre?: string;
    direccion?: string;
    municipio?: string;
    es_principal?: boolean;
    estado?: WarehouseEstado;
}

export interface StockRow {
    item_id: string;
    item_nombre: string;
    item_code: string;
    warehouse_id: string;
    warehouse_nombre: string;
    cantidad: number;
    costo_promedio: number;
    costo_total: number;
    stock_minimo: number;
    bajo_minimo: boolean;
}

export interface ValorizadoResponse {
    rows: StockRow[];
    total: number;
}

export type KardexTipo =
    | "saldo_inicial"
    | "entrada"
    | "salida"
    | "ajuste_pos"
    | "ajuste_neg"
    | "traslado_in"
    | "traslado_out";

export interface KardexMov {
    _id: string;
    fecha: string;
    tipo: KardexTipo;
    cantidad: number;
    costo_unitario: number;
    costo_total: number;
    saldo_cantidad: number;
    saldo_costo_promedio: number;
    descripcion: string;
    warehouse_id: { codigo: string; nombre: string } | null;
}

export interface AjustePayload {
    item_id: string;
    warehouse_id: string;
    cantidad: number;
    costo_unitario?: number;
    motivo?: string;
    fecha?: string;
}

export interface TrasladoPayload {
    item_id: string;
    from_warehouse_id: string;
    to_warehouse_id: string;
    cantidad: number;
    motivo?: string;
    fecha?: string;
}

export interface SaldoInicialRow {
    item_id: string;
    warehouse_id: string;
    cantidad: number;
    costo_unitario: number;
    fecha?: string;
}

export interface SaldosInicialesResultado {
    item_id: string;
    ok: boolean;
    message?: string;
}

export interface SaldosInicialesResponse {
    ok: boolean;
    resultados: SaldosInicialesResultado[];
    importados: number;
}

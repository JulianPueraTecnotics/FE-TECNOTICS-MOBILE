import { API_ROUTES } from "../utils/global";

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error al cargar el reporte");
    return data.data as T;
}

const get = (url: string) => fetch(url, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });

const qs = (range: { from?: string; to?: string } = {}, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
};

export interface DateRange {
    from?: string;
    to?: string;
}

export interface AgingBucket {
    label: string;
    total: number;
    count: number;
}
export interface AgingRow {
    doc: string;
    nombre: string;
    corriente: number;
    d1_30: number;
    d31_60: number;
    d61_90: number;
    d90_plus: number;
    total: number;
}
export interface AgingReport {
    buckets: AgingBucket[];
    rows: AgingRow[];
    total: number;
    totalVencido: number;
}

export interface TopParty {
    doc: string;
    nombre: string;
    total: number;
    count: number;
    pct: number;
    acumPct: number;
}

export interface MonthlyComparison {
    year: number;
    month: number;
    ventas: number;
    compras: number;
    gastos: number;
    resultado: number;
}

export interface PaymentMethodRow {
    method: string;
    total: number;
    count: number;
}
export interface RecaudoReport {
    rows: PaymentMethodRow[];
    total: number;
}

export interface QuoteFunnel {
    porEstado: { estado: string; count: number; total: number }[];
    enviadas: number;
    aceptadas: number;
    facturadas: number;
    tasaConversion: number;
    valorPipeline: number;
}

export const getCarteraAging = (): Promise<AgingReport> => get(API_ROUTES.REPORT_CARTERA_AGING).then(parse<AgingReport>);
export const getCxpAging = (): Promise<AgingReport> => get(API_ROUTES.REPORT_CXP_AGING).then(parse<AgingReport>);
export const getTopClientes = (range: DateRange): Promise<TopParty[]> => get(API_ROUTES.REPORT_TOP_CLIENTES + qs(range)).then(parse<TopParty[]>);
export const getTopProveedores = (range: DateRange): Promise<TopParty[]> => get(API_ROUTES.REPORT_TOP_PROVEEDORES + qs(range)).then(parse<TopParty[]>);
export const getVentasComprasGastos = (range: DateRange): Promise<MonthlyComparison[]> => get(API_ROUTES.REPORT_VENTAS_COMPRAS_GASTOS + qs(range)).then(parse<MonthlyComparison[]>);
export const getRecaudoFormaPago = (range: DateRange): Promise<RecaudoReport> => get(API_ROUTES.REPORT_RECAUDO_FORMA_PAGO + qs(range)).then(parse<RecaudoReport>);
export const getEmbudoCotizaciones = (range: DateRange): Promise<QuoteFunnel> => get(API_ROUTES.REPORT_EMBUDO_COTIZACIONES + qs(range)).then(parse<QuoteFunnel>);

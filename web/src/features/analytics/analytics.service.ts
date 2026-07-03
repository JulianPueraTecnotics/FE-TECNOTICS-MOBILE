import { API_ROUTES } from "../../utils/global";

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error al cargar la analítica");
    return data.data as T;
}
const get = (url: string) => fetch(url, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });

export interface DateRange {
    from?: string;
    to?: string;
}

/** Períodos rápidos compartidos por el panel del dueño y Estadísticas. */
export type PeriodPreset = "dia" | "mes" | "trimestre" | "semestre" | "anio";
export const PERIOD_PRESETS: { k: PeriodPreset; l: string }[] = [
    { k: "dia", l: "Hoy" },
    { k: "mes", l: "Mes" },
    { k: "trimestre", l: "Trimestre" },
    { k: "semestre", l: "Semestre" },
    { k: "anio", l: "Año" },
];
export const PERIOD_LABEL: Record<PeriodPreset, string> = { dia: "hoy", mes: "mes", trimestre: "trimestre", semestre: "semestre", anio: "año" };

/** Rango de fechas del período EN CURSO (día/mes/trimestre/semestre/año calendario). */
export function presetRange(preset: PeriodPreset | string): DateRange {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();
    // Fecha LOCAL (no toISOString, que en UTC-5 corre el día en la noche).
    const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    switch (preset) {
        case "dia":
            return { from: iso(now), to: iso(now) };
        case "mes":
            return { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) };
        case "trimestre": {
            const q = Math.floor(m / 3) * 3;
            return { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) };
        }
        case "semestre": {
            const s = m < 6 ? 0 : 6;
            return { from: iso(new Date(y, s, 1)), to: iso(new Date(y, s + 6, 0)) };
        }
        case "anio":
            return { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) };
        default:
            return {};
    }
}
const qs = (range: DateRange = {}, extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    Object.entries(extra).forEach(([k, v]) => v && p.set(k, v));
    const s = p.toString();
    return s ? `?${s}` : "";
};

export interface ExecutiveSummary {
    ingresos: number;
    costoVentas: number;
    gastos: number;
    utilidadBruta: number;
    utilidadNeta: number;
    margenBruto: number;
    margenNeto: number;
    caja: number;
    cxc: number;
    cxp: number;
    capitalTrabajo: number;
    deltas?: { ingresos: number; costoVentas: number; gastos: number; utilidadNeta: number };
}

export interface PlMonthlyRow {
    year: number;
    month: number;
    periodo: string;
    ingresos: number;
    costo: number;
    gastoOperativo: number;
    utilidadBruta: number;
    utilidadNeta: number;
    margenBruto: number;
    margenNeto: number;
}

export interface CashflowRow {
    year: number;
    month: number;
    periodo: string;
    saldoInicial: number;
    entradas: number;
    salidas: number;
    neto: number;
    saldoFinal: number;
}
export interface CashflowReport {
    saldoInicial: number;
    saldoFinal: number;
    meses: CashflowRow[];
}

export interface IvaReport {
    generado: number;
    descontable: number;
    saldo: number;
    signo: "pagar" | "favor";
    porPeriodo: { periodo: string; generado: number; descontable: number; saldo: number }[];
}
export interface RetencionRow {
    cuenta: string;
    nombre: string;
    tipo: string;
    base: number;
    valor: number;
}
export interface RetencionesReport {
    practicadas: RetencionRow[];
    totalPracticadas: number;
    totalSufridas: number;
    baseSufrida: number;
}
export interface DsoDpoReport {
    dso: number;
    dpo: number;
    rotacionCartera: number;
    rotacionCxp: number;
    cicloCaja: number;
    cxc: number;
    cxp: number;
    ventas: number;
    compras: number;
    dias: number;
}
export interface TopProducto {
    nombre: string;
    cantidad: number;
    total: number;
    pct: number;
    acumPct: number;
}
export interface PayrollReport {
    costoLaboral: number;
    headcount: number;
    costoPromedio: number;
    porPeriodo: { periodo: string; year: number; month: number; costo: number }[];
    composicion: { cuenta: string; nombre: string; valor: number }[];
}
export interface AssetsReport {
    costoHistorico: number;
    depreciacionAcum: number;
    valorEnLibros: number;
    activosCount: number;
    porEstado: { estado: string; count: number; costo: number; depAcum: number; neto: number }[];
    porCategoria: { categoria: string; count: number; costo: number; depAcum: number; neto: number }[];
}

export const getExecutiveSummary = (range: DateRange): Promise<ExecutiveSummary> =>
    get(API_ROUTES.ANALYTICS_EXECUTIVE + qs(range, { compareTo: "prev" })).then(parse<ExecutiveSummary>);
export const getPlMonthly = (range: DateRange): Promise<PlMonthlyRow[]> =>
    get(API_ROUTES.ANALYTICS_PL_MONTHLY + qs(range)).then(parse<PlMonthlyRow[]>);
export const getCashflowMonthly = (range: DateRange): Promise<CashflowReport> =>
    get(API_ROUTES.ANALYTICS_CASHFLOW + qs(range)).then(parse<CashflowReport>);
export const getIva = (range: DateRange): Promise<IvaReport> => get(API_ROUTES.ANALYTICS_IVA + qs(range)).then(parse<IvaReport>);
export const getRetenciones = (range: DateRange): Promise<RetencionesReport> => get(API_ROUTES.ANALYTICS_RETENCIONES + qs(range)).then(parse<RetencionesReport>);
export const getDsoDpo = (range: DateRange): Promise<DsoDpoReport> => get(API_ROUTES.ANALYTICS_DSO_DPO + qs(range)).then(parse<DsoDpoReport>);
export const getTopProductos = (range: DateRange): Promise<TopProducto[]> => get(API_ROUTES.ANALYTICS_TOP_PRODUCTOS + qs(range)).then(parse<TopProducto[]>);
export const getPayroll = (range: DateRange): Promise<PayrollReport> => get(API_ROUTES.ANALYTICS_PAYROLL + qs(range)).then(parse<PayrollReport>);
export const getAssets = (): Promise<AssetsReport> => get(API_ROUTES.ANALYTICS_ASSETS).then(parse<AssetsReport>);

export interface ProjectionReport {
    historico: { periodo: string; valor: number }[];
    proyeccion: { periodo: string; centro: number; min: number; max: number }[];
    std?: number;
    centro?: number;
}
export interface ScoreRow {
    doc: string;
    nombre: string;
    facturado: number;
    pagado: number;
    saldo: number;
    ejecucion: number;
    movimientos: number;
    score: "eficiente" | "normal" | "riesgo";
}
export interface ScoringReport {
    terceros: ScoreRow[];
    resumen: { eficientes: number; normales: number; riesgo: number };
}
export interface AlertItem { level: "bad" | "warn" | "ok"; icon: string; text: string }
export const getAlerts = (range: DateRange): Promise<{ alerts: AlertItem[] }> => get(API_ROUTES.ANALYTICS_ALERTS + qs(range)).then(parse<{ alerts: AlertItem[] }>);
export const getProjection = (range: DateRange): Promise<ProjectionReport> => get(API_ROUTES.ANALYTICS_PROJECTION + qs(range)).then(parse<ProjectionReport>);
export const getScoring = (range: DateRange, tipo: "cliente" | "proveedor"): Promise<ScoringReport> => get(API_ROUTES.ANALYTICS_SCORING + qs(range, { tipo })).then(parse<ScoringReport>);

export interface CashflowProjRow {
    periodo: string;
    year: number;
    month: number;
    entradas: number;
    salidas: number;
    neto: number;
    saldoInicial: number;
    saldoFinal: number;
}
export interface CashflowProjReport {
    cajaActual: number;
    totalPorCobrar: number;
    totalPorPagar: number;
    vencidoCobrar: number;
    vencidoPagar: number;
    saldoProyectadoFinal: number;
    proyeccion: CashflowProjRow[];
}
export type Urgencia = "al_dia" | "por_vencer" | "vencida" | "critica";
export interface PendingDoc {
    numero: string;
    tercero: string;
    doc: string;
    total: number;
    saldo: number;
    vencimiento: string;
    diasVencido: number;
    urgencia: Urgencia;
}
export interface PendingReport {
    docs: PendingDoc[];
    total: number;
}
export const getCashflowProjection = (): Promise<CashflowProjReport> => get(API_ROUTES.ANALYTICS_CASHFLOW_PROJ).then(parse<CashflowProjReport>);
export const getPendingDocs = (tipo: "cobrar" | "pagar"): Promise<PendingReport> => get(`${API_ROUTES.ANALYTICS_PENDING}?tipo=${tipo}`).then(parse<PendingReport>);

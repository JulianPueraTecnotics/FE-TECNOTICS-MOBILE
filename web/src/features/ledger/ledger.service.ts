import { API_ROUTES } from "../../utils/global";
import type { EntriesResponse, JournalEntry, JournalBookResponse, AccountingPeriod, ManualEntryInput } from "./ledger.types";

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

export const getEntries = async (params: { tipo?: string; estado?: string; desde?: string; hasta?: string; search?: string; page?: number; limit?: number } = {}): Promise<EntriesResponse> => {
    const qs = new URLSearchParams();
    Object.entries({ limit: 20, ...params }).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    });
    return parse<EntriesResponse>(await fetch(`${API_ROUTES.LEDGER_ENTRIES}?${qs.toString()}`, json("GET")));
};

/** Fila del export de auditoría: una línea contable con su comprobante y documento origen. */
export interface EntryExportRow {
    comprobante: string;
    tipo: string;
    fecha: string;
    periodo: string;
    estado: string;
    descripcion_comprobante: string;
    origen_tipo: string;
    documento_origen: string;
    cuenta: string;
    cuenta_nombre: string;
    tercero: string;
    centro_costo: string;
    base: number | string;
    debito: number;
    credito: number;
    descripcion_linea: string;
    creado_por: string;
    contabilizado_por: string;
}

/** Export de auditoría: comprobantes con detalle de líneas y documento origen (para Excel). */
export const getEntriesExport = async (params: { tipo?: string; estado?: string; desde?: string; hasta?: string; search?: string } = {}): Promise<{ ok: boolean; rows: EntryExportRow[]; total_comprobantes: number; total_lineas: number }> => {
    const qs = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    });
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return parse(await fetch(`${API_ROUTES.LEDGER_ENTRIES_EXPORT}${suffix}`, json("GET")));
};

export const getEntry = async (id: string): Promise<{ ok: boolean; entry: JournalEntry }> => parse(await fetch(API_ROUTES.LEDGER_ENTRY_BY_ID(id), json("GET")));
export const createEntry = async (input: ManualEntryInput): Promise<{ ok: boolean; entry: JournalEntry; message: string }> => parse(await fetch(API_ROUTES.LEDGER_ENTRIES, json("POST", input)));
export const updateEntry = async (id: string, input: ManualEntryInput): Promise<{ ok: boolean; entry: JournalEntry }> => parse(await fetch(API_ROUTES.LEDGER_ENTRY_BY_ID(id), json("PUT", input)));
export const postEntry = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.LEDGER_ENTRY_POST(id), json("POST")));
export const annulEntry = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.LEDGER_ENTRY_ANNUL(id), json("POST")));

export const getJournalBook = async (desde?: string, hasta?: string): Promise<JournalBookResponse> => {
    const qs = new URLSearchParams();
    if (desde) qs.set("desde", desde);
    if (hasta) qs.set("hasta", hasta);
    return parse<JournalBookResponse>(await fetch(`${API_ROUTES.LEDGER_JOURNAL}?${qs.toString()}`, json("GET")));
};

export const getPeriods = async (): Promise<{ ok: boolean; periods: AccountingPeriod[] }> => parse(await fetch(API_ROUTES.LEDGER_PERIODS, json("GET")));
export const setPeriod = async (periodo: string, estado: "abierto" | "cerrado" | "bloqueado"): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.LEDGER_PERIODS, json("POST", { periodo, estado })));

// Saldos iniciales (apertura)
export interface OpeningLine { cuenta: string; tercero_nombre?: string; referencia?: string; debito?: number; credito?: number; descripcion?: string }
export const getOpeningStatus = async (): Promise<{ ok: boolean; exists: boolean }> => parse(await fetch(API_ROUTES.LEDGER_OPENING, json("GET")));
export const createOpening = async (input: { fecha: string; descripcion?: string; lineas: OpeningLine[] }): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.LEDGER_OPENING, json("POST", input)));

// Cierre anual
export const getClosingStatus = async (anio: number): Promise<{ ok: boolean; cerrado: boolean; cl_id: string | null; borradores: number }> =>
    parse(await fetch(`${API_ROUTES.LEDGER_CLOSING_STATUS}?anio=${anio}`, json("GET")));
export const closeYear = async (anio: number): Promise<{ ok: boolean; utilidad: number; message: string }> => parse(await fetch(API_ROUTES.LEDGER_CLOSE_YEAR, json("POST", { anio })));
export const reopenYear = async (anio: number): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.LEDGER_REOPEN_YEAR, json("POST", { anio })));

// ── Ajustes contables periódicos ──
export interface AdjustmentEntryResult { ok: boolean; entry: JournalEntry; message: string }

export interface DeferralItem { descripcion?: string; cuenta_gasto: string; cuenta_diferido: string; valor: number; meses?: number; cuota?: number }
export const amortizeDeferrals = async (input: { periodo: string; fecha?: string; items: DeferralItem[] }): Promise<AdjustmentEntryResult> =>
    parse(await fetch(API_ROUTES.LEDGER_ADJ_AMORTIZE, json("POST", input)));

export interface ProvisionItem { descripcion?: string; cuenta_gasto: string; cuenta_pasivo: string; monto: number }
export const provisionMonthly = async (input: { periodo: string; fecha?: string; items: ProvisionItem[] }): Promise<AdjustmentEntryResult> =>
    parse(await fetch(API_ROUTES.LEDGER_ADJ_PROVISION, json("POST", input)));

export interface ExchangeItem { cuenta: string; descripcion?: string; saldo_moneda: number; trm_anterior: number; trm_actual: number; naturaleza?: "activo" | "pasivo" }
export const exchangeRevaluation = async (input: { periodo: string; fecha?: string; cuenta_ingreso_dif: string; cuenta_gasto_dif: string; items: ExchangeItem[] }): Promise<AdjustmentEntryResult & { totalDiferencia: number }> =>
    parse(await fetch(API_ROUTES.LEDGER_ADJ_EXCHANGE, json("POST", input)));

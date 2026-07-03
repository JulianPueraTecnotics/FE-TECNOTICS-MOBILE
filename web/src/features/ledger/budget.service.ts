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

export type Escenario = "base" | "optimista" | "pesimista";

// ===== Presupuesto =====
export interface BudgetLine {
    _id: string;
    company_id?: string;
    anio: number;
    escenario: Escenario;
    cuenta: string;
    centro_costo_id?: string | null;
    meses: number[]; // 12 posiciones (ene..dic)
}

export interface BudgetExecutionRow {
    cuenta: string;
    cuenta_nombre: string;
    centro_costo_id?: string | null;
    presupuestado: number;
    ejecutado: number;
    desviacion: number;
    cumplimiento: number;
    meses_presupuesto: number[];
    meses_ejecutado: number[];
}

export interface BudgetExecutionResponse {
    ok: boolean;
    anio: number;
    escenario: Escenario;
    rows: BudgetExecutionRow[];
    totales: { presupuestado: number; ejecutado: number; desviacion: number };
}

export const getBudget = async (anio: number, escenario: Escenario): Promise<BudgetLine[]> => {
    const qs = new URLSearchParams({ anio: String(anio), escenario });
    const data = await parse<BudgetLine[] | { lines?: BudgetLine[] }>(await fetch(`${API_ROUTES.LEDGER_BUDGET}?${qs.toString()}`, json("GET")));
    return Array.isArray(data) ? data : data.lines ?? [];
};

export const upsertBudget = async (payload: { anio: number; escenario: Escenario; cuenta: string; centro_costo_id?: string; meses: number[] }): Promise<BudgetLine> => {
    const data = await parse<BudgetLine | { line: BudgetLine }>(await fetch(API_ROUTES.LEDGER_BUDGET, json("POST", payload)));
    return "line" in data ? data.line : data;
};

export const deleteBudget = async (id: string): Promise<{ ok: boolean; message?: string }> =>
    parse(await fetch(API_ROUTES.LEDGER_BUDGET_BY_ID(id), json("DELETE")));

export const getBudgetExecution = async (anio: number, escenario: Escenario, centroCostoId?: string): Promise<BudgetExecutionResponse> => {
    const qs = new URLSearchParams({ anio: String(anio), escenario });
    if (centroCostoId) qs.set("centro_costo_id", centroCostoId);
    return parse<BudgetExecutionResponse>(await fetch(`${API_ROUTES.LEDGER_BUDGET_EXECUTION}?${qs.toString()}`, json("GET")));
};

// ===== Notas a los estados financieros =====
export interface FinancialNote {
    _id: string;
    company_id?: string;
    corte: string;
    numero: number;
    titulo: string;
    contenido: string;
    orden: number;
}

export const getNotes = async (corte: string): Promise<FinancialNote[]> => {
    const qs = new URLSearchParams({ corte });
    const data = await parse<FinancialNote[] | { notes?: FinancialNote[] }>(await fetch(`${API_ROUTES.LEDGER_NOTES}?${qs.toString()}`, json("GET")));
    return Array.isArray(data) ? data : data.notes ?? [];
};

export const upsertNote = async (payload: { _id?: string; corte: string; numero: number; titulo: string; contenido: string; orden: number }): Promise<FinancialNote> => {
    const data = await parse<FinancialNote | { note: FinancialNote }>(await fetch(API_ROUTES.LEDGER_NOTES, json("POST", payload)));
    return "note" in data ? data.note : data;
};

export const seedNotes = async (corte: string): Promise<{ ok: boolean; message?: string }> =>
    parse(await fetch(API_ROUTES.LEDGER_NOTES_SEED, json("POST", { corte })));

export const deleteNote = async (id: string): Promise<{ ok: boolean; message?: string }> =>
    parse(await fetch(API_ROUTES.LEDGER_NOTE_BY_ID(id), json("DELETE")));

// ===== Conciliación fiscal =====
export interface ConciliacionFiscalPartida {
    cuenta: string;
    nombre: string;
    saldo_contable: number;
    tipo: string;
}

export interface ConciliacionFiscalResponse {
    ok: boolean;
    partidas: ConciliacionFiscalPartida[];
    resumen: { gastos_no_deducibles: number; nota: string };
}

export const getConciliacionFiscal = async (desde: string, hasta: string): Promise<ConciliacionFiscalResponse> => {
    const qs = new URLSearchParams({ desde, hasta });
    return parse<ConciliacionFiscalResponse>(await fetch(`${API_ROUTES.LEDGER_CONCILIACION_FISCAL}?${qs.toString()}`, json("GET")));
};

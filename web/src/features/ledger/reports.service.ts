import { API_ROUTES } from "../../utils/global";

const get = (url: string) => fetch(url, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
}

const qs = (params: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v) p.set(k, v); });
    return p.toString();
};

export interface TrialBalanceRow {
    cuenta: string;
    nombre: string;
    clase: string;
    debitos: number;
    creditos: number;
    saldo: number;
    saldo_naturaleza: "debito" | "credito";
}
export interface TrialBalanceResponse {
    ok: boolean;
    rows: TrialBalanceRow[];
    totalDebitos: number;
    totalCreditos: number;
    cuadra: boolean;
}

export interface LedgerRow {
    cuenta: string;
    nombre: string;
    saldo_inicial: number;
    debitos: number;
    creditos: number;
    saldo_final: number;
}

export interface AccountDetailRow {
    fecha: string;
    tipo: string;
    consecutivo: number;
    descripcion: string;
    linea_desc?: string;
    tercero?: string;
    debito: number;
    credito: number;
}

export interface ThirdPartyRow {
    tercero: string;
    cuenta: string;
    debitos: number;
    creditos: number;
    saldo: number;
}

export interface FinancialLine {
    grupo: string;
    nombre: string;
    saldo: number;
}
export interface FinancialStatements {
    ok: boolean;
    balance_general: {
        activos: FinancialLine[]; total_activos: number;
        pasivos: FinancialLine[]; total_pasivos: number;
        patrimonio: FinancialLine[]; total_patrimonio: number;
        utilidad_ejercicio: number;
    };
    estado_resultados: {
        ingresos: FinancialLine[]; total_ingresos: number;
        gastos: FinancialLine[]; total_gastos: number;
        utilidad: number;
    };
}

export const getTrialBalance = async (desde?: string, hasta?: string) =>
    parse<TrialBalanceResponse>(await get(`${API_ROUTES.LEDGER_TRIAL_BALANCE}?${qs({ desde, hasta })}`));

export const getGeneralLedger = async (desde?: string, hasta?: string) =>
    parse<{ ok: boolean; rows: LedgerRow[] }>(await get(`${API_ROUTES.LEDGER_GENERAL_LEDGER}?${qs({ desde, hasta })}`));

export const getAccountDetail = async (cuenta: string, desde?: string, hasta?: string) =>
    parse<{ ok: boolean; cuenta: string; rows: AccountDetailRow[]; totalDebitos: number; totalCreditos: number }>(await get(`${API_ROUTES.LEDGER_ACCOUNT_DETAIL}?${qs({ cuenta, desde, hasta })}`));

export const getThirdParty = async (desde?: string, hasta?: string) =>
    parse<{ ok: boolean; rows: ThirdPartyRow[] }>(await get(`${API_ROUTES.LEDGER_THIRD_PARTY}?${qs({ desde, hasta })}`));

export const getFinancialStatements = async (desde?: string, hasta?: string) =>
    parse<FinancialStatements>(await get(`${API_ROUTES.LEDGER_FINANCIAL}?${qs({ desde, hasta })}`));

import { API_ROUTES } from "../../utils/global";
import type { AccountingConfig, AccountingSequence, CostCenter, CoaAccount, CoaTemplateRow, Role, PermissionGroup, BlockedRange, Uvt, RetentionConcept } from "./accounting.types";

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

// Cuentas contables por defecto
export const getAccountingConfig = async (): Promise<{ ok: boolean; config: AccountingConfig }> => parse(await fetch(API_ROUTES.ACCOUNTING_CONFIG, json("GET")));
export const saveAccountingConfig = async (payload: Partial<AccountingConfig>): Promise<{ ok: boolean; config: AccountingConfig }> => parse(await fetch(API_ROUTES.ACCOUNTING_CONFIG, json("PUT", payload)));

// Consecutivos
export const getSequence = async (type: "egreso" | "causacion"): Promise<{ ok: boolean; sequence: AccountingSequence | null }> => parse(await fetch(API_ROUTES.ACCOUNTING_SEQUENCE(type), json("GET")));
export const configureSequence = async (type: "egreso" | "causacion", base_number: number, numero_comprobante?: number): Promise<{ ok: boolean; sequence: AccountingSequence; message: string }> =>
    parse(await fetch(API_ROUTES.ACCOUNTING_SEQUENCE(type), json("PUT", { base_number, numero_comprobante })));
export const blockSequenceRange = async (type: "egreso" | "causacion", range: BlockedRange): Promise<{ ok: boolean; sequence: AccountingSequence }> =>
    parse(await fetch(API_ROUTES.ACCOUNTING_SEQUENCE_BLOCK(type), json("POST", range)));

// Centros de costo
export const getCostCenters = async (): Promise<{ ok: boolean; cost_centers: CostCenter[] }> => parse(await fetch(API_ROUTES.ACCOUNTING_COST_CENTERS, json("GET")));
export const createCostCenter = async (codigo: string, descripcion: string): Promise<{ ok: boolean; cost_center: CostCenter }> => parse(await fetch(API_ROUTES.ACCOUNTING_COST_CENTERS, json("POST", { codigo, descripcion })));
export const deleteCostCenter = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.ACCOUNTING_COST_CENTER_BY_ID(id), json("DELETE")));
export const importCostCenters = async (rows: { codigo: string; descripcion?: string }[]): Promise<{ ok: boolean; importados: number }> => parse(await fetch(API_ROUTES.ACCOUNTING_COST_CENTERS_IMPORT, json("POST", { rows })));

// PUC
export const getCoa = async (page = 1, limit = 50, search = ""): Promise<{ ok: boolean; accounts: CoaAccount[]; pagination: { page: number; totalPages: number; total: number } }> =>
    parse(await fetch(`${API_ROUTES.ACCOUNTING_COA}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`, json("GET")));
export const importCoa = async (rows: Partial<CoaAccount>[]): Promise<{ ok: boolean; importadas: number }> => parse(await fetch(API_ROUTES.ACCOUNTING_COA_IMPORT, json("POST", { rows })));
/** Importa el PUC desde la plantilla completa (Código, Nombre, Categoría, Clase, etc.). */
export const importCoaTemplate = async (rows: CoaTemplateRow[]): Promise<{ ok: boolean; importadas: number; message: string }> =>
    parse(await fetch(API_ROUTES.ACCOUNTING_COA_IMPORT_TEMPLATE, json("POST", { rows })));
export const bootstrapAccounting = async (): Promise<{ ok: boolean; puc_creadas: number; cuentas_default_asignadas: number; message: string }> =>
    parse(await fetch(API_ROUTES.ACCOUNTING_BOOTSTRAP, json("POST")));
export const bootstrapTestData = async (anio?: number): Promise<{ ok: boolean; message: string; summary: Record<string, unknown> }> =>
    parse(await fetch(API_ROUTES.ACCOUNTING_BOOTSTRAP_TEST_DATA, json("POST", anio != null ? { anio } : {})));

// Roles
export const getPermissionsCatalog = async (): Promise<{ ok: boolean; groups: PermissionGroup[] }> => parse(await fetch(API_ROUTES.ACCOUNTING_PERMISSIONS, json("GET")));
export const getRoles = async (): Promise<{ ok: boolean; roles: Role[] }> => parse(await fetch(API_ROUTES.ACCOUNTING_ROLES, json("GET")));
export const seedDefaultRoles = async (): Promise<{ ok: boolean; roles: Role[]; created: number; message: string }> => parse(await fetch(API_ROUTES.ACCOUNTING_ROLES_SEED, json("POST")));
export const createRole = async (name: string, permissions: string[]): Promise<{ ok: boolean; role: Role }> => parse(await fetch(API_ROUTES.ACCOUNTING_ROLES, json("POST", { name, permissions })));
export const updateRole = async (id: string, name: string, permissions: string[]): Promise<{ ok: boolean; role: Role }> => parse(await fetch(API_ROUTES.ACCOUNTING_ROLE_BY_ID(id), json("PUT", { name, permissions })));
export const deleteRole = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.ACCOUNTING_ROLE_BY_ID(id), json("DELETE")));

// UVT
export const getUvt = async (): Promise<{ ok: boolean; uvts: Uvt[] }> => parse(await fetch(API_ROUTES.ACCOUNTING_UVT, json("GET")));
export const setUvt = async (anio: number, valor: number): Promise<{ ok: boolean; uvt: Uvt }> => parse(await fetch(API_ROUTES.ACCOUNTING_UVT, json("PUT", { anio, valor })));

// Conceptos de retención
export const getRetentions = async (): Promise<{ ok: boolean; concepts: RetentionConcept[] }> => parse(await fetch(API_ROUTES.ACCOUNTING_RETENTIONS, json("GET")));
export const createRetention = async (payload: Partial<RetentionConcept>): Promise<{ ok: boolean; concept: RetentionConcept }> => parse(await fetch(API_ROUTES.ACCOUNTING_RETENTIONS, json("POST", payload)));
export const updateRetention = async (id: string, payload: Partial<RetentionConcept>): Promise<{ ok: boolean; concept: RetentionConcept }> => parse(await fetch(API_ROUTES.ACCOUNTING_RETENTION_BY_ID(id), json("PUT", payload)));
export const deleteRetention = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.ACCOUNTING_RETENTION_BY_ID(id), json("DELETE")));

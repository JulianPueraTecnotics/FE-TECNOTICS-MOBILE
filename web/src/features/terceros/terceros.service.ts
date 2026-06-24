import { API_ROUTES } from "../../utils/global";
import type { Tercero, TercerosResponse, MigrateResult } from "./terceros.types";

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

export const getTerceros = async (page = 1, limit = 20, search = "", rol = ""): Promise<TercerosResponse> => {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) qs.set("search", search);
    if (rol) qs.set("rol", rol);
    return parse<TercerosResponse>(await fetch(`${API_ROUTES.TERCEROS}?${qs.toString()}`, json("GET")));
};

export const createTercero = async (payload: Partial<Tercero>): Promise<{ ok: boolean; tercero: Tercero }> => parse(await fetch(API_ROUTES.TERCEROS, json("POST", payload)));
export const updateTercero = async (id: string, payload: Partial<Tercero>): Promise<{ ok: boolean; tercero: Tercero }> => parse(await fetch(API_ROUTES.TERCERO_BY_ID(id), json("PUT", payload)));
export const deleteTercero = async (id: string): Promise<{ ok: boolean; message: string }> => parse(await fetch(API_ROUTES.TERCERO_BY_ID(id), json("DELETE")));
export const migrateTerceros = async (): Promise<MigrateResult> => parse(await fetch(API_ROUTES.TERCEROS_MIGRATE, json("POST")));
export const backfillTerceros = async (): Promise<{ ok: boolean; clientes: number; proveedores: number; empleados: number; message: string }> =>
    parse(await fetch(API_ROUTES.TERCEROS_BACKFILL, json("POST")));

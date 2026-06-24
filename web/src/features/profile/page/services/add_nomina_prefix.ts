import { API_ROUTES } from "../../../../utils/global";
import type { PrefixesResponse } from "./add_prefix";

export interface AddNominaPrefixBody {
    prefix: string;
    /** Consecutivo inicial desde el cual numerar la nómina. */
    consecutivo_inicial: number;
}

/**
 * Añade un prefijo de NÓMINA ELECTRÓNICA. A diferencia de facturación, solo requiere
 * el código del prefijo y el consecutivo inicial (sin resolución DIAN ni tipo de factura).
 */
export const addNominaPrefixService = async (
    body: AddNominaPrefixBody
): Promise<PrefixesResponse> => {
    const response = await fetch(API_ROUTES.COMPANY_NOMINA_PREFIXES, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al añadir el prefijo de nómina");
    }

    return data;
};

import { API_ROUTES } from "../../../../utils/global";
import type { CompanyPrefix, PrefixResolution } from "./get_profile";

export interface AddPrefixBody {
    prefix: string;
    /** Obligatorio al crear un prefijo. */
    resolution: PrefixResolution;
}

export interface PrefixesResponse {
    ok: boolean;
    prefixes: CompanyPrefix[];
}

/**
 * Añade un prefijo a la compañía.
 * Si es el primer prefijo, se crea con default: true; si ya hay otros, con default: false.
 */
export const addPrefixService = async (
    body: AddPrefixBody
): Promise<PrefixesResponse> => {
    const response = await fetch(API_ROUTES.COMPANY_PREFIXES, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al añadir el prefijo");
    }

    return data;
};

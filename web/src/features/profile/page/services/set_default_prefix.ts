import { API_ROUTES } from "../../../../utils/global";
import type { CompanyPrefix } from "./get_profile";

export interface SetDefaultPrefixBody {
    prefix: string;
}

export interface PrefixesResponse {
    ok: boolean;
    prefixes: CompanyPrefix[];
}

/**
 * Establece el prefijo indicado como el único por defecto de la compañía.
 */
export const setDefaultPrefixService = async (
    body: SetDefaultPrefixBody
): Promise<PrefixesResponse> => {
    const response = await fetch(API_ROUTES.COMPANY_PREFIXES_DEFAULT, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al establecer el prefijo por defecto");
    }

    return data;
};

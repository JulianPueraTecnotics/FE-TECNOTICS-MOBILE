import { API_ROUTES } from "../../../../utils/global";
import type { CompanyPrefix } from "./get_profile";

export interface PrefixesResponse {
    ok: boolean;
    prefixes: CompanyPrefix[];
}

/**
 * Elimina un prefijo de la compañía.
 * Si se elimina el que era default y quedan otros, el backend asigna el primero como nuevo default.
 */
export const deletePrefixService = async (prefix: string): Promise<PrefixesResponse> => {
    const response = await fetch(`${API_ROUTES.COMPANY_PREFIXES}/${encodeURIComponent(prefix)}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al eliminar el prefijo");
    }

    return data;
};

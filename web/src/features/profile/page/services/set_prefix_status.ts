import { API_ROUTES } from "../../../../utils/global";
import type { CompanyPrefix } from "./get_profile";

export interface SetPrefixStatusBody {
    prefix: string;
    status: "active" | "inactive";
}

export interface PrefixesResponse {
    ok: boolean;
    prefixes: CompanyPrefix[];
}

export const setPrefixStatusService = async (
    body: SetPrefixStatusBody
): Promise<PrefixesResponse> => {
    const response = await fetch(API_ROUTES.COMPANY_PREFIXES_STATUS, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al actualizar el estado del prefijo");
    }

    return data;
};

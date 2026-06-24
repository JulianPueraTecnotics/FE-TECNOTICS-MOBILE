import { API_ROUTES } from "../../../../utils/global";
import type { Suscription, SuscriptionPlan } from "../../../../types";

export interface CompanySubscriptionResponse {
    suscription: Suscription;
    plan: SuscriptionPlan | null;
    used_documents: number;
}

/**
 * Obtiene la suscripción actual de la compañía autenticada junto con su plan
 * y el uso real de documentos. Devuelve `null` si la compañía no tiene suscripción.
 */
export const getSubscriptionService = async (): Promise<CompanySubscriptionResponse | null> => {
    const response = await fetch(API_ROUTES.COMPANY_SUBSCRIPTION, {
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (response.status === 404) {
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message || "Error al obtener la suscripción");
    }

    return data as CompanySubscriptionResponse;
};

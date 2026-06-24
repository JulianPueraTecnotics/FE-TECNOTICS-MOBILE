import { API_ROUTES } from "../../../../utils/global";
import type { CompanyPrefix, ReceiveBillsReportsConfig } from "./get_profile";

export interface UpdateCompanyInfoAddress {
    value: string;
    ciudad_codigo: string;
    departamento_codigo: string;
    pais_codigo: string;
    zip_code?: string;
}

export interface UpdateCompanyBankAccount {
    name?: string;
    account_number?: string;
    account_type?: "ahorro" | "corriente";
}

export interface UpdateCompanyInfoBody {
    email?: string;
    phone?: string;
    website?: string;
    address?: UpdateCompanyInfoAddress;
    bank_account?: UpdateCompanyBankAccount;
    prefixes?: CompanyPrefix[];
    observations?: string;
    config?: {
        receive_bills_reports?: Partial<ReceiveBillsReportsConfig>;
    };
}

export interface UpdateCompanyInfoResponse {
    ok: boolean;
    message?: string;
}

/**
 * Actualiza la información de la empresa (email, teléfono, web, dirección, prefijos).
 * Solo se envían los campos presentes en el body; todos son opcionales.
 */
export const updateCompanyInfoService = async (
    body: UpdateCompanyInfoBody
): Promise<UpdateCompanyInfoResponse> => {
    const response = await fetch(API_ROUTES.UPDATE_COMPANY_INFO, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al actualizar la información");
    }

    return data;
};

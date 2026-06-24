import { API_ROUTES } from "../../../../utils/global";

export interface SimbaActivationBody {
    setTestId: string;
}

export interface SimbaActivationResponse {
    Error: boolean;
    Msg: string;
}

async function callSimbaActivation(
    url: string,
    body: SimbaActivationBody
): Promise<SimbaActivationResponse> {
    const response = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message ?? data?.Msg ?? "Error al ejecutar la habilitación en Simba");
    }

    return data;
}

export const habilitarFeService = async (
    body: SimbaActivationBody
): Promise<SimbaActivationResponse> =>
    callSimbaActivation(API_ROUTES.COMPANY_SIMBA_HABILITAR_FE, body);

export const habilitarPosService = async (
    body: SimbaActivationBody
): Promise<SimbaActivationResponse> =>
    callSimbaActivation(API_ROUTES.COMPANY_SIMBA_HABILITAR_POS, body);

/**
 * Habilitación de Nómina Electrónica ante la DIAN.
 * A diferencia de FE/POS, la nómina NO usa SetTestId: la sonda se arma en el backend con los datos
 * de la empresa (NIT, DV, razón social, token), por lo que no se envía body.
 */
export const habilitarNominaService = async (): Promise<SimbaActivationResponse> => {
    const response = await fetch(API_ROUTES.COMPANY_SIMBA_HABILITAR_NE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data?.message ?? data?.Msg ?? "Error al habilitar nómina electrónica");
    }

    return data;
};

/** Respuesta tal como la devuelve el API (payload de Simba GetNumberingRange). */
export const fetchSimbaNumberingRange = async (): Promise<unknown> => {
    const response = await fetch(API_ROUTES.COMPANY_SIMBA_NUMBERING_RANGE, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(
            (data as { message?: string; Msg?: string })?.message ??
                (data as { Msg?: string })?.Msg ??
                "Error al consultar rangos de numeración en Simba"
        );
    }

    return data;
};

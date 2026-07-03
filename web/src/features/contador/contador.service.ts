import { API_ROUTES } from "../../utils/global";

export interface ContadorEmpresa {
    company_id: string;
    razon_social: string;
    avatar?: string;
}

export interface ContadorSignInData {
    account: "contador";
    need_twofa: boolean;
    contador_id: string;
    email?: string;
    name?: string;
    empresas?: ContadorEmpresa[];
    message?: string;
}

export interface SelectCompanyData {
    account: "company";
    company_id: string;
    razon_social: string;
    role: "company";
    avatar?: string;
}

const post = async <T>(url: string, body: unknown): Promise<T> => {
    const res = await fetch(url, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error en la solicitud");
    return (data.data ?? data) as T;
};

export const contadorSignIn = (
  email: string,
  password: string,
  turnstileToken?: string
): Promise<ContadorSignInData> =>
  post(API_ROUTES.CONTADOR_SIGNIN, { email, password, ...(turnstileToken ? { turnstileToken } : {}) });

export const contadorVerify2FA = (email: string, code: string): Promise<ContadorSignInData> =>
    post(API_ROUTES.CONTADOR_VERIFY_2FA, { email, code });

export const contadorSelectCompany = (contador_id: string, company_id: string): Promise<SelectCompanyData> =>
    post(API_ROUTES.CONTADOR_SELECT_COMPANY, { contador_id, company_id });

// ── Admin: gestión de contadores ──
export interface ContadorRow { _id: string; name: string; last_name: string; email: string; active: boolean; empresas: number; }

export const adminListContadores = async (): Promise<ContadorRow[]> => {
    const res = await fetch(API_ROUTES.ADMIN_CONTADORES, { method: "GET", credentials: "include", headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error al listar contadores");
    return data;
};
export const adminCreateContador = (body: { name: string; last_name: string; email: string; password: string; companies_assigned: string[] }) =>
    post(API_ROUTES.ADMIN_CONTADORES, body);
export const adminUpdateContador = async (id: string, body: { name?: string; last_name?: string; active?: boolean; companies_assigned?: string[]; password?: string }) => {
    const res = await fetch(API_ROUTES.ADMIN_CONTADOR_BY_ID(id), { method: "PUT", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error al actualizar");
    return data;
};
export const adminDeleteContador = async (id: string) => {
    const res = await fetch(API_ROUTES.ADMIN_CONTADOR_BY_ID(id), { method: "DELETE", credentials: "include", headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Error al eliminar");
    return data;
};

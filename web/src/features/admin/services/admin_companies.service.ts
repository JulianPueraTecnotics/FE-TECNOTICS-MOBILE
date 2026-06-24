import { API_ROUTES } from "../../../utils/global";
import type { CompanyInterface, CompanyDocuments } from "../../profile/page/services/get_profile";
import type { CompanySubscriptionResponse } from "../../profile/page/services/get_subscription";

const JSON_HEADERS = { "Content-Type": "application/json" };

/** Conteos por empresa (facturas emitidas, items, clientes, prefijos). */
export interface AdminCompanyStats {
    facturas: number;
    items: number;
    clientes: number;
    prefijos: number;
}

/** Empresa resumida en el listado del panel. */
export interface AdminCompanyListItem {
    _id: string;
    razon_social: string;
    email: string;
    phone?: string;
    doc_type?: { value: string };
    doc_number?: string;
    doc_number_dv?: string;
    logo?: { url?: string };
    active: boolean;
    created?: string;
    stats?: AdminCompanyStats;
}

export interface AdminCompaniesPage {
    companies: AdminCompanyListItem[];
    total: number;
    page: number;
    limit: number;
    pages: number;
}

export interface AdminCompanyDetail {
    company: CompanyInterface;
    companyDocuments: CompanyDocuments;
    stats?: AdminCompanyStats;
}

export interface AdminUpdateCompanyBody {
    email?: string;
    phone?: string;
    website?: string;
    address?: { value?: string };
    bank_account?: { name?: string; account_number?: string; account_type?: "ahorro" | "corriente" };
    observations?: string;
}

export interface AdminSubUser {
    _id: string;
    name: string;
    last_name: string;
    email: string;
    phone?: string;
    active: boolean;
    created_at?: string;
}

export const adminListCompanies = async ({ page = 1, limit = 20, search }: { page?: number; limit?: number; search?: string }): Promise<AdminCompaniesPage> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search?.trim()) params.set("search", search.trim());

    const response = await fetch(`${API_ROUTES.ADMIN_COMPANIES}?${params.toString()}`, {
        credentials: "include",
        headers: JSON_HEADERS,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al listar las empresas");
    return payload.data as AdminCompaniesPage;
};

export const adminGetCompany = async (companyId: string): Promise<AdminCompanyDetail> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_DETAIL(companyId), {
        credentials: "include",
        headers: JSON_HEADERS,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al obtener la empresa");
    return payload.data as AdminCompanyDetail;
};

export const adminUpdateCompany = async (companyId: string, body: AdminUpdateCompanyBody): Promise<string> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_DETAIL(companyId), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar la empresa");
    return payload.message ?? "Empresa actualizada";
};

export const adminGetCompanySubscription = async (companyId: string): Promise<CompanySubscriptionResponse | null> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_SUBSCRIPTION(companyId), {
        credentials: "include",
        headers: JSON_HEADERS,
    });
    if (response.status === 404) return null;
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al obtener la suscripción");
    return (payload.data ?? null) as CompanySubscriptionResponse | null;
};

export const adminListCompanySubUsers = async (companyId: string, { page = 1, limit = 50 }: { page?: number; limit?: number } = {}): Promise<AdminSubUser[]> => {
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    const response = await fetch(`${API_ROUTES.ADMIN_COMPANY_SUBUSERS(companyId)}?${params.toString()}`, {
        credentials: "include",
        headers: JSON_HEADERS,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al listar los subusuarios");
    // El backend reutiliza getSubUsers: puede devolver { data: { users, ... } } o un arreglo.
    const data = payload.data;
    if (Array.isArray(data)) return data as AdminSubUser[];
    if (Array.isArray(data?.users)) return data.users as AdminSubUser[];
    if (Array.isArray(data?.subUsers)) return data.subUsers as AdminSubUser[];
    if (Array.isArray(data?.docs)) return data.docs as AdminSubUser[];
    return [];
};

// ============================================================
// Listados internos de una empresa (facturas, clientes, items)
// ============================================================

export interface AdminPage<T> {
    items: T[];
    total: number;
    page: number;
    pages: number;
}

export interface AdminInvoice {
    _id: string;
    number: string;
    date: string | null;
    client: string;
    total: number;
    currency: string;
    status: string;
    is_draft: boolean;
}

export interface AdminClient {
    _id: string;
    name: string;
    email?: string;
    phone?: string;
    doc_type?: string;
    doc_number?: string;
    doc_number_dv?: string;
    tipoPersona?: string;
}

export interface AdminItem {
    _id: string;
    name: string;
    code?: string;
    description?: string;
    price?: number;
    kind?: string;
    unidad_medida?: string;
    quantity?: number;
    total?: number;
}

const fetchAdminPage = async <T>(url: string): Promise<AdminPage<T>> => {
    const response = await fetch(url, { credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al cargar la información");
    const d = payload.data ?? {};
    return { items: d.items ?? [], total: d.total ?? 0, page: d.page ?? 1, pages: d.pages ?? 1 };
};

export const adminListCompanyInvoices = (companyId: string, page = 1, limit = 20): Promise<AdminPage<AdminInvoice>> =>
    fetchAdminPage<AdminInvoice>(`${API_ROUTES.ADMIN_COMPANY_INVOICES(companyId)}?page=${page}&limit=${limit}`);

export const adminListCompanyClients = (companyId: string, page = 1, limit = 20, search?: string): Promise<AdminPage<AdminClient>> =>
    fetchAdminPage<AdminClient>(`${API_ROUTES.ADMIN_COMPANY_CLIENTS(companyId)}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`);

export const adminListCompanyItems = (companyId: string, page = 1, limit = 20, search?: string): Promise<AdminPage<AdminItem>> =>
    fetchAdminPage<AdminItem>(`${API_ROUTES.ADMIN_COMPANY_ITEMS(companyId)}?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ""}`);

// ============================================================
// Acciones de gestión
// ============================================================

export const adminSetCompanyActive = async (companyId: string, active: boolean): Promise<{ active: boolean }> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_ACTIVE(companyId), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ active }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el estado");
    return payload.data ?? { active };
};

export const adminResetCompanyPassword = async (companyId: string, new_password: string): Promise<string> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_RESET_PASSWORD(companyId), {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ new_password }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al restablecer la contraseña");
    return payload.message ?? "Contraseña actualizada";
};

export const adminResetSubUserPassword = async (userId: string, new_password: string): Promise<string> => {
    const response = await fetch(API_ROUTES.ADMIN_SUBUSER_RESET_PASSWORD(userId), {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ new_password }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al restablecer la contraseña");
    return payload.message ?? "Contraseña actualizada";
};

// ============================================================
// Prefijos de la empresa
// ============================================================

export interface AdminPrefixResolutionInput {
    init: number;
    end: number;
    resolution: string;
    start_date: string;
    end_date: string;
    tipo_doc_electronico: string;
    tipo_factura: string;
}

export const adminAddPrefix = async (companyId: string, prefix: string, resolution: AdminPrefixResolutionInput): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_PREFIXES(companyId), {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ prefix, resolution }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al agregar el prefijo");
};

export const adminSetPrefixDefault = async (companyId: string, prefix: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_PREFIX_DEFAULT(companyId), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ prefix }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el prefijo por defecto");
};

export const adminSetPrefixStatus = async (companyId: string, prefix: string, status: "active" | "inactive"): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_PREFIX_STATUS(companyId), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ prefix, status }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el estado del prefijo");
};

export const adminRemovePrefix = async (companyId: string, prefix: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_PREFIX_DELETE(companyId, prefix), {
        method: "DELETE",
        credentials: "include",
        headers: JSON_HEADERS,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al eliminar el prefijo");
};

export const adminUpdatePrefix = async (companyId: string, prefix: string, resolution: AdminPrefixResolutionInput): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_PREFIX_DELETE(companyId, prefix), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ resolution }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el prefijo");
};

// ============================================================
// Administradores (superadmins)
// ============================================================

export interface AdminAccount {
    _id: string;
    name: string;
    last_name: string;
    email: string;
    active: boolean;
    created_at?: string;
    last_login_user_agent?: string;
}

// ============================================================
// Suscripción de la empresa (editar / crear)
// ============================================================

export interface AdminUpdateSubscriptionBody {
    plan_id?: string;
    start_date?: string;
    end_date?: string;
    base_documents?: number;
    extra_documents?: number;
    total_price?: number;
    status?: "active" | "inactive" | "expired";
}

export const adminUpdateSubscription = async (companyId: string, body: AdminUpdateSubscriptionBody): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_SUBSCRIPTION(companyId), {
        method: "PATCH",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar la suscripción");
};

export const adminCreateSubscription = async (companyId: string, plan_id: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_SUBSCRIPTION(companyId), {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify({ plan_id }),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al crear la suscripción");
};

// ============================================================
// Eliminar clientes / items · CRUD subusuarios
// ============================================================

export const adminDeleteClient = async (companyId: string, clientId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_CLIENT_DELETE(companyId, clientId), { method: "DELETE", credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al eliminar el cliente");
};

export const adminDeleteItem = async (companyId: string, itemId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_ITEM_DELETE(companyId, itemId), { method: "DELETE", credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al eliminar el item");
};

export interface AdminUpdateClientBody {
    name?: string;
    email?: string;
    phone?: string;
    doc_type?: string;
    doc_number?: string;
}

export const adminUpdateClient = async (companyId: string, clientId: string, body: AdminUpdateClientBody): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_CLIENT_DELETE(companyId, clientId), { method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el cliente");
};

export interface AdminUpdateItemBody {
    name?: string;
    code?: string;
    price?: number;
    description?: string;
    kind?: "product" | "service";
}

export const adminUpdateItem = async (companyId: string, itemId: string, body: AdminUpdateItemBody): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_ITEM_DELETE(companyId, itemId), { method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el item");
};

export interface AdminCreateSubUserBody {
    name: string;
    last_name: string;
    email: string;
    phone: string;
    doc_type: string;
    doc_number: string;
}

export const adminCreateSubUser = async (companyId: string, body: AdminCreateSubUserBody): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_COMPANY_SUBUSERS_CREATE(companyId), { method: "POST", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al crear el subusuario");
};

export const adminUpdateSubUser = async (userId: string, body: Partial<AdminCreateSubUserBody> & { active?: boolean }): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_SUBUSER_BY_ID(userId), { method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el subusuario");
};

export const adminDeleteSubUser = async (userId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_SUBUSER_BY_ID(userId), { method: "DELETE", credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al eliminar el subusuario");
};

// ============================================================
// Catálogo de planes
// ============================================================

export interface AdminPlan {
    _id: string;
    title: string;
    description: string;
    price: number;
    features: string[];
    include_documents: number;
    price_per_document?: number;
    type: "trial2days" | "1year";
    is_public?: boolean;
}

export interface AdminPlanBody {
    title: string;
    description: string;
    price: number;
    features: string[];
    include_documents: number;
    type: "trial2days" | "1year";
    is_public?: boolean;
}

export const adminListPlans = async (): Promise<AdminPlan[]> => {
    const response = await fetch(API_ROUTES.ADMIN_PLANS, { credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al listar los planes");
    return (payload.data ?? []) as AdminPlan[];
};

export const adminCreatePlan = async (body: AdminPlanBody): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_PLANS, { method: "POST", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al crear el plan");
};

export const adminUpdatePlan = async (planId: string, body: Partial<AdminPlanBody>): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_PLAN_BY_ID(planId), { method: "PATCH", credentials: "include", headers: JSON_HEADERS, body: JSON.stringify(body) });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al actualizar el plan");
};

export const adminDeletePlan = async (planId: string): Promise<void> => {
    const response = await fetch(API_ROUTES.ADMIN_PLAN_BY_ID(planId), { method: "DELETE", credentials: "include", headers: JSON_HEADERS });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al eliminar el plan");
};

export const adminListAdmins = async (): Promise<AdminAccount[]> => {
    const response = await fetch(API_ROUTES.ADMIN_ADMINS, {
        credentials: "include",
        headers: JSON_HEADERS,
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al listar los administradores");
    return (payload.data ?? []) as AdminAccount[];
};

export const adminCreateAdmin = async (body: { name: string; last_name: string; email: string; password: string }): Promise<AdminAccount> => {
    const response = await fetch(API_ROUTES.ADMIN_ADMINS, {
        method: "POST",
        credentials: "include",
        headers: JSON_HEADERS,
        body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.message ?? "Error al crear el administrador");
    return payload.data as AdminAccount;
};

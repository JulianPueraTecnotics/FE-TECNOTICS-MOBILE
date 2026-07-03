import { API_ROUTES } from "../../utils/global";

const json = (method: string, body?: unknown) => ({
    method,
    credentials: "include" as RequestCredentials,
    headers: { "Content-Type": "application/json" },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});

async function parse<T>(r: Response): Promise<T> {
    const data = await r.json();
    if (!r.ok) throw new Error(data.message || "Error en la solicitud");
    return data as T;
}

export interface AccountPair { niif?: string; colgaap?: string }

export interface SupplierItemParams {
    cuenta_gasto_costo?: AccountPair;
    cuenta_por_pagar?: AccountPair;
    cuenta_iva?: AccountPair;
    cuenta_retefuente?: AccountPair;
    retefuente?: number;
    cuenta_reteiva?: AccountPair;
    reteiva?: number;
    cuenta_reteica?: AccountPair;
    reteica?: number;
    /** Categoría de retención del ítem (para agrupar la retefuente por factura). */
    retencion_categoria?: string | null;
}

export interface AiSuggestion {
    cuenta_gasto_costo?: { codigo: string; nombre: string } | null;
    cuenta_por_pagar?: { codigo: string; nombre: string } | null;
    cuenta_iva?: { codigo: string; nombre: string } | null;
    cuenta_retefuente?: { codigo: string; nombre: string } | null;
    retefuente_porcentaje?: number;
    retencion_categoria?: string;
    categoria_detectada?: string;
    razonamiento?: string;
    advertencias?: string[];
    confianza?: "alta" | "media" | "baja";
}

export interface SupplierItem {
    _id: string;
    supplier_id: string;
    supplier_doc: string;
    codigo: string;
    descripcion: string;
    status: "PARAMETRIZADO" | "NO_PARAMETRIZADO";
    params?: SupplierItemParams;
    ai_suggestion?: AiSuggestion | null;
    ai_computed_at?: string | null;
    ai_error?: string | null;
}

export interface SupplierItemsResponse {
    ok: boolean;
    items: SupplierItem[];
    pendientes: number;
    ai_enabled: boolean;
    pagination: { page: number; limit: number; total: number; totalPages: number };
}

export const getSupplierItems = async (
    params: { supplierId?: string; status?: string; search?: string; page?: number; limit?: number } = {},
): Promise<SupplierItemsResponse> => {
    const qs = new URLSearchParams();
    const { limit = 20, ...rest } = params;
    Object.entries({ ...rest, limit }).forEach(([k, v]) => {
        if (v !== undefined && v !== "" && v !== null) qs.set(k, String(v));
    });
    return parse<SupplierItemsResponse>(await fetch(`${API_ROUTES.SUPPLIER_ITEMS}?${qs.toString()}`, json("GET")));
};

export const parametrizeSupplierItem = async (id: string, params: SupplierItemParams): Promise<{ ok: boolean; item: SupplierItem }> =>
    parse(await fetch(API_ROUTES.SUPPLIER_ITEM_BY_ID(id), json("PUT", params)));

export const suggestSupplierItem = async (id: string): Promise<{ ok: boolean; suggestion: AiSuggestion }> =>
    parse(await fetch(API_ROUTES.SUPPLIER_ITEM_SUGGEST(id), json("POST")));

export const applySupplierItemSuggestion = async (id: string): Promise<{ ok: boolean; item: SupplierItem; message: string }> =>
    parse(await fetch(API_ROUTES.SUPPLIER_ITEM_APPLY_SUGGESTION(id), json("POST")));

// ===== Autoaprendizaje (lecciones de parametrización) =====
export interface ParametrizationLesson {
    _id: string;
    supplier_doc: string;
    supplier_name?: string;
    codigo: string;
    descripcion: string;
    cuenta_gasto_costo?: AccountPair;
    cuenta_por_pagar?: AccountPair;
    cuenta_retefuente?: AccountPair;
    retefuente?: number;
    retencion_categoria?: string | null;
    corregido?: boolean;
    veces?: number;
    updatedAt?: string;
}
export interface LessonsResponse {
    ok: boolean;
    lessons: ParametrizationLesson[];
    total_corregidas: number;
    pagination: { page: number; limit: number; total: number; totalPages: number };
}
export const getLessons = async (search = "", page = 1): Promise<LessonsResponse> => {
    const qs = new URLSearchParams({ page: String(page), limit: "20" });
    if (search.trim()) qs.set("search", search.trim());
    return parse<LessonsResponse>(await fetch(`${API_ROUTES.SUPPLIER_ITEM_LESSONS}?${qs.toString()}`, json("GET")));
};
export const deleteLesson = async (id: string): Promise<{ ok: boolean; message: string }> =>
    parse(await fetch(API_ROUTES.SUPPLIER_ITEM_LESSON_BY_ID(id), json("DELETE")));

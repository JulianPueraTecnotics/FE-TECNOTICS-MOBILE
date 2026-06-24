import { API_ROUTES } from "../utils/global";
import type { IExternUser, CreateClientRequest, UpdateClientRequest, ClientsResponse, CreateClientResponse, DeleteResponse } from "../types";

// ============================================
// OBTENER TODOS LOS CLIENTES
// ============================================
export const getAllClients = async (page = 1, limit = 20): Promise<ClientsResponse | null> => {
    const response = await fetch(`${API_ROUTES.CLIENTS}?page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

// ============================================
// BUSCAR CLIENTES
// ============================================
export const searchClients = async (searchTerm: string, page = 1, limit = 20): Promise<ClientsResponse | null> => {
    const response = await fetch(`${API_ROUTES.CLIENTS_SEARCH}?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

// ============================================
// BUSCAR EN LA DIAN (no requiere credenciales). smaid según tipo de documento.
// ============================================
export interface FindDianResponse {
    ReceiverEmail: string;
    ReceiverName: string;
    StatusCode: string;
}

const DOC_TYPE_TO_SMAID: Record<string, string> = {
    Nit: "31",
    Cc: "13",
    Ce: "22",
    Ti: "12",
    Pasaporte: "48",
    Rc: "11",
    Te: "21",
    Psp: "41",
    DiExtranjero: "42",
    Pep: "47",
    NitExtranjero: "50",
    Nuip: "91",
};

export function getSmaidForDocType(doc_type: string): string {
    return DOC_TYPE_TO_SMAID[doc_type] ?? "13";
}

export const findDian = async (nit: string, doc_type: string): Promise<FindDianResponse | null> => {
    const smaid = getSmaidForDocType(doc_type);
    const response = await fetch(API_ROUTES.FIND_DIAN(nit, smaid), {
        method: "GET",
        credentials: "omit",
        headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    if (!response.ok) return null;
    return data;
};

// ============================================
// OBTENER CLIENTE POR ID
// ============================================
export const getClientById = async (clientId: string): Promise<{ ok: boolean; client: IExternUser } | null> => {
    const response = await fetch(API_ROUTES.CLIENT_BY_ID(clientId), {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

// ============================================
// CREAR CLIENTE
// ============================================
export const createClient = async (clientData: CreateClientRequest): Promise<CreateClientResponse | null> => {
    const response = await fetch(API_ROUTES.CLIENTS, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(clientData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

// ============================================
// ACTUALIZAR CLIENTE
// ============================================
export const updateClient = async (clientId: string, clientData: UpdateClientRequest): Promise<CreateClientResponse | null> => {
    const response = await fetch(API_ROUTES.CLIENT_BY_ID(clientId), {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(clientData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

// ============================================
// ELIMINAR CLIENTE
// ============================================
export const deleteClient = async (clientId: string): Promise<DeleteResponse | null> => {
    const response = await fetch(API_ROUTES.CLIENT_BY_ID(clientId), {
        method: "DELETE",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }
    return data;
};

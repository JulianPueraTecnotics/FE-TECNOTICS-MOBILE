import { API_ROUTES } from "../utils/global";
import type { ItemData, CreateItemRequest, UpdateItemRequest, ItemsResponse, CreateItemResponse, DeleteResponse, DeleteMultipleResponse } from "../types";

// ============================================
// OBTENER TODOS LOS ITEMS
// ============================================
export const getAllItems = async (page = 1, limit = 20): Promise<ItemsResponse | null> => {
    const response = await fetch(`${API_ROUTES.ITEMS}?page=${page}&limit=${limit}`, {
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
// ITEMS POR CÓDIGOS (validación duplicados)
// ============================================
export const fetchItemsByCodes = async (codes: string[]): Promise<ItemData[]> => {
    const response = await fetch(API_ROUTES.ITEMS_BY_CODE, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ codes }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message ?? "Error al validar códigos");
    }

    if (Array.isArray(data)) {
        return data;
    }
    if (data && Array.isArray(data.items)) {
        return data.items;
    }
    return [];
};

// ============================================
// BUSCAR ITEMS
// ============================================
export const searchItems = async (searchTerm: string, page = 1, limit = 20): Promise<ItemsResponse | null> => {
    const response = await fetch(`${API_ROUTES.ITEMS_SEARCH}?search=${encodeURIComponent(searchTerm)}&page=${page}&limit=${limit}`, {
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
// OBTENER ITEM POR ID
// ============================================
export const getItemById = async (itemId: string): Promise<{ ok: boolean; item: ItemData } | null> => {
    const response = await fetch(API_ROUTES.ITEM_BY_ID(itemId), {
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
// CREAR ITEM
// ============================================
export const createItem = async (itemData: CreateItemRequest): Promise<CreateItemResponse | null> => {
    const response = await fetch(API_ROUTES.ITEMS, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// ACTUALIZAR ITEM
// ============================================
export const updateItem = async (itemId: string, itemData: UpdateItemRequest): Promise<CreateItemResponse | null> => {
    const response = await fetch(API_ROUTES.ITEM_BY_ID(itemId), {
        method: "PUT",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(itemData),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

// ============================================
// ELIMINAR ITEM
// ============================================
export const deleteItem = async (itemId: string): Promise<DeleteResponse | null> => {
    const response = await fetch(API_ROUTES.ITEM_BY_ID(itemId), {
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

// ============================================
// ELIMINAR MÚLTIPLES ITEMS
// ============================================
export const deleteMultipleItems = async (itemIds: string[]): Promise<DeleteMultipleResponse | null> => {
    const response = await fetch(API_ROUTES.ITEMS_DELETE_MULTIPLE, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ itemIds }),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

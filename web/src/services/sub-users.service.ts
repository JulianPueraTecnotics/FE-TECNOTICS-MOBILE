import { API_ROUTES } from "../utils/global";
import type { CreateSubUserRequest, ISubUser, SubUsersResponse, UpdateSubUserRequest } from "../types";

const parseError = (data: { message?: string; error?: string }) => data.message ?? data.error ?? "Error en la solicitud";

export const getAllSubUsers = async (page = 1, limit = 20): Promise<SubUsersResponse | null> => {
    const response = await fetch(`${API_ROUTES.SUB_USERS}?page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as SubUsersResponse;
};

export const searchSubUsers = async (searchTerm: string, page = 1, limit = 20): Promise<SubUsersResponse | null> => {
    const q = encodeURIComponent(searchTerm.trim());
    const response = await fetch(`${API_ROUTES.SUB_USERS_SEARCH}?q=${q}&page=${page}&limit=${limit}`, {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as SubUsersResponse;
};

export const getSubUserById = async (userId: string): Promise<{ ok: boolean; user: ISubUser } | null> => {
    const response = await fetch(API_ROUTES.SUB_USER_BY_ID(userId), {
        method: "GET",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as { ok: boolean; user: ISubUser };
};

export const createSubUser = async (body: CreateSubUserRequest): Promise<{ success: boolean; message: string } | null> => {
    const response = await fetch(API_ROUTES.SUB_USERS, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as { success: boolean; message: string };
};

export const updateSubUser = async (userId: string, body: UpdateSubUserRequest): Promise<{ ok: boolean; user: ISubUser } | null> => {
    const response = await fetch(API_ROUTES.SUB_USER_BY_ID(userId), {
        method: "PATCH",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as { ok: boolean; user: ISubUser };
};

export const patchSubUserAvatar = async (userId: string, file: File): Promise<{ success: boolean; message: string }> => {
    const fd = new FormData();
    fd.append("avatar", file);
    const response = await fetch(API_ROUTES.SUB_USER_AVATAR(userId), {
        method: "PATCH",
        credentials: "include",
        body: fd,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(parseError(data));
    }
    return data as { success: boolean; message: string };
};

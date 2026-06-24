import { API_ROUTES } from "../utils/global";

// ============================================
// LOGOUT
// ============================================
export const logoutService = async () => {
    const response = await fetch(API_ROUTES.LOGOUT, {
        method: "POST",
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

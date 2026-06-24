import { API_ROUTES } from "../utils/global";

export const validateSessionService = async () => {
    try {
        const response = await fetch(API_ROUTES.VALIDATE_SESSION, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error validando sesión:', error);
        return null;
    }
}

/** Valida una sesión de superadmin (cookie super_admin_token). Devuelve la data o null. */
export const validateAdminSessionService = async () => {
    try {
        const response = await fetch(API_ROUTES.ADMIN_ME, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
            },
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        return data.data;
    } catch (error) {
        console.error('Error validando sesión de admin:', error);
        return null;
    }
}


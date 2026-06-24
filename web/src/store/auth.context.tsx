import { createContext } from "react";

export type AuthUserRole = "company" | "admin" | "user" | "super_admin" | null;

export interface AuthUser {
    /** `company_id` para cuenta empresa; `user_id` para subusuario */
    id: string;
    /** Razón social (empresa) o nombre mostrado (subusuario: `user_name`) */
    razon_social: string;
    role: AuthUserRole;
    avatar: string | null;
    /** Empresa titular (mismo que `id` en cuenta empresa; en subusuario es el tenant) */
    company_id: string;
}

interface AuthContextType {
    user: AuthUser | null;
    setUser: (user: AuthUser | null) => void;
    isLoading: boolean;
}

export const AuthContext = createContext<AuthContextType>({
    user: null,
    setUser: () => {},
    isLoading: true,
});

export type { AuthContextType };

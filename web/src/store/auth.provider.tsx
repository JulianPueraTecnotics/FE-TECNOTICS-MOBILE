import { Platform } from "react-native";
import { useEffect, useState } from "react";
import { AuthContext } from "./auth.context";
import type { AuthContextType, AuthUser } from "./auth.context";
import { hasSessionHint, markSessionHint, validateSessionService } from "./auth.service";
import { PATHS } from "../router/paths.contants";

const PUBLIC_AUTH_PATHS = new Set([
    PATHS.HOME,
    PATHS.LOGIN,
    PATHS.REGISTER,
    PATHS.FORGOT_PASSWORD,
]);

function mapAdminToUser(data: Record<string, unknown>): AuthUser | null {
    const superAdminId = data.super_admin_id as string | undefined;
    if (!superAdminId) return null;
    const name = (data.name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";
    return {
        id: superAdminId,
        razon_social: `${name} ${lastName}`.trim() || "Superadmin",
        role: "super_admin",
        avatar: null,
        company_id: "",
    };
}

function mapMeToUser(data: Record<string, unknown>): AuthUser | null {
    const role = data.role as string | undefined;
    if (role === "super_admin" || data.super_admin_id) {
        return mapAdminToUser(data);
    }
    if (role === "user" || data.user_id) {
        const userId = data.user_id as string | undefined;
        const companyId = data.company_id as string | undefined;
        if (!userId || !companyId) return null;
        return {
            id: userId,
            razon_social: (data.user_name as string) ?? "",
            role: "user",
            avatar: (data.avatar as string | null | undefined) ?? null,
            company_id: companyId,
        };
    }
    const companyId = data.company_id as string | undefined;
    if (!companyId) return null;
    return {
        id: companyId,
        razon_social: (data.razon_social as string) ?? "",
        role: (data.role as AuthUser["role"]) ?? "company",
        avatar: (data.avatar as string | null | undefined) ?? null,
        company_id: companyId,
    };
}

function getPathname(): string {
  if (Platform.OS !== "web" || typeof window === "undefined") return "/";
  return window.location.pathname;
}

function isPublicAuthPath(): boolean {
  const pathname = getPathname();
  return (
    PUBLIC_AUTH_PATHS.has(pathname)
    || pathname.startsWith("/cot/public/")
    || pathname.startsWith("/remision/firmar/")
  );
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AuthContextType["user"]>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        let cancelled = false;

        const validateSession = async () => {
            if (isPublicAuthPath() && !hasSessionHint()) {
                if (!cancelled) setIsLoading(false);
                return;
            }

            const userData = await validateSessionService();
            if (cancelled) return;

            if (userData && typeof userData === "object") {
                const mapped = mapMeToUser(userData as Record<string, unknown>);
                if (mapped) {
                    markSessionHint();
                    setUser(mapped);
                }
            }

            setIsLoading(false);
        };

        validateSession();
        return () => { cancelled = true; };
    }, []);

    return <AuthContext.Provider value={{ user, setUser, isLoading }}>{children}</AuthContext.Provider>;
};

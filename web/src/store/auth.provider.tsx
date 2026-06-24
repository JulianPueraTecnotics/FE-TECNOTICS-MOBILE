import { useEffect, useState } from "react";
import { AuthContext } from "./auth.context";
import type { AuthContextType, AuthUser } from "./auth.context";
import { validateAdminSessionService, validateSessionService } from "./auth.service";

/** Mapea la respuesta de /admin/auth/me a un AuthUser con rol super_admin. */
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

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<AuthContextType["user"]>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const validateSession = async () => {
            const userData = await validateSessionService();

            if (userData && typeof userData === "object") {
                const mapped = mapMeToUser(userData as Record<string, unknown>);
                if (mapped) {
                    setUser(mapped);
                    setIsLoading(false);
                    return;
                }
            }

            // Sin sesión de empresa/subusuario: probar sesión de superadmin.
            const adminData = await validateAdminSessionService();
            if (adminData && typeof adminData === "object") {
                const mappedAdmin = mapAdminToUser(adminData as Record<string, unknown>);
                if (mappedAdmin) setUser(mappedAdmin);
            }

            setIsLoading(false);
        };

        validateSession();
    }, []);

    return <AuthContext.Provider value={{ user, setUser, isLoading }}>{children}</AuthContext.Provider>;
};

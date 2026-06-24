import { API_ROUTES } from "../../../utils/global";

export type LoginAccountType = "company" | "sub_user" | "super_admin";

/** Payload unificado de `POST /auth/signin` y pasos 2FA (campos según cuenta) */
export interface CompanyLoginData {
    need_twofa: boolean;
    account?: LoginAccountType;
    company_id?: string;
    user_id?: string;
    /** Solo cuenta superadmin */
    super_admin_id?: string;
    name?: string;
    last_name?: string;
    email?: string;
    razon_social?: string;
    user_name?: string;
    role?: string;
    avatar?: string | null;
}

/** Sesión tras verify-2fa o respuestas equivalentes */
export type VerifiedSessionPayload =
    | {
          company_id: string;
          razon_social: string;
          role: string;
          avatar?: string | null;
          user_id?: never;
          user_name?: never;
          super_admin_id?: never;
      }
    | {
          user_id: string;
          company_id: string;
          user_name: string;
          role: string;
          avatar?: string | null;
          razon_social?: never;
          super_admin_id?: never;
      }
    | {
          account: "super_admin";
          super_admin_id: string;
          name: string;
          last_name: string;
          email: string;
          role: string;
          company_id?: never;
          user_id?: never;
      };

export const loginService = async ({ email, password }: { email: string; password: string }): Promise<{ message: string; data: CompanyLoginData }> => {
    const response = await fetch(API_ROUTES.LOGIN, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.message ?? "Error al iniciar sesión");
    }

    return {
        message: payload.message ?? "",
        data: payload.data as CompanyLoginData,
    };
};

export const verifyCompanyLogin2fa = async (body: { email: string; code: string } | { user_id: string; code: string }): Promise<VerifiedSessionPayload> => {
    const response = await fetch(API_ROUTES.LOGIN_VERIFY_2FA, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify("user_id" in body ? { user_id: body.user_id, code: body.code } : { email: body.email, code: body.code }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.message ?? "Error al verificar el código");
    }

    return payload.data as VerifiedSessionPayload;
};

export const resendCompanyLogin2fa = async ({
    email,
    password,
}: {
    email: string;
    password: string;
}): Promise<{
    message: string;
    data: { account?: LoginAccountType; company_id?: string; user_id?: string };
}> => {
    const response = await fetch(API_ROUTES.LOGIN_RESEND_2FA, {
        method: "POST",
        credentials: "include",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
    });

    const payload = await response.json();

    if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo reenviar el código");
    }

    return {
        message: payload.message ?? "",
        data: (payload.data ?? {}) as { account?: LoginAccountType; company_id?: string; user_id?: string },
    };
};

import { API_ROUTES } from "../../../utils/global";

const jsonHeaders = {
    "Content-Type": "application/json",
} as const;

export const requestCompanyPasswordReset = async (email: string): Promise<{ message: string }> => {
    const response = await fetch(API_ROUTES.COMPANY_PASSWORD_FORGOT, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify({ email: email.trim() }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo enviar la solicitud");
    }
    return { message: payload.message ?? "" };
};

export const resetCompanyPasswordWithOtp = async (body: {
    email: string;
    /** 6 dígitos; se envía como string para preservar ceros a la izquierda si aplica. */
    otp: string;
    new_password: string;
}): Promise<{ message: string }> => {
    const response = await fetch(API_ROUTES.COMPANY_PASSWORD_RESET, {
        method: "POST",
        credentials: "include",
        headers: jsonHeaders,
        body: JSON.stringify({
            email: body.email.trim(),
            otp: body.otp,
            new_password: body.new_password,
        }),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(payload.message ?? "No se pudo actualizar la contraseña");
    }
    return { message: payload.message ?? "" };
};

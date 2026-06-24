import { API_ROUTES } from "../../../../utils/global";
import type { RegisterUploadFile } from "../../../../services/register.service";

export const updateLogoService = async (logo: RegisterUploadFile) => {
    if (!logo) {
        throw new Error("Logo is required");
    }
    const formData = new FormData();
    formData.append("logo", logo);
    const response = await fetch(API_ROUTES.UPDATE_COMPANY_LOGO, {
        method: "PATCH",
        credentials: "include",
        body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.message);
    }

    return data;
};

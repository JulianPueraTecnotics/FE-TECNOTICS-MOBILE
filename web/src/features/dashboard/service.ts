import { API_ROUTES } from "../../utils/global";

export const getCompanyWidgetSession = async () => {
    const response = await fetch(API_ROUTES.WIDGET_SESSION, {
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

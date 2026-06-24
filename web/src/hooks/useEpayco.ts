// useEpayco.ts
import { useEffect, useState } from "react";

export const useEpayco = () => {
    const [loaded, setLoaded] = useState(false);

    useEffect(() => {
        if (window.ePayco) {
            setLoaded(true);
            return;
        }

        const script = document.createElement("script");
        script.src = "https://checkout.epayco.co/checkout.js";
        script.async = true;

        script.onload = () => setLoaded(true);
        script.onerror = () => {
            console.error("Error cargando ePayco");
        };

        document.body.appendChild(script);
    }, []);

    return loaded;
};

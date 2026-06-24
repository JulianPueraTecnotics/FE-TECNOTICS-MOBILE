// PagoButton.tsx
import { useState } from "react";
import { useEpayco } from "../../hooks/useEpayco";
import { ENV } from "../../utils/global";
import type { Suscription } from "../../types";

/** Días antes de `end_date` en los que se habilita el pago de renovación. */
export const PAY_WINDOW_DAYS = 5;

/**
 * Solo se permite pagar desde {@link PAY_WINDOW_DAYS} días antes del vencimiento
 * (o si la suscripción ya está vencida). Cambiar a `false` para permitir el pago
 * en cualquier momento (útil para pruebas).
 */
const ENFORCE_PAY_WINDOW = true;

/** ¿Estamos dentro de la ventana de pago? (incluye suscripción ya vencida). */
function isWithinPayWindow(endDate: Date | string | undefined): boolean {
    if (!endDate) return false;
    const end = new Date(endDate);
    if (Number.isNaN(end.getTime())) return false;
    const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return days <= PAY_WINDOW_DAYS;
}

interface PagoButtonProps {
    current_subscription: Suscription | null;
    company_name: string;
}

export default function PagoButton({ current_subscription, company_name }: PagoButtonProps) {
    const loaded = useEpayco();
    const [loading, setLoading] = useState(false);

    const withinWindow = isWithinPayWindow(current_subscription?.end_date);
    const allowedByWindow = ENFORCE_PAY_WINDOW ? withinWindow : true;
    const canPay = loaded && !loading && allowedByWindow;

    const handlePay = () => {
        if (!loaded || !window.ePayco) {
            alert("Cargando pasarela de pago...");
            return;
        }

        if (!allowedByWindow) {
            alert(`El pago se habilita ${PAY_WINDOW_DAYS} días antes del vencimiento de la suscripción.`);
            return;
        }

        setLoading(true);

        try {
            const total_documents =
                current_subscription?.total_documents ??
                (current_subscription?.base_documents ?? 0) + (current_subscription?.extra_documents ?? 0);

            const handler = window.ePayco.checkout.configure({
                key: ENV.EPAYCO_PUBLIC_KEY,
                test: true, // ⚠️ cambiar a false en producción
            });

            handler.open({
                name: "Pago suscripción anual Facturación Electrónica | Apps for the World",
                description: `Plan anual: ${total_documents} documentos para ${company_name}`,
                invoice: `INV-${Math.floor(new Date(current_subscription?.end_date ?? new Date()).getTime() / 1000)}`,
                currency: "cop",
                amount: current_subscription?.total_price ?? 0,
                tax_base: "0",
                tax: "0",
                country: "co",
                lang: "es",
                external: "false",

                // URLs IMPORTANTES
                response: "https://tusitio.com/respuesta",
                confirmation: "https://tusitio.com/confirmacion",

                // Datos del cliente (opcional pero recomendado)
                name_billing: company_name,
            });
        } catch (error) {
            console.error("Error al abrir ePayco:", error);
            alert("Error al iniciar el pago");
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            type="button"
            className="btn-primary pago-button"
            onClick={handlePay}
            disabled={!canPay}
        >
            <i className="ri-bank-card-line"></i>
            {loading ? "Procesando..." : "Pagar / Renovar suscripción"}
        </button>
    );
}

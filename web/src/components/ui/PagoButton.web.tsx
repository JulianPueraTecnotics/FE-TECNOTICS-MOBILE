import { useState } from "react";
import { useEpayco } from "../../hooks/useEpayco";
import { ENV, APP_BRAND_NAME } from "../../utils/global";
import type { Suscription } from "../../types";
import { useConfirm } from "../design-system";
import {
  PAY_WINDOW_DAYS,
  buildEpaycoCheckoutPayload,
  canPaySubscription,
  isPaymentAllowedByWindow,
} from "./pagoCheckout.shared";

export { PAY_WINDOW_DAYS };

interface PagoButtonProps {
  current_subscription: Suscription | null;
  company_name: string;
}

export default function PagoButtonWeb({ current_subscription, company_name }: PagoButtonProps) {
  const loaded = useEpayco();
  const { alert } = useConfirm();
  const [loading, setLoading] = useState(false);

  const canPay = canPaySubscription(current_subscription, loaded, loading);

  const handlePay = async () => {
    if (!loaded || !window.ePayco) {
      await alert("Cargando pasarela de pago...");
      return;
    }

    if (!isPaymentAllowedByWindow(current_subscription?.end_date)) {
      await alert(`El pago se habilita ${PAY_WINDOW_DAYS} días antes del vencimiento de la suscripción.`);
      return;
    }

    if (!current_subscription) return;

    setLoading(true);

    try {
      const handler = window.ePayco.checkout.configure({
        key: ENV.EPAYCO_PUBLIC_KEY,
        test: true,
      });

      handler.open(buildEpaycoCheckoutPayload(current_subscription, company_name, APP_BRAND_NAME));
    } catch (error) {
      console.error("Error al abrir ePayco:", error);
      await alert("Error al iniciar el pago");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button type="button" className="btn-primary pago-button" onClick={handlePay} disabled={!canPay}>
      <i className="ri-bank-card-line"></i>
      {loading ? "Procesando..." : "Pagar / Renovar suscripción"}
    </button>
  );
}

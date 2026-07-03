import type { Suscription } from "../../types";

/** Días antes de `end_date` en los que se habilita el pago de renovación. */
export const PAY_WINDOW_DAYS = 5;

/** Solo se permite pagar desde PAY_WINDOW_DAYS días antes del vencimiento (o si ya venció). */
const ENFORCE_PAY_WINDOW = true;

export function isPaymentAllowedByWindow(endDate: Date | string | undefined): boolean {
  return ENFORCE_PAY_WINDOW ? isWithinPayWindow(endDate) : true;
}

export function isWithinPayWindow(endDate: Date | string | undefined): boolean {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  const days = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  return days <= PAY_WINDOW_DAYS;
}

export function canPaySubscription(
  subscription: Suscription | null | undefined,
  epaycoReady: boolean,
  loading: boolean
): boolean {
  const allowedByWindow = isPaymentAllowedByWindow(subscription?.end_date);
  return epaycoReady && !loading && allowedByWindow;
}

export interface EpaycoCheckoutPayload {
  name: string;
  description: string;
  invoice: string;
  currency: string;
  amount: number;
  tax_base: string;
  tax: string;
  country: string;
  lang: string;
  external: string;
  response: string;
  confirmation: string;
  name_billing: string;
}

export function buildEpaycoCheckoutPayload(
  subscription: Suscription,
  companyName: string,
  brandName: string
): EpaycoCheckoutPayload {
  const totalDocuments =
    subscription.total_documents ??
    (subscription.base_documents ?? 0) + (subscription.extra_documents ?? 0);

  return {
    name: `Pago suscripción anual ${brandName}`,
    description: `Plan anual: ${totalDocuments} documentos para ${companyName}`,
    invoice: `INV-${Math.floor(new Date(subscription.end_date ?? new Date()).getTime() / 1000)}`,
    currency: "cop",
    amount: subscription.total_price ?? 0,
    tax_base: "0",
    tax: "0",
    country: "co",
    lang: "es",
    external: "false",
    response: "https://tusitio.com/respuesta",
    confirmation: "https://tusitio.com/confirmacion",
    name_billing: companyName,
  };
}

/** Abre ePayco en el navegador del sistema (nativo, sin WebView). */
export function buildEpaycoCheckoutUrl(
  feUrl: string,
  publicKey: string,
  payload: EpaycoCheckoutPayload
): string {
  const base = feUrl.replace(/\/$/, "");
  const params = new URLSearchParams();
  params.set("key", publicKey);
  params.set("data", encodeURIComponent(JSON.stringify(payload)));
  return `${base}/epayco-checkout.html?${params.toString()}`;
}

export function buildEpaycoCheckoutHtml(publicKey: string, payload: EpaycoCheckoutPayload): string {
  const data = JSON.stringify(payload);
  const key = publicKey.replace(/"/g, "\\\"");
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Pago suscripción</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f8fafc; color: #334155; }
    .box { text-align: center; padding: 24px; }
  </style>
</head>
<body>
  <div class="box"><p>Cargando pasarela de pago…</p></div>
  <script src="https://checkout.epayco.co/checkout.js"><\/script>
  <script>
    (function () {
      var tries = 0;
      function openCheckout() {
        if (!window.ePayco) {
          if (++tries > 80) return;
          setTimeout(openCheckout, 150);
          return;
        }
        var handler = window.ePayco.checkout.configure({ key: "${key}", test: true });
        handler.open(${data});
      }
      openCheckout();
    })();
  <\/script>
</body>
</html>`;
}

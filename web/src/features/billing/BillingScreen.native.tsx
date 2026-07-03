import { BillingComponent, TecnoticsProvider } from "@tecnotics/fe-billing-native";
import type { BillingScreenProps } from "./billing.types";

/**
 * Facturador nativo — mismo contrato que el portal web (@tecnotics/fe-billing),
 * empaquetado para RN vía @tecnotics/fe-billing-native (patrón Terminal_baños).
 */
export default function BillingScreenNative({
  companyId,
  simbaToken,
  feUrl,
  userId,
  theme = "clean",
  isNotaOption,
  isNotaRef,
  recreateFromFacturaId,
  onNotaSubmitted,
}: BillingScreenProps) {
  const is_nota =
    isNotaOption && isNotaRef?.trim()
      ? { option: isNotaOption, ref: isNotaRef.trim() }
      : undefined;

  const company_id = userId ? `${companyId}|${userId}` : companyId;

  return (
    <TecnoticsProvider company_id={company_id} simba_token={simbaToken} fe_url={feUrl}>
      <BillingComponent
        theme={theme}
        is_nota={is_nota}
        onNotaSubmitted={onNotaSubmitted}
        recreate_from_factura_id={recreateFromFacturaId?.trim() || undefined}
      />
    </TecnoticsProvider>
  );
}

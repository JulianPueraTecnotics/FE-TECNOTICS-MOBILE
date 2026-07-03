import { TecnoticsProvider, BillingComponent } from "@tecnotics/fe-billing";
import type { BillingScreenProps } from "./billing.types";

export default function BillingScreenWeb({
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

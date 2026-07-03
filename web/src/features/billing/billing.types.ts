/** Props serializables para BillingScreen (web y DOM). */
export type BillingScreenProps = {
  companyId: string;
  simbaToken: string;
  feUrl: string;
  userId?: string;
  theme?: "classic" | "clean" | "compact";
  isNotaOption?: "credito" | "debito";
  isNotaRef?: string;
  recreateFromFacturaId?: string;
  onNotaSubmitted?: () => void;
};

export type BillingNavigateState = {
  is_nota?: {
    option: "credito" | "debito";
    ref: string;
  };
  recreate_factura_id?: string;
};

export function parseBillingNavigateState(state: unknown): {
  isNota?: BillingNavigateState["is_nota"];
  recreateFacturaId?: string;
} {
  const s = state as BillingNavigateState | null | undefined;
  return {
    isNota: s?.is_nota,
    recreateFacturaId: s?.recreate_factura_id,
  };
}

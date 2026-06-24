import type { ImportResultItem, PurchaseKind } from "./purchases.types";

export const DOC_LABELS: Record<string, string> = {
  "01": "Factura",
  "02": "Nota Débito",
  "03": "Nota Crédito",
  "91": "Nota Crédito",
  "92": "Nota Débito",
  "11": "Doc. Soporte",
};

export function purchaseKindMeta(kind: PurchaseKind) {
  const isExpense = kind === "expense";
  return {
    isExpense,
    title: isExpense ? "Gastos" : "Compras",
    subtitle: isExpense
      ? "Importa y administra tus comprobantes de gasto"
      : "Importa y administra tus facturas de compra de proveedores",
    emptyLabel: isExpense ? "gastos" : "compras",
    importLabel: isExpense ? "gastos" : "compras",
  };
}

export function formatPurchaseTotal(n: number, currency = "COP") {
  return (n || 0).toLocaleString("es-CO", {
    style: "currency",
    currency: currency || "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

export function importResultTone(r: ImportResultItem): "ok" | "dup" | "err" {
  if (r.code === "IMPORTED") return "ok";
  if (r.code === "DUPLICATE") return "dup";
  return "err";
}

export function accountCode(p?: { niif?: string; colgaap?: string }) {
  return p?.niif || p?.colgaap || "—";
}

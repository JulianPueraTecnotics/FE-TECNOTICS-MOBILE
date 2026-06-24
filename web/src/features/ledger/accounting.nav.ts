export type AccountingSection =
  | "comprobantes"
  | "diario"
  | "mayor"
  | "balance"
  | "estados"
  | "saldos"
  | "cierre"
  | "periodos"
  | "dian";

export const ACCOUNTING_NAV: { key: AccountingSection; label: string; group: string }[] = [
  { key: "comprobantes", label: "Comprobantes", group: "Movimientos" },
  { key: "diario", label: "Libro diario", group: "Libros" },
  { key: "mayor", label: "Mayor y balances", group: "Libros" },
  { key: "balance", label: "Balance de prueba", group: "Estados financieros" },
  { key: "estados", label: "Estados financieros", group: "Estados financieros" },
  { key: "saldos", label: "Saldos iniciales", group: "Procesos" },
  { key: "cierre", label: "Cierre anual", group: "Procesos" },
  { key: "periodos", label: "Períodos", group: "Procesos" },
  { key: "dian", label: "DIAN / Exógena", group: "DIAN" },
];

const SECTIONS = new Set<string>(ACCOUNTING_NAV.map((n) => n.key));

export function isAccountingSection(value: string | null): value is AccountingSection {
  return !!value && SECTIONS.has(value);
}

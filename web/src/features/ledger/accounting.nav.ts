export type AccountingSection =
  | "comprobantes"
  | "diario"
  | "mayor"
  | "terceros"
  | "balance"
  | "estados"
  | "notas"
  | "presupuesto"
  | "fiscal"
  | "ajustes"
  | "saldos"
  | "cierre"
  | "periodos"
  | "dian"
  | "ica"
  | "salud";

export const ACCOUNTING_NAV: { key: AccountingSection; label: string; group: string }[] = [
  { key: "comprobantes", label: "Comprobantes", group: "Movimientos" },
  { key: "diario", label: "Libro diario", group: "Libros" },
  { key: "mayor", label: "Mayor y balances", group: "Libros" },
  { key: "terceros", label: "Auxiliar por tercero", group: "Libros" },
  { key: "balance", label: "Balance de prueba", group: "Estados financieros" },
  { key: "estados", label: "Estados financieros", group: "Estados financieros" },
  { key: "notas", label: "Notas EEFF", group: "Estados financieros" },
  { key: "presupuesto", label: "Presupuesto", group: "Estados financieros" },
  { key: "fiscal", label: "Conciliación fiscal", group: "Estados financieros" },
  { key: "ajustes", label: "Ajustes contables", group: "Procesos" },
  { key: "saldos", label: "Saldos iniciales", group: "Procesos" },
  { key: "cierre", label: "Cierre anual", group: "Procesos" },
  { key: "periodos", label: "Períodos", group: "Procesos" },
  { key: "salud", label: "Salud contable", group: "Procesos" },
  { key: "dian", label: "DIAN / Exógena", group: "DIAN" },
  { key: "ica", label: "ReteICA por municipio", group: "DIAN" },
];

const SECTIONS = new Set<string>(ACCOUNTING_NAV.map((n) => n.key));

export function isAccountingSection(value: string | null): value is AccountingSection {
  return !!value && SECTIONS.has(value);
}

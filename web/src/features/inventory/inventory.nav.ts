export type InventorySection =
  | "existencias"
  | "kardex"
  | "valorizado"
  | "bodegas"
  | "ajustes"
  | "traslados"
  | "saldos";

export const INVENTORY_NAV: { key: InventorySection; label: string; icon: keyof typeof ICONS }[] = [
  { key: "existencias", label: "Existencias", icon: "layers-outline" },
  { key: "kardex", label: "Kardex", icon: "list-outline" },
  { key: "valorizado", label: "Valorizado", icon: "cash-outline" },
  { key: "bodegas", label: "Bodegas", icon: "business-outline" },
  { key: "ajustes", label: "Ajustes", icon: "options-outline" },
  { key: "traslados", label: "Traslados", icon: "swap-horizontal-outline" },
  { key: "saldos", label: "Saldos iniciales", icon: "flag-outline" },
];

const ICONS = {
  "layers-outline": true,
  "list-outline": true,
  "cash-outline": true,
  "business-outline": true,
  "options-outline": true,
  "swap-horizontal-outline": true,
  "flag-outline": true,
};

export function isInventorySection(v: string | null): v is InventorySection {
  return INVENTORY_NAV.some((n) => n.key === v);
}

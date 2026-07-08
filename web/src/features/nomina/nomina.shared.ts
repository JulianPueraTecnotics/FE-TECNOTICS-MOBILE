import type { CatalogOption } from "./nomina.constants";

export const formatCOP = (value: number | string): string => {
  const n = typeof value === "string" ? Number(value) : value;
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(
    Number.isFinite(n) ? n : 0
  );
};

export const statusLabel: Record<string, string> = {
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
  PENDING: "Borrador",
  SENT: "Enviada",
};

export const labelFromCatalog = (options: CatalogOption[], value: string) =>
  options.find((o) => o.value === value)?.label ?? value;

export const empleadoNombre = (e: {
  primer_nombre: string;
  otros_nombres?: string;
  primer_apellido: string;
  segundo_apellido?: string;
}) => [e.primer_nombre, e.otros_nombres, e.primer_apellido, e.segundo_apellido].filter(Boolean).join(" ");

export type NominaTab = "empleados" | "nomina" | "pila" | "certificados";

export const NOMINA_TABS: { key: NominaTab; label: string }[] = [
  { key: "empleados", label: "Empleados" },
  { key: "nomina", label: "Nómina" },
  { key: "pila", label: "PILA" },
  { key: "certificados", label: "Certificados" },
];

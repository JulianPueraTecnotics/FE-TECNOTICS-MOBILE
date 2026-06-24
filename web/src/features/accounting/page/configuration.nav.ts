export type ConfigurationSection =
  | "facturacion"
  | "documentos"
  | "eventos"
  | "usuarios"
  | "cuentas"
  | "consecutivos"
  | "centros"
  | "puc"
  | "impuestos"
  | "roles";

export interface ConfigurationNavItem {
  key: ConfigurationSection;
  label: string;
  icon: string;
  group: string;
}

/** Misma estructura que el portal web (`Configuration.web.tsx`). */
export const CONFIGURATION_NAV: ConfigurationNavItem[] = [
  { key: "facturacion", label: "Conf. de facturas", icon: "ri-file-settings-line", group: "Empresa" },
  { key: "documentos", label: "Documentos de cuenta", icon: "ri-folder-3-line", group: "Empresa" },
  { key: "eventos", label: "Consola de eventos", icon: "ri-terminal-box-line", group: "Empresa" },
  { key: "usuarios", label: "Usuarios", icon: "ri-team-line", group: "Seguridad" },
  { key: "roles", label: "Roles y permisos", icon: "ri-shield-keyhole-line", group: "Seguridad" },
  { key: "cuentas", label: "Cuentas por defecto", icon: "ri-bank-line", group: "Contabilidad" },
  { key: "consecutivos", label: "Consecutivos", icon: "ri-list-ordered", group: "Contabilidad" },
  { key: "centros", label: "Centros de costo", icon: "ri-price-tag-3-line", group: "Contabilidad" },
  { key: "puc", label: "Plan de cuentas (PUC)", icon: "ri-book-2-line", group: "Contabilidad" },
  { key: "impuestos", label: "Impuestos y retenciones", icon: "ri-percent-line", group: "Contabilidad" },
];

export const CONFIGURATION_PROFILE_TAB: Partial<Record<ConfigurationSection, string>> = {
  facturacion: "billing-config",
  documentos: "documents",
  eventos: "events",
};

export function isConfigurationSection(value: string | null): value is ConfigurationSection {
  return CONFIGURATION_NAV.some((n) => n.key === value);
}

export type ProfileSection =
  | "general"
  | "contact-bank"
  | "billing-config"
  | "documents"
  | "events";

export const PROFILE_SECTION_LABELS: Record<ProfileSection, string> = {
  general: "Información general",
  "contact-bank": "Contacto y banco",
  "billing-config": "Conf. de facturas",
  documents: "Documentos de cuenta",
  events: "Consola de eventos",
};

/** Mi Perfil en el portal muestra las 5 secciones en el menú lateral. */
export const PROFILE_MODE_SECTIONS: Record<"profile" | "configuration", ProfileSection[]> = {
  profile: ["general", "contact-bank", "billing-config", "documents", "events"],
  configuration: ["billing-config", "documents", "events"],
};

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: "Activa",
  inactive: "Inactiva",
  expired: "Vencida",
};

export function formatCurrencyCOP(value: number | undefined): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(value ?? 0);
}

export function formatLongDate(value: string | Date | undefined): string {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "N/A"
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "long", day: "numeric" });
}

export { PAY_WINDOW_DAYS } from "../../../components/ui/pagoCheckout.shared";

export function daysUntil(endDate: string | Date | undefined): number | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  return Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

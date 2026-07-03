import type { DateRange, PeriodPreset } from "./analytics.service";
import { PERIOD_PRESETS, presetRange } from "./analytics.service";

export type { DateRange };
export { presetRange };

export type AnalyticsTab =
  | "resumen"
  | "ventas"
  | "rentabilidad"
  | "cartera"
  | "tesoreria"
  | "tributario"
  | "scoring"
  | "nomina"
  | "activos";

export const ANALYTICS_TABS: { key: AnalyticsTab; label: string; icon: keyof typeof ICON_MAP }[] = [
  { key: "resumen", label: "Resumen", icon: "grid-outline" },
  { key: "ventas", label: "Ventas", icon: "trending-up-outline" },
  { key: "rentabilidad", label: "Rentabilidad", icon: "stats-chart-outline" },
  { key: "cartera", label: "Cartera", icon: "scale-outline" },
  { key: "tesoreria", label: "Tesorería", icon: "business-outline" },
  { key: "tributario", label: "Tributario", icon: "document-text-outline" },
  { key: "scoring", label: "Scoring", icon: "trophy-outline" },
  { key: "nomina", label: "Nómina", icon: "people-outline" },
  { key: "activos", label: "Activos", icon: "hardware-chip-outline" },
];

const ICON_MAP = {
  "grid-outline": true,
  "trending-up-outline": true,
  "stats-chart-outline": true,
  "scale-outline": true,
  "business-outline": true,
  "document-text-outline": true,
  "trophy-outline": true,
  "people-outline": true,
  "hardware-chip-outline": true,
};

export const DATE_PRESETS: { key: PeriodPreset | "custom"; label: string }[] = [
  ...PERIOD_PRESETS.map((p) => ({ key: p.k, label: p.l })),
  { key: "custom", label: "Personalizado" },
];

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export function tabUsesDateBar(tab: AnalyticsTab) {
  return tab === "resumen" || tab === "rentabilidad" || tab === "tesoreria" || tab === "tributario" || tab === "nomina" || tab === "scoring";
}

export function money(n: number) {
  return `$${(n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 })}`;
}

export function moneyShort(v: number) {
  const a = Math.abs(v);
  const s = a >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : a >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : `${Math.round(v)}`;
  return `$${s}`;
}

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1] ?? "?"} ${String(year).slice(2)}`;
}

export function periodoLabel(p: string) {
  const [y, m] = (p || "").split("-");
  return m ? `${MONTHS[parseInt(m, 10) - 1] ?? m} ${(y || "").slice(2)}` : p;
}

export const ESTADO_FACTURA: Record<string, string> = {
  APPROVED: "Aprobadas",
  PENDING: "Pendientes",
  REJECTED: "Rechazadas",
  SENT: "Enviadas",
  "N/A": "Sin estado",
};

export const METHOD_LABELS: Record<string, string> = {
  efectivo: "Efectivo",
  transferencia: "Transferencia",
  consignacion: "Consignación",
  tarjeta: "Tarjeta",
  cheque: "Cheque",
  otro: "Otro",
};

export const QUOTE_LABELS: Record<string, string> = {
  draft: "Borrador",
  sent: "Enviada",
  accepted: "Aceptada",
  rejected: "Rechazada",
  expired: "Expirada",
  invoiced: "Facturada",
};

export const URGENCY_LABELS: Record<string, { label: string; color: string }> = {
  al_dia: { label: "Al día", color: "#059669" },
  por_vencer: { label: "Por vencer", color: "#0284c7" },
  vencida: { label: "Vencida", color: "#d97706" },
  critica: { label: "Crítica", color: "#dc2626" },
};

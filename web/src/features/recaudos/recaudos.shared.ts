import type { ReceivableInvoice, ReceivableStatus } from "../../types";

export const STATUS_FILTER_OPTIONS = [
  { value: "", label: "Todas por cobrar" },
  { value: "pendiente", label: "Pendientes" },
  { value: "parcial", label: "Abonadas" },
  { value: "vencida", label: "Vencidas" },
  { value: "pagada", label: "Pagadas" },
] as const;

export const RECEIVABLE_STATUS_STYLE: Record<ReceivableStatus, { bg: string; color: string }> = {
  pendiente: { bg: "#fef3c7", color: "#92400e" },
  parcial: { bg: "#dbeafe", color: "#1d4ed8" },
  vencida: { bg: "#fee2e2", color: "#b91c1c" },
  pagada: { bg: "#dcfce7", color: "#15803d" },
};

export function clientKey(i: ReceivableInvoice): string {
  return i.client_doc || i.client_name || "";
}

export function isInvoiceSelectable(
  invoice: ReceivableInvoice,
  lockedClient: string | null,
  selectedIds: Set<string>
): boolean {
  if (invoice.balance <= 0) return false;
  if (selectedIds.has(invoice._id)) return true;
  return lockedClient === null || clientKey(invoice) === lockedClient;
}

export function todayISO(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

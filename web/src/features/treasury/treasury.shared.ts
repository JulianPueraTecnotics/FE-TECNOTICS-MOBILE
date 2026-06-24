export const formatCOP = (n: number, currency = "COP") =>
  (n || 0).toLocaleString("es-CO", { style: "currency", currency: currency || "COP", minimumFractionDigits: 0 });

export const formatDate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

export const BATCH_STATUS: Record<string, { label: string; tone: "ok" | "warn" | "neutral" }> = {
  generated: { label: "Generado", tone: "warn" },
  sent: { label: "Enviado al banco", tone: "warn" },
  reconciled: { label: "Conciliado", tone: "ok" },
};

export const PAYMENT_STATUS: Record<string, string> = {
  pending: "Pendiente",
  in_batch: "En lote",
  partial: "Parcial",
  paid: "Pagado",
};

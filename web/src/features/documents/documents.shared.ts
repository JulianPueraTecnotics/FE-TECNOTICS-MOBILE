import type { Factura } from "../../types";

export function getDocumentTipoInfo(factura: Factura): { label: string; color: string } {
  const tipo = String(factura.Encabezado?.TipoDocElectronico ?? "");
  const tipoFactura = String(factura.Encabezado?.TipoDeFactura?.Value ?? "");
  if (tipo === "01" || tipo === "1") {
    if (tipoFactura === "20") return { label: "Factura POS", color: "#0ea5e9" };
    return { label: "Factura Electrónica", color: "#0284c7" };
  }
  if (tipo === "02" || tipo === "2") return { label: "Nota Débito", color: "#f59e0b" };
  if (tipo === "03" || tipo === "3") return { label: "Nota Crédito", color: "#8b5cf6" };
  if (tipo === "11") return { label: "Documento Soporte", color: "#64748b" };
  return { label: "Documento", color: "#475569" };
}

export function getDocumentStatus(factura: Factura): { label: string; color: string; bg: string } {
  if (factura.systemInfo?.is_draft) {
    return { label: "Borrador", color: "#92400e", bg: "#fef3c7" };
  }
  switch (factura.systemInfo?.facturaStatus) {
    case "APPROVED":
      return { label: "Aprobada", color: "#166534", bg: "#dcfce7" };
    case "PENDING":
      return { label: "Pendiente", color: "#92400e", bg: "#fef3c7" };
    case "REJECTED":
      return { label: "Rechazada", color: "#991b1b", bg: "#fee2e2" };
    case "SENT":
      return { label: "Enviada", color: "#1d4ed8", bg: "#dbeafe" };
    default:
      return {
        label: factura.systemInfo?.facturaStatus ?? "—",
        color: "#475569",
        bg: "#f1f5f9",
      };
  }
}

export function formatDocumentNumber(factura: Factura): string {
  if (factura.Encabezado.NumeroDocumento) {
    return `${factura.Encabezado.PrefijoDocumento}-${factura.Encabezado.NumeroDocumento}`;
  }
  return `${factura.Encabezado.PrefijoDocumento ?? ""} · por asignar`;
}

export function formatDocumentClient(factura: Factura): string {
  return factura.Terceros?.TerceroClienteContable?.Tercero?.NombreTercero?.[0]?.Value || "N/A";
}

export function formatDocumentDate(value: string): string {
  if (!value) return "N/A";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? value
    : d.toLocaleDateString("es-CO", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDocumentPrice(
  price: number,
  currency: string | { Value?: string }
): string {
  const currencyCode = typeof currency === "string" ? currency : currency?.Value || "COP";
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: currencyCode,
    maximumFractionDigits: 0,
  }).format(price ?? 0);
}

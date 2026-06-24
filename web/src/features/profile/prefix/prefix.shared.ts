import { TipoDocElectronico } from "../../../types";
import type { CompanyPrefix, PrefixResolution } from "../page/services/get_profile";

export type TipoDocElectronicoCode = (typeof TipoDocElectronico)[keyof typeof TipoDocElectronico];
export type TipoDeFacturaCode = "01" | "02" | "03" | "04" | "05" | "20" | "92" | "020";

export type CompanyPrefixDraft = Omit<CompanyPrefix, "resolution"> & { resolution: PrefixResolution };

export const TIPO_DOC_ELECTRONICO_OPTIONS: Array<{ value: TipoDocElectronicoCode; label: string }> = [
  { value: TipoDocElectronico.FACTURA, label: "Factura electrónica" },
  { value: TipoDocElectronico.NOTA_DEBITO, label: "Nota débito" },
  { value: TipoDocElectronico.NOTA_CREDITO, label: "Nota crédito" },
  { value: TipoDocElectronico.DOCUMENTO_SOPORTE, label: "Documento soporte" },
];

export const TIPO_FACTURA_OPTIONS: Array<{ value: TipoDeFacturaCode; label: string }> = [
  { value: "01", label: "Factura de venta" },
  { value: "02", label: "Exportación" },
  { value: "03", label: "Contingencia facturador" },
  { value: "04", label: "Contingencia DIAN" },
  { value: "05", label: "Documento soporte" },
  { value: "20", label: "Factura POS" },
  { value: "92", label: "Nota débito" },
  { value: "020", label: "Nota crédito sin referencia" },
];

const TIPO_FACTURA_BY_DOC: Record<TipoDocElectronicoCode, TipoDeFacturaCode[]> = {
  "01": ["01", "02", "03", "04", "20"],
  "11": ["05"],
  "02": ["92"],
  "03": ["020"],
};

export function normalizeTipoDocElectronico(value?: string): TipoDocElectronicoCode {
  const v = String(value ?? "").trim();
  if (v === "1" || v === "01") return "01";
  if (v === "2" || v === "02") return "02";
  if (v === "3" || v === "03") return "03";
  if (v === "11") return "11";
  return "01";
}

export function normalizeTipoFactura(value?: string): TipoDeFacturaCode {
  const v = String(value ?? "").trim();
  if (v === "020") return "020";
  if (v === "92") return "92";
  switch (v) {
    case "01":
      return "01";
    case "02":
      return "02";
    case "03":
      return "03";
    case "04":
      return "04";
    case "05":
      return "05";
    case "20":
      return "20";
    default:
      return "01";
  }
}

export function defaultTipoFacturaForDoc(tipoDoc: TipoDocElectronicoCode): TipoDeFacturaCode {
  const list = TIPO_FACTURA_BY_DOC[tipoDoc];
  return list[0] ?? "01";
}

export function getTipoFacturaOptionsForDoc(tipoDoc: TipoDocElectronicoCode, current?: string) {
  const allowed = TIPO_FACTURA_BY_DOC[tipoDoc] ?? TIPO_FACTURA_BY_DOC["01"];
  const filtered = TIPO_FACTURA_OPTIONS.filter((o) => allowed.includes(o.value));
  const cur = current?.trim();
  if (cur && !filtered.some((o) => o.value === cur)) {
    const extra = TIPO_FACTURA_OPTIONS.find((o) => o.value === cur);
    if (extra) return [extra, ...filtered];
  }
  return filtered.length ? filtered : TIPO_FACTURA_OPTIONS;
}

export function getTipoDocElectronicoLabel(value?: string): string {
  if (!value) return "-";
  const n = normalizeTipoDocElectronico(value);
  return TIPO_DOC_ELECTRONICO_OPTIONS.find((opt) => opt.value === n)?.label ?? value;
}

export function getTipoFacturaLabel(value?: string): string {
  if (!value) return "-";
  const raw = String(value).trim();
  const fromList = TIPO_FACTURA_OPTIONS.find((opt) => opt.value === raw);
  if (fromList) return fromList.label;
  const normalized = normalizeTipoFactura(value);
  return TIPO_FACTURA_OPTIONS.find((opt) => opt.value === normalized)?.label ?? raw;
}

export function normalizeResolution(r: PrefixResolution | undefined): PrefixResolution {
  return {
    init: typeof r?.init === "number" && !Number.isNaN(r.init) ? r.init : 1,
    end: typeof r?.end === "number" && !Number.isNaN(r.end) ? r.end : 999999999,
    locked: Array.isArray(r?.locked) ? r.locked.filter((n) => typeof n === "number" && !Number.isNaN(n)) : undefined,
    status: r?.status === "inactive" ? "inactive" : "active",
    start_date: r?.start_date,
    end_date: r?.end_date,
    tipo_doc_electronico: normalizeTipoDocElectronico(r?.tipo_doc_electronico),
    tipo_factura: normalizeTipoFactura(r?.tipo_factura),
    resolution: r?.resolution ?? "",
  };
}

export function normalizeCompanyPrefix(p: CompanyPrefix): CompanyPrefixDraft {
  return {
    prefix: p.prefix,
    default: p.default,
    is_nomina: p.is_nomina,
    resolution: normalizeResolution(p.resolution),
  };
}

export function parseLockedInput(value: string): number[] | undefined {
  const t = value.trim();
  if (!t) return undefined;
  const nums = t
    .split(/[,;\s]+/)
    .map((x) => parseInt(x.trim(), 10))
    .filter((n) => !Number.isNaN(n));
  return nums.length ? nums : undefined;
}

export function sanitizeLockedInput(value: string): string {
  return value.replace(/[^\d,\s]/g, "");
}

export function toIsoFromDate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const date = new Date(`${trimmed}T00:00:00`);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function formatDateShort(iso?: string): string {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("es-CO");
}

/** Resolución con init/end válidos (equivalente a isResolutionComplete de fe-billing). */
export function isPrefixResolutionComplete(prefix: CompanyPrefix): boolean {
  const r = prefix.resolution;
  const init = r?.init;
  const end = r?.end;
  return (
    typeof init === "number" &&
    Number.isFinite(init) &&
    init >= 1 &&
    typeof end === "number" &&
    Number.isFinite(end) &&
    end >= init
  );
}

export function getPrefixStatus(prefix: CompanyPrefix): "active" | "inactive" {
  return prefix.resolution?.status === "inactive" ? "inactive" : "active";
}

export function filterActiveBillingPrefixes(prefixes: CompanyPrefix[]): CompanyPrefix[] {
  return prefixes.filter((p) => !p.is_nomina && getPrefixStatus(p) !== "inactive");
}

export function isBillingPrefixUsable(prefix: CompanyPrefix): boolean {
  return isPrefixResolutionComplete(prefix);
}

export function hasUsableInvoicePrefixes(prefixes: CompanyPrefix[]): boolean {
  return filterActiveBillingPrefixes(prefixes).some(
    (p) =>
      isBillingPrefixUsable(p) &&
      normalizeTipoDocElectronico(p.resolution?.tipo_doc_electronico) === TipoDocElectronico.FACTURA
  );
}

export function getInvoiceBillingPrefixes(prefixes: CompanyPrefix[]): CompanyPrefix[] {
  return filterActiveBillingPrefixes(prefixes).filter(
    (p) =>
      isBillingPrefixUsable(p) &&
      normalizeTipoDocElectronico(p.resolution?.tipo_doc_electronico) === TipoDocElectronico.FACTURA
  );
}

export function pickDefaultInvoicePrefix(prefixes: CompanyPrefix[]): CompanyPrefix | null {
  const usable = getInvoiceBillingPrefixes(prefixes);
  return usable.find((p) => p.default) ?? usable[0] ?? null;
}

/** Misma condición que fe-billing: sin prefijos no se puede abrir el facturador. */
export function needsPrefixSetup(prefixes: CompanyPrefix[] | undefined | null): boolean {
  return !prefixes || prefixes.length === 0;
}

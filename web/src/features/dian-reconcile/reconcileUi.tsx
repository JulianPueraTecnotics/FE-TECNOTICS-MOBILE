import type { ReconStatus } from "./reconcile.service";

export const formatCOP = (v?: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(v) || 0);

export const fmtDate = (v?: string) => {
    if (!v) return "—";
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

export const STATUS_META: Record<ReconStatus, { label: string; cls: string }> = {
    match_ok: { label: "Concuerda", cls: "dian-badge--ok" },
    mismatch: { label: "Revisar valores", cls: "dian-badge--warning" },
    dian_only: { label: "Falta en local", cls: "dian-badge--info" },
    local_only: { label: "Falta en la DIAN", cls: "dian-badge--danger" },
};

export const STATUS_META_SALES: Record<ReconStatus, { label: string; cls: string }> = {
    match_ok: { label: "Concuerda", cls: "dian-badge--ok" },
    mismatch: { label: "Revisar valores", cls: "dian-badge--warning" },
    dian_only: { label: "Falta en el software", cls: "dian-badge--info" },
    local_only: { label: "Falta en la DIAN", cls: "dian-badge--danger" },
};

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

export const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

export const docLabel = (prefijo?: string, folio?: string) => `${prefijo || ""}${folio ? `-${folio}` : ""}` || "—";

export type SyncJobOption = { _id: string; created: string; filters: { fromDate: string; toDate: string } };

export const syncJobLabel = (j: SyncJobOption) =>
    `${new Date(j.created).toLocaleDateString("es-CO")} · ${j.filters?.fromDate || "?"} → ${j.filters?.toDate || "?"}`;

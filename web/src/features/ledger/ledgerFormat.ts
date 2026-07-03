export const formatMoney = (n: number) =>
    (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

export const formatAmount = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

export const formatDate = (d: string) =>
    d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

export const todayIso = () => new Date().toISOString().slice(0, 10);

export const yearStartIso = () => `${new Date().getFullYear()}-01-01`;

export const monthStartIso = () => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export const thisYear = () => new Date().getFullYear();

export const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

export const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

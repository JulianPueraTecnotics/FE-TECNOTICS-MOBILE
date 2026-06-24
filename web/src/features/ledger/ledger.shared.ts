export const money = (n: number) =>
  (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

export const moneyPlain = (n: number) =>
  (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

export const fdate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

export const yStart = () => `${new Date().getFullYear()}-01-01`;
export const today = () => new Date().toISOString().slice(0, 10);
export const lastYearEnd = () => `${new Date().getFullYear() - 1}-12-31`;
export const thisYear = () => new Date().getFullYear();
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

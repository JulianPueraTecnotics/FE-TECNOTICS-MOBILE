/** Formato de moneda COP estándar del portal (mismo que páginas/tablas). */
export const formatCOP = (value?: number): string =>
    new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

/** Fecha corta es-CO a partir de un ISO; "—" si no hay/ inválida. */
export const formatDateCO = (iso?: string): string => {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

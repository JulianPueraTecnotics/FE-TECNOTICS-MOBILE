import type { QuoteLine, QuoteTotals } from "../../types";

/** Formato de moneda COP estándar del portal (igual que el resto de páginas/tablas). */
export const formatCOP = (value?: number): string =>
    new Intl.NumberFormat("es-CO", {
        style: "currency",
        currency: "COP",
        maximumFractionDigits: 0,
    }).format(Number(value) || 0);

/**
 * Descuento de una línea: admite "10%" (porcentaje sobre la base) o "5000" (valor fijo).
 * Replica el parseo dual del módulo origen (fichas_tecnicas).
 */
export function lineDiscount(line: QuoteLine): number {
    const base = (line.price || 0) * (line.quantity || 0);
    const raw = (line.descuento ?? "0").toString().trim();
    if (!raw) return 0;
    if (raw.includes("%")) {
        const pct = parseFloat(raw.replace("%", "")) || 0;
        return (base * pct) / 100;
    }
    return parseFloat(raw) || 0;
}

/**
 * Calcula los totales de una cotización a partir de sus líneas y el % de retención.
 * IVA por línea = base * (iva%/100). Retención = % sobre (subtotal + iva).
 * (El backend debería recalcular para integridad; esto es la previsualización.)
 */
export function calcQuoteTotals(lines: QuoteLine[], retenciones = 0): QuoteTotals {
    let bruto = 0;
    let descuento = 0;
    let iva = 0;

    for (const line of lines) {
        const base = (line.price || 0) * (line.quantity || 0);
        bruto += base;
        descuento += lineDiscount(line);
        if (line.iva > 0) {
            // El IVA se aplica sobre la base de la línea menos su descuento.
            const baseNeta = Math.max(0, base - lineDiscount(line));
            iva += (baseNeta * line.iva) / 100;
        }
    }

    const subtotal = bruto - descuento;
    const retAmount = (retenciones / 100) * (subtotal + iva);
    const total = subtotal + iva - retAmount;

    return {
        bruto: round2(bruto),
        descuento: round2(descuento),
        subtotal: round2(subtotal),
        iva: round2(iva),
        retenciones,
        total: round2(total),
        valor_letras: numeroALetras(round2(total)),
    };
}

function round2(n: number): number {
    return Math.round((n + Number.EPSILON) * 100) / 100;
}

// ============================================
// Número a letras (M/CTE) — portado y simplificado del origen.
// ============================================
const UNIDADES = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve"];
const DECENAS = ["diez", "veinte", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"];
const ESPECIALES: Record<number, string> = {
    11: "once", 12: "doce", 13: "trece", 14: "catorce", 15: "quince",
    16: "dieciséis", 17: "diecisiete", 18: "dieciocho", 19: "diecinueve",
    21: "veintiuno", 22: "veintidós", 23: "veintitrés", 24: "veinticuatro",
    25: "veinticinco", 26: "veintiséis", 27: "veintisiete", 28: "veintiocho", 29: "veintinueve",
};
const CENTENAS = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos", "ochocientos", "novecientos"];

function convertirGrupo(n: number): string {
    if (n === 0) return "";
    if (n === 100) return "cien";
    let texto = "";
    const c = Math.floor(n / 100);
    const resto = n % 100;
    if (c > 0) texto += CENTENAS[c] + " ";
    if (resto > 0) {
        if (ESPECIALES[resto]) {
            texto += ESPECIALES[resto];
        } else if (resto < 10) {
            texto += UNIDADES[resto];
        } else {
            const d = Math.floor(resto / 10);
            const u = resto % 10;
            texto += DECENAS[d - 1];
            if (u > 0) texto += " y " + UNIDADES[u];
        }
    }
    return texto.trim();
}

function convertirNumero(n: number): string {
    if (n === 0) return "cero";
    let texto = "";
    const millones = Math.floor(n / 1_000_000);
    const miles = Math.floor((n % 1_000_000) / 1000);
    const resto = n % 1000;

    if (millones > 0) {
        texto += millones === 1 ? "un millón " : convertirGrupo(millones) + " millones ";
    }
    if (miles > 0) {
        texto += miles === 1 ? "mil " : convertirGrupo(miles) + " mil ";
    }
    if (resto > 0) {
        texto += convertirGrupo(resto);
    }
    return texto.trim();
}

/** Devuelve el total en letras: "<entero> pesos [con N centavos] M/CTE ******". */
export function numeroALetras(numero: number): string {
    if (!numero || numero <= 0) return "M/CTE ******";
    const [enteroStr, decimalStr] = numero.toString().split(".");
    const entero = parseInt(enteroStr, 10);
    let texto = convertirNumero(entero) + " pesos";
    if (decimalStr) {
        const centavos = parseInt(decimalStr.padEnd(2, "0").slice(0, 2), 10);
        if (centavos > 0) texto += " con " + convertirNumero(centavos) + " centavos";
    }
    return (texto + " M/CTE ******").replace(/\s+/g, " ").trim();
}

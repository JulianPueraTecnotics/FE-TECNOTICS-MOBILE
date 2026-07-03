/** Extrae el nombre del tercero de la descripción de un movimiento bancario. */
export function nombreDeMovimiento(descripcion: string): string {
  let s = String(descripcion || "")
    .replace(/^Extracto banco\s*[·\-:]\s*/i, "")
    .toUpperCase()
    .replace(
      /\b(PAGO INTERBANC(ARIO)?|PAGO DE PROV(EEDOR)?(ES)?|PAGO A|PAGO|ABONO INTERESES|ABONO|TRANSFERENCIA|TRANSF|RECAUDO|CONSIGNACION|CONSIG|DEPOSITO|NOMINA|PSE|ACH|CR[ÉE]DITO|D[ÉE]BITO|REV|REVERSO|COMPRA|RETIRO|NEQUI|DAVIPLATA|MOVIMIENTO|INTERBANC)\b/gi,
      " ",
    )
    .replace(/[0-9]+/g, " ")
    .replace(/[^A-ZÁÉÍÓÚÑ\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(/\b(DE|DEL|LA|LAS|LOS|EL|Y|S\.?A\.?S?|LTDA|E\.?U|S\.?A\.?S\.?)\b\s*$/gi, "").trim();
  return s
    .split(" ")
    .filter((w) => w.length >= 3)
    .slice(0, 3)
    .join(" ")
    .trim();
}

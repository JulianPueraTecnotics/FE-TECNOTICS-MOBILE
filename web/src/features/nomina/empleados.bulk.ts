// Carga masiva de empleados desde CSV/Excel.
// El proyecto no incluye librerías de hojas de cálculo, así que la plantilla es un .csv
// (que Excel abre, edita y guarda nativamente) y el parseo se hace en JS puro.
//
// Cada columna del CSV mapea a un campo de EmpleadoInput. Para los campos de catálogo
// (tipo de documento, tipo de trabajador, etc.) se acepta tanto el código DIAN ("13")
// como la etiqueta legible ("Cédula de ciudadanía"), para que sea cómodo de llenar a mano.

import type { EmpleadoInput, Empleado } from "../../services/empleados.service";
import {
    CLASE_RIESGO_ARL_OPTIONS,
    FORMA_PAGO_OPTIONS,
    METODO_PAGO_OPTIONS,
    SUBTIPO_TRABAJADOR_OPTIONS,
    TIPO_CONTRATO_OPTIONS,
    TIPO_CUENTA_OPTIONS,
    TIPO_DOCUMENTO_OPTIONS,
    TIPO_TRABAJADOR_OPTIONS,
    type CatalogOption,
} from "./nomina.constants";

/** Métodos de pago que requieren datos bancarios (no efectivo/cheque). */
const METODOS_CON_CUENTA = new Set(["42", "47", "48", "49"]);

/** Definición de una columna de la plantilla: encabezado, ayuda y catálogo (si aplica). */
interface ColumnDef {
    /** Encabezado exacto de la columna en el CSV. */
    header: string;
    /** ¿Es obligatorio para crear un empleado nuevo? */
    required: boolean;
    /** Catálogo de valores válidos (acepta código o etiqueta). */
    catalog?: CatalogOption[];
    /** Texto de ejemplo / ayuda mostrado en la fila guía de la plantilla. */
    sample: string;
}

/** Orden y definición de todas las columnas de la plantilla. */
export const COLUMNS: ColumnDef[] = [
    { header: "tipo_documento", required: true, catalog: TIPO_DOCUMENTO_OPTIONS, sample: "Cédula de ciudadanía" },
    { header: "numero_documento", required: true, sample: "1013458804" },
    { header: "primer_nombre", required: true, sample: "Samuel" },
    { header: "otros_nombres", required: false, sample: "" },
    { header: "primer_apellido", required: true, sample: "Vasquez" },
    { header: "segundo_apellido", required: false, sample: "Gonzalez" },
    { header: "email", required: false, sample: "empleado@correo.com" },
    { header: "tipo_trabajador", required: true, catalog: TIPO_TRABAJADOR_OPTIONS, sample: "Dependiente" },
    { header: "subtipo_trabajador", required: false, catalog: SUBTIPO_TRABAJADOR_OPTIONS, sample: "No aplica" },
    { header: "tipo_contrato", required: true, catalog: TIPO_CONTRATO_OPTIONS, sample: "Término indefinido" },
    { header: "sueldo", required: true, sample: "1300000" },
    { header: "fecha_ingreso", required: true, sample: "2025-01-15" },
    { header: "codigo_trabajador", required: false, sample: "" },
    { header: "alto_riesgo_pension", required: false, sample: "NO" },
    { header: "salario_integral", required: false, sample: "NO" },
    { header: "pais", required: false, sample: "169" },
    { header: "departamento_codigo", required: false, sample: "" },
    { header: "ciudad_codigo", required: false, sample: "" },
    { header: "direccion", required: false, sample: "" },
    { header: "forma_pago", required: false, catalog: FORMA_PAGO_OPTIONS, sample: "Contado" },
    { header: "metodo_pago", required: false, catalog: METODO_PAGO_OPTIONS, sample: "Efectivo" },
    { header: "banco", required: false, sample: "" },
    { header: "tipo_cuenta", required: false, catalog: TIPO_CUENTA_OPTIONS, sample: "" },
    { header: "numero_cuenta", required: false, sample: "" },
    { header: "eps", required: false, sample: "" },
    { header: "afp", required: false, sample: "" },
    { header: "fondo_cesantias", required: false, sample: "" },
    { header: "caja_compensacion", required: false, sample: "" },
    { header: "clase_riesgo_arl", required: false, catalog: CLASE_RIESGO_ARL_OPTIONS, sample: "" },
];

const HEADERS = COLUMNS.map((c) => c.header);

/** Resultado del parseo de una fila: el empleado mapeado y sus errores de validación. */
export interface ParsedRow {
    /** Número de fila en el archivo (1-based, sin contar el encabezado). */
    rowNumber: number;
    input: EmpleadoInput;
    errors: string[];
    /** true si el documento ya existe entre los empleados actuales (será actualización). */
    isUpdate: boolean;
    /** Nombre legible para mostrar en la previsualización. */
    displayName: string;
}

// ── Utilidades CSV ──────────────────────────────────────────────────────────

/** Byte Order Mark: lo anteponemos a los CSV para que Excel los abra como UTF-8 (tildes/ñ). */
const BOM = "﻿";

/** Escapa un valor para CSV (comillas dobles si contiene separador, comilla o salto de línea). */
const csvCell = (value: string): string => {
    if (/[",\n;]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
    return value;
};

/**
 * Parsea texto CSV a matriz de celdas. Soporta comillas dobles, comas/punto y coma como
 * separador (autodetecta) y saltos de línea CRLF/LF. No depende de librerías externas.
 */
export const parseCsv = (text: string): string[][] => {
    // Quita BOM si Excel lo agregó.
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
    // Autodetecta el separador en la primera línea: si hay más ';' que ',', usa ';'.
    const firstLine = clean.split(/\r?\n/, 1)[0] ?? "";
    const delimiter = (firstLine.split(";").length - 1) > (firstLine.split(",").length - 1) ? ";" : ",";

    const rows: string[][] = [];
    let row: string[] = [];
    let cell = "";
    let inQuotes = false;

    for (let i = 0; i < clean.length; i++) {
        const ch = clean[i];
        if (inQuotes) {
            if (ch === '"') {
                if (clean[i + 1] === '"') { cell += '"'; i++; }
                else inQuotes = false;
            } else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"') { inQuotes = true; continue; }
        if (ch === delimiter) { row.push(cell); cell = ""; continue; }
        if (ch === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; continue; }
        if (ch === "\r") continue;
        cell += ch;
    }
    // Última celda/fila pendiente.
    if (cell.length > 0 || row.length > 0) { row.push(cell); rows.push(row); }
    return rows;
};

// ── Plantilla descargable ────────────────────────────────────────────────────

/**
 * Genera el contenido CSV de la plantilla:
 *  - Fila 1: encabezados (nombres de columna exactos que espera el importador).
 *  - Fila 2: fila guía con ejemplos / valores aceptados (eliminar antes de cargar).
 * Incluye BOM para que Excel reconozca UTF-8 (tildes y ñ correctas).
 */
export const buildTemplateCsv = (): string => {
    const header = HEADERS.map(csvCell).join(",");
    const guide = COLUMNS.map((c) => csvCell(c.sample)).join(",");
    return BOM + [header, guide].join("\r\n") + "\r\n";
};

/** Texto de la hoja de instrucciones (acompaña a la plantilla como segundo archivo opcional). */
export const buildInstructionsCsv = (): string => {
    const rows: string[][] = [["Columna", "Obligatorio", "Descripción / valores aceptados"]];
    for (const c of COLUMNS) {
        let descr = c.sample ? `Ejemplo: ${c.sample}` : "Opcional";
        if (c.catalog) {
            descr = "Acepta el texto o el código. Opciones: " + c.catalog.map((o) => `${o.label} (${o.value})`).join(" · ");
        }
        if (c.header === "fecha_ingreso") descr = "Formato AAAA-MM-DD. Ejemplo: 2025-01-15";
        if (c.header === "sueldo") descr = "Solo números, sin puntos ni símbolos. Ejemplo: 1300000";
        if (c.header === "alto_riesgo_pension" || c.header === "salario_integral") descr = "SI / NO (por defecto NO)";
        if (c.header === "numero_documento") descr = "Solo números. Si ya existe, se ACTUALIZA el empleado.";
        rows.push([c.header, c.required ? "Sí" : "No", descr]);
    }
    const body = rows.map((r) => r.map(csvCell).join(",")).join("\r\n");
    return BOM + body + "\r\n";
};

/** Dispara la descarga de un archivo de texto en el navegador. */
export const downloadTextFile = (filename: string, content: string, mime = "text/csv;charset=utf-8") => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// ── Mapeo y validación de filas ───────────────────────────────────────────────

/** Resuelve un valor de catálogo: acepta código exacto o etiqueta (ignora may/min y tildes). */
const resolveCatalog = (catalog: CatalogOption[], raw: string): string | null => {
    const value = raw.trim();
    if (!value) return "";
    const byCode = catalog.find((o) => o.value.toLowerCase() === value.toLowerCase());
    if (byCode) return byCode.value;
    const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    const byLabel = catalog.find((o) => norm(o.label) === norm(value));
    if (byLabel) return byLabel.value;
    return null;
};

/** Convierte SI/NO/true/1 a booleano. */
const toBool = (raw: string): boolean => {
    const v = raw.trim().toLowerCase();
    return v === "si" || v === "sí" || v === "true" || v === "1" || v === "x";
};

/** Normaliza la fila guía para poder ignorarla automáticamente. */
const isGuideRow = (record: Record<string, string>): boolean => {
    // La fila guía trae los samples textuales de catálogo ("Cédula de ciudadanía", "Dependiente"…).
    return record.numero_documento?.trim() === "1013458804" && record.primer_nombre?.trim() === "Samuel";
};

/**
 * Convierte una matriz CSV (con encabezado) en filas parseadas y validadas.
 * @param matrix       matriz devuelta por parseCsv
 * @param existingDocs documentos ya registrados (numero_documento) → marca filas como actualización
 */
export const mapRows = (matrix: string[][], existingDocs: Set<string>): { rows: ParsedRow[]; headerError: string | null } => {
    if (matrix.length === 0) return { rows: [], headerError: "El archivo está vacío." };

    const rawHeaders = matrix[0].map((h) => h.trim().toLowerCase());
    // Verifica que estén las columnas obligatorias.
    const missing = COLUMNS.filter((c) => c.required && !rawHeaders.includes(c.header)).map((c) => c.header);
    if (missing.length) {
        return { rows: [], headerError: `Faltan columnas obligatorias en el encabezado: ${missing.join(", ")}. Descarga la plantilla para ver el formato correcto.` };
    }
    // Índice de cada columna conocida dentro del encabezado del archivo.
    const colIndex: Record<string, number> = {};
    for (const c of COLUMNS) colIndex[c.header] = rawHeaders.indexOf(c.header);

    const rows: ParsedRow[] = [];
    /** Documentos ya vistos dentro del mismo archivo, para marcar duplicados. */
    const seenDocs = new Set<string>();
    for (let i = 1; i < matrix.length; i++) {
        const cells = matrix[i];
        // Salta filas totalmente vacías.
        if (!cells.some((c) => c.trim() !== "")) continue;

        const get = (header: string): string => {
            const idx = colIndex[header];
            return idx >= 0 ? (cells[idx] ?? "").trim() : "";
        };

        const record: Record<string, string> = {};
        for (const c of COLUMNS) record[c.header] = get(c.header);

        // Ignora la fila guía de la plantilla si el usuario la dejó.
        if (isGuideRow(record)) continue;

        const errors: string[] = [];

        // Catálogos.
        const resolveOrError = (header: string, catalog: CatalogOption[], fallback: string): string => {
            const resolved = resolveCatalog(catalog, record[header]);
            if (resolved === null) {
                errors.push(`${header}: valor no válido ("${record[header]}")`);
                return fallback;
            }
            return resolved || fallback;
        };

        const tipo_documento = resolveOrError("tipo_documento", TIPO_DOCUMENTO_OPTIONS, "13");
        const tipo_trabajador = resolveOrError("tipo_trabajador", TIPO_TRABAJADOR_OPTIONS, "01");
        const subtipo_trabajador = resolveOrError("subtipo_trabajador", SUBTIPO_TRABAJADOR_OPTIONS, "00") || "00";
        const tipo_contrato = resolveOrError("tipo_contrato", TIPO_CONTRATO_OPTIONS, "1");
        const forma = resolveOrError("forma_pago", FORMA_PAGO_OPTIONS, "1") || "1";
        const metodo = resolveOrError("metodo_pago", METODO_PAGO_OPTIONS, "10") || "10";
        const tipo_cuenta = resolveOrError("tipo_cuenta", TIPO_CUENTA_OPTIONS, "");
        const clase_riesgo_arl = resolveOrError("clase_riesgo_arl", CLASE_RIESGO_ARL_OPTIONS, "");

        // Obligatorios.
        const numero_documento = record.numero_documento.replace(/\s/g, "");
        const primer_nombre = record.primer_nombre;
        const primer_apellido = record.primer_apellido;
        if (!numero_documento) errors.push("numero_documento es obligatorio");
        else if (seenDocs.has(numero_documento)) errors.push(`Documento duplicado dentro del archivo (${numero_documento})`);
        else seenDocs.add(numero_documento);
        if (!primer_nombre) errors.push("primer_nombre es obligatorio");
        if (!primer_apellido) errors.push("primer_apellido es obligatorio");

        // Sueldo.
        const sueldo = Number(record.sueldo.replace(/[^\d.]/g, ""));
        if (!sueldo || sueldo <= 0) errors.push("sueldo debe ser un número mayor a 0");

        // Fecha de ingreso (AAAA-MM-DD).
        const fecha_ingreso = record.fecha_ingreso.trim();
        if (!fecha_ingreso) errors.push("fecha_ingreso es obligatoria");
        else if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha_ingreso)) errors.push("fecha_ingreso debe tener formato AAAA-MM-DD");

        // Cuenta bancaria si el método la requiere.
        const numero_cuenta = record.numero_cuenta.trim();
        if (METODOS_CON_CUENTA.has(metodo) && !numero_cuenta) {
            errors.push("numero_cuenta es obligatorio para el método de pago indicado");
        }

        const input: EmpleadoInput = {
            tipo_documento,
            numero_documento,
            primer_nombre,
            otros_nombres: record.otros_nombres || "",
            primer_apellido,
            segundo_apellido: record.segundo_apellido || "",
            email: record.email || "",
            tipo_trabajador,
            subtipo_trabajador,
            tipo_contrato,
            alto_riesgo_pension: toBool(record.alto_riesgo_pension),
            salario_integral: toBool(record.salario_integral),
            sueldo: Number.isFinite(sueldo) ? sueldo : 0,
            fecha_ingreso,
            codigo_trabajador: record.codigo_trabajador || "",
            lugar_trabajo: {
                pais: record.pais || "169",
                departamento_codigo: record.departamento_codigo || "",
                ciudad_codigo: record.ciudad_codigo || "",
                direccion: record.direccion || "",
            },
            datos_pago: {
                forma,
                metodo,
                banco: record.banco || "",
                tipo_cuenta,
                numero_cuenta,
            },
            seguridad_social: {
                eps: record.eps || "",
                afp: record.afp || "",
                fondo_cesantias: record.fondo_cesantias || "",
                caja_compensacion: record.caja_compensacion || "",
                clase_riesgo_arl,
            },
        };

        rows.push({
            rowNumber: i,
            input,
            errors,
            isUpdate: existingDocs.has(numero_documento),
            displayName: `${primer_nombre} ${primer_apellido}`.trim() || numero_documento || `Fila ${i}`,
        });
    }

    return { rows, headerError: null };
};

/** Helper para que la página marque cuáles documentos ya existen. */
export const buildExistingDocsSet = (empleados: Empleado[]): Set<string> => new Set(empleados.map((e) => e.numero_documento));

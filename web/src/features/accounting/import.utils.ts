import * as XLSX from "xlsx";

/**
 * Utilidades de importación/plantilla para las secciones de configuración contable.
 * Soporta Excel (.xlsx) y CSV con la misma API (SheetJS).
 */

export interface ColumnDef {
    /** Clave interna del campo. */
    key: string;
    /** Encabezado mostrado en la plantilla. */
    header: string;
    /** Ejemplo en la fila guía. */
    sample?: string;
}

/** Dispara la descarga de un Blob en el navegador. */
function download(filename: string, blob: Blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/** Genera y descarga una plantilla XLSX con encabezados + una fila de ejemplo. */
export function downloadTemplateXlsx(filename: string, columns: ColumnDef[], sheetName = "Plantilla") {
    const header = columns.map((c) => c.header);
    const guide = columns.map((c) => c.sample ?? "");
    const ws = XLSX.utils.aoa_to_sheet([header, guide]);
    ws["!cols"] = columns.map((c) => ({ wch: Math.max(c.header.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/** Genera y descarga una plantilla XLSX con encabezados + varias filas de ejemplo. */
export function downloadRowsXlsx(filename: string, headers: string[], rows: string[][], sheetName = "Plantilla") {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = headers.map((h) => ({ wch: Math.max(h.length + 2, 16) }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    download(filename, new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
}

/** Genera y descarga una plantilla CSV con encabezados + varias filas. */
export function downloadRowsCsv(filename: string, headers: string[], rows: string[][]) {
    const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [headers, ...rows].map((r) => r.map(cell).join(","));
    const content = "﻿" + lines.join("\r\n") + "\r\n";
    download(filename, new Blob([content], { type: "text/csv;charset=utf-8" }));
}

/** Genera y descarga una plantilla CSV (con BOM para que Excel respete tildes). */
export function downloadTemplateCsv(filename: string, columns: ColumnDef[]) {
    const cell = (v: string) => (/[",\n;]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const header = columns.map((c) => cell(c.header)).join(",");
    const guide = columns.map((c) => cell(c.sample ?? "")).join(",");
    const content = "﻿" + [header, guide].join("\r\n") + "\r\n";
    download(filename, new Blob([content], { type: "text/csv;charset=utf-8" }));
}

/**
 * Lee un archivo (.xlsx/.xls/.csv) y devuelve todas las celdas de la PRIMERA columna
 * (como texto, sin filas vacías). Útil para layouts de una sola columna (ej. el PUC
 * de ejemplo, que trae cabecera de empresa + 'Código' + códigos).
 */
export async function readFirstColumn(file: File): Promise<string[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
    return matrix.map((row) => String((row as unknown[])[0] ?? "").trim()).filter((v) => v !== "");
}

/**
 * Lee un archivo (.xlsx, .xls o .csv) y devuelve filas como objetos {clave: valor},
 * mapeando los encabezados del archivo a las claves definidas en `columns`.
 * Reconoce el encabezado por su texto (header) ignorando mayúsculas/acentos.
 */
export async function readSpreadsheet(file: File, columns: ColumnDef[]): Promise<Record<string, string>[]> {
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
    if (!matrix.length) return [];

    const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
    const rawHeaders = (matrix[0] as unknown[]).map((h) => norm(h));
    // Índice de cada columna conocida (por header o por key).
    const colIndex: Record<string, number> = {};
    for (const c of columns) {
        let idx = rawHeaders.indexOf(norm(c.header));
        if (idx < 0) idx = rawHeaders.indexOf(norm(c.key));
        colIndex[c.key] = idx;
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i++) {
        const cells = matrix[i] as unknown[];
        if (!cells || !cells.some((c) => String(c ?? "").trim() !== "")) continue;
        const rec: Record<string, string> = {};
        for (const c of columns) {
            const idx = colIndex[c.key];
            rec[c.key] = idx >= 0 ? String(cells[idx] ?? "").trim() : "";
        }
        rows.push(rec);
    }
    return rows;
}

/** Igual que readSpreadsheet pero desde una URI local (Expo DocumentPicker). */
export async function readSpreadsheetFromUri(uri: string, columns: ColumnDef[]): Promise<Record<string, string>[]> {
    const res = await fetch(uri);
    const buffer = await res.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) return [];
    const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: "", raw: false });
    if (!matrix.length) return [];

    const norm = (s: unknown) => String(s ?? "").normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
    const rawHeaders = (matrix[0] as unknown[]).map((h) => norm(h));
    const colIndex: Record<string, number> = {};
    for (const c of columns) {
        let idx = rawHeaders.indexOf(norm(c.header));
        if (idx < 0) idx = rawHeaders.indexOf(norm(c.key));
        colIndex[c.key] = idx;
    }

    const rows: Record<string, string>[] = [];
    for (let i = 1; i < matrix.length; i++) {
        const cells = matrix[i] as unknown[];
        if (!cells || !cells.some((cell) => String(cell ?? "").trim() !== "")) continue;
        const rec: Record<string, string> = {};
        for (const c of columns) {
            const idx = colIndex[c.key];
            rec[c.key] = idx >= 0 ? String(cells[idx] ?? "").trim() : "";
        }
        rows.push(rec);
    }
    return rows;
}

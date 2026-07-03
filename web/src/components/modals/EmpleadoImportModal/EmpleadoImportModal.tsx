import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { createEmpleado, getAllEmpleadosFull, updateEmpleado, type Empleado } from "../../../services/empleados.service";
import { AppDrawer, FilterField } from "../../../components/design-system";
import {
    buildExistingDocsSet,
    buildInstructionsCsv,
    buildTemplateCsv,
    downloadTextFile,
    mapRows,
    parseCsv,
    type ParsedRow,
} from "../../../features/nomina/empleados.bulk";
import "../nomina-modals.css";
import "./EmpleadoImportModal.css";

interface EmpleadoImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    /** Se llama cuando se importó al menos un empleado correctamente (refresca el listado). */
    onSuccess: () => void;
}

/** Resultado de procesar una fila en el servidor. */
interface ImportResult {
    row: ParsedRow;
    ok: boolean;
    message?: string;
}

const EmpleadoImportModal: React.FC<EmpleadoImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
    const [fileName, setFileName] = useState<string>("");
    /** Matriz cruda del CSV (con encabezado). De aquí se derivan las filas reactivamente. */
    const [matrix, setMatrix] = useState<string[][] | null>(null);
    const [headerError, setHeaderError] = useState<string | null>(null);
    const [parsing, setParsing] = useState(false);
    const [importing, setImporting] = useState(false);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState<ImportResult[] | null>(null);
    /** Listado completo de empleados (todas las páginas) para detectar crear vs. actualizar. */
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [loadingEmpleados, setLoadingEmpleados] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Al abrir, carga todos los empleados existentes para clasificar las filas correctamente.
    useEffect(() => {
        if (!isOpen) return;
        let ignore = false;
        setLoadingEmpleados(true);
        (async () => {
            try {
                const all = await getAllEmpleadosFull();
                if (!ignore) setEmpleados(all);
            } catch {
                if (!ignore) setEmpleados([]);
            } finally {
                if (!ignore) setLoadingEmpleados(false);
            }
        })();
        return () => { ignore = true; };
    }, [isOpen]);

    // Filas derivadas de la matriz + empleados existentes (se reclasifican si la lista llega después).
    const { rows, derivedHeaderError } = useMemo(() => {
        if (!matrix) return { rows: [] as ParsedRow[], derivedHeaderError: null as string | null };
        const existing = buildExistingDocsSet(empleados);
        const { rows: parsed, headerError: hErr } = mapRows(matrix, existing);
        let err = hErr;
        if (!err && parsed.length === 0) {
            err = "No se encontraron filas con datos. Revisa que llenaste la plantilla bajo los encabezados.";
        }
        return { rows: parsed, derivedHeaderError: err };
    }, [matrix, empleados]);

    const effectiveHeaderError = headerError ?? derivedHeaderError;

    const reset = () => {
        setFileName("");
        setMatrix(null);
        setHeaderError(null);
        setResults(null);
        setProgress({ done: 0, total: 0 });
        if (inputRef.current) inputRef.current.value = "";
    };

    const handleClose = () => {
        if (importing) return;
        reset();
        onClose();
    };

    const handleDownloadTemplate = () => {
        downloadTextFile("plantilla_empleados.csv", buildTemplateCsv());
        downloadTextFile("instructivo_empleados.csv", buildInstructionsCsv());
        toast.success("Plantilla descargada. Llénala y vuelve a subirla aquí.");
    };

    const handleFile = async (file: File) => {
        setResults(null);
        setHeaderError(null);
        const lower = file.name.toLowerCase();
        if (lower.endsWith(".xlsx") || lower.endsWith(".xls")) {
            setHeaderError(
                'El archivo es un Excel (.xlsx). Ábrelo en Excel y guárdalo como "CSV UTF-8 (delimitado por comas)", luego súbelo aquí.',
            );
            setMatrix(null);
            setFileName(file.name);
            return;
        }
        setParsing(true);
        setFileName(file.name);
        try {
            const text = await file.text();
            setMatrix(parseCsv(text));
        } catch {
            setHeaderError("No se pudo leer el archivo. Asegúrate de que sea un CSV válido.");
            setMatrix(null);
        } finally {
            setParsing(false);
        }
    };

    const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
    };

    const validRows = rows.filter((r) => r.errors.length === 0);
    const invalidCount = rows.length - validRows.length;
    const newCount = validRows.filter((r) => !r.isUpdate).length;
    const updateCount = validRows.filter((r) => r.isUpdate).length;

    const handleImport = async () => {
        if (validRows.length === 0) {
            toast.error("No hay filas válidas para importar.");
            return;
        }
        setImporting(true);
        setProgress({ done: 0, total: validRows.length });
        const out: ImportResult[] = [];
        // Secuencial para no saturar el backend y poder mostrar el progreso fila a fila.
        for (const row of validRows) {
            try {
                if (row.isUpdate) {
                    const target = empleados.find((e) => e.numero_documento === row.input.numero_documento);
                    if (target) await updateEmpleado(target._id, row.input);
                    else await createEmpleado(row.input);
                } else {
                    await createEmpleado(row.input);
                }
                out.push({ row, ok: true });
            } catch (error) {
                out.push({ row, ok: false, message: error instanceof Error ? error.message : "Error desconocido" });
            }
            setProgress((p) => ({ ...p, done: p.done + 1 }));
        }
        setResults(out);
        setImporting(false);

        const okCount = out.filter((r) => r.ok).length;
        const failCount = out.length - okCount;
        if (okCount > 0) onSuccess();
        if (failCount === 0) toast.success(`${okCount} empleado(s) importado(s) correctamente.`);
        else if (okCount === 0) toast.error("No se pudo importar ningún empleado. Revisa los errores.");
        else toast(`${okCount} importado(s), ${failCount} con error.`, { icon: "⚠️" });
    };

    if (!isOpen) return null;

    return (
        <AppDrawer
            title="Importar empleados"
            titleIcon="ri-upload-2-line"
            onClose={handleClose}
            closeDisabled={importing}
            ariaLabelledBy="import-modal-title"
            footer={
                results ? (
                    <button type="button" className="export-cancel" onClick={handleClose}>
                        Cerrar
                    </button>
                ) : (
                    <>
                        <button type="button" className="export-cancel" onClick={handleClose} disabled={importing}>
                            Cancelar
                        </button>
                        <button type="button" className="export-submit" onClick={handleImport} disabled={importing || loadingEmpleados || validRows.length === 0}>
                            {importing ? (
                                <>
                                    <i className="ri-loader-4-line rotating" aria-hidden /> Importando {progress.done}/{progress.total}…
                                </>
                            ) : (
                                <>
                                    <i className="ri-upload-cloud-line" aria-hidden /> Importar {validRows.length || ""} empleado{validRows.length !== 1 ? "s" : ""}
                                </>
                            )}
                        </button>
                    </>
                )
            }
        >
                <div>
                    {/* Paso 1 — plantilla */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-download-2-line"></i> 1. Descarga la plantilla</h3>
                        <div className="info-box">
                            <i className="ri-information-line"></i>
                            <p>
                                Descarga la plantilla, ábrela en Excel o Google Sheets y completa una fila por empleado.
                                En los campos con lista (tipo de documento, contrato, etc.) puedes escribir el texto
                                o el código. Si el número de documento ya existe, ese empleado se <strong>actualizará</strong>.
                                Borra la fila de ejemplo antes de subir el archivo y guárdalo como <strong>CSV</strong>.
                            </p>
                        </div>
                        <button type="button" className="btn-secondary import-template-btn" onClick={handleDownloadTemplate}>
                            <i className="ri-file-download-line"></i> Descargar plantilla CSV + instructivo
                        </button>
                    </div>

                    {/* Paso 2 — archivo */}
                    <div className="nomina-section">
                        <h3 className="nomina-section-title"><i className="ri-upload-2-line"></i> 2. Sube el archivo</h3>
                        <div className="led-form-grid">
                        <FilterField className="led-form-grid__full" label="Archivo CSV" htmlFor="empleado-import-file" icon="ri-file-upload-line">
                            <div
                                className="import-dropzone"
                                role="button"
                                tabIndex={0}
                                onClick={() => inputRef.current?.click()}
                                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files?.[0];
                                    if (file) void handleFile(file);
                                }}
                            >
                                <i className="ri-file-upload-line"></i>
                                <p>{fileName ? fileName : "Haz clic o arrastra aquí tu archivo CSV"}</p>
                                <span className="field-hint">Formatos aceptados: .csv (UTF-8)</span>
                            </div>
                            <input
                                ref={inputRef}
                                id="empleado-import-file"
                                type="file"
                                accept=".csv,text/csv,.xlsx,.xls"
                                onChange={onInputChange}
                                style={{ display: "none" }}
                            />
                        </FilterField>
                        </div>
                    </div>

                    {(parsing || loadingEmpleados) && (
                        <p className="field-hint">
                            <i className="ri-loader-4-line rotating"></i> {parsing ? "Procesando archivo..." : "Cargando empleados existentes..."}
                        </p>
                    )}

                    {effectiveHeaderError && (
                        <div className="info-box import-error-box">
                            <i className="ri-error-warning-line"></i>
                            <p>{effectiveHeaderError}</p>
                        </div>
                    )}

                    {/* Paso 3 — previsualización */}
                    {!results && rows.length > 0 && (
                        <div className="nomina-section">
                            <h3 className="nomina-section-title">
                                <i className="ri-table-line"></i> 3. Revisa ({rows.length} fila{rows.length !== 1 ? "s" : ""})
                            </h3>
                            <div className="import-summary">
                                <span className="import-chip ok"><i className="ri-add-circle-line"></i> {newCount} nuevo(s)</span>
                                <span className="import-chip upd"><i className="ri-refresh-line"></i> {updateCount} a actualizar</span>
                                {invalidCount > 0 && <span className="import-chip err"><i className="ri-close-circle-line"></i> {invalidCount} con error</span>}
                            </div>
                            <div className="import-preview">
                                {rows.map((r) => (
                                    <div key={r.rowNumber} className={`import-preview-row ${r.errors.length ? "has-error" : ""}`}>
                                        <div className="import-preview-main">
                                            <i className={r.errors.length ? "ri-close-circle-line err-icon" : r.isUpdate ? "ri-refresh-line upd-icon" : "ri-checkbox-circle-line ok-icon"}></i>
                                            <div>
                                                <strong>{r.displayName}</strong>
                                                <span className="import-preview-doc">
                                                    Doc. {r.input.numero_documento || "—"}
                                                    {r.errors.length === 0 && (r.isUpdate ? " · se actualizará" : " · nuevo")}
                                                </span>
                                            </div>
                                        </div>
                                        {r.errors.length > 0 && (
                                            <ul className="import-preview-errors">
                                                {r.errors.map((err, idx) => <li key={idx}>{err}</li>)}
                                            </ul>
                                        )}
                                    </div>
                                ))}
                            </div>
                            {invalidCount > 0 && (
                                <p className="field-hint">Las filas con error se omitirán. Corrígelas en el archivo y vuelve a subirlo si quieres incluirlas.</p>
                            )}
                        </div>
                    )}

                    {/* Resultados de la importación */}
                    {results && (
                        <div className="nomina-section">
                            <h3 className="nomina-section-title"><i className="ri-checkbox-circle-line"></i> Resultado</h3>
                            <div className="lote-result-list">
                                {results.map((res, idx) => (
                                    <div key={idx} className={`lote-result-row ${res.ok ? "ok" : "fail"}`}>
                                        <i className={res.ok ? "ri-checkbox-circle-line" : "ri-close-circle-line"}></i>
                                        <div className="lote-result-info">
                                            <strong>{res.row.displayName}</strong>
                                            <span>{res.ok ? (res.row.isUpdate ? "Actualizado" : "Creado") : res.message}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
        </AppDrawer>
    );
};

export default EmpleadoImportModal;

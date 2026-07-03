import { useRef, useState } from "react";
import type { PurchaseKind, ImportResponse, ImportResultItem } from "../purchases.types";
import { importPurchaseFiles, importPurchaseExcel } from "../purchases.service";
import { downloadRowsXlsx } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField } from "../../../components/design-system";
import "./PurchaseModals.css";

interface Props {
    isOpen: boolean;
    kind: PurchaseKind;
    onClose: () => void;
    onImported: () => void;
}

const ACCEPTED = ".xml,.zip,.xlsx,.xls";

/** Encabezados de la plantilla Excel de importación de compras/gastos (1 fila = 1 factura). */
const TEMPLATE_HEADERS = ["NIT Proveedor", "Nombre Proveedor", "Prefijo", "Numero", "Fecha", "Subtotal", "Ingresos para terceros", "IVA", "Impuesto al consumo", "Total"];
const TEMPLATE_EXAMPLE = ["900123456", "Proveedor Demo SAS", "FE", "1234", "2025-01-15", "100000", "0", "19000", "0", "119000"];

const formatCOP = (n?: number) => (n ? n.toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }) : "—");

const ImportModal: React.FC<Props> = ({ isOpen, kind, onClose, onImported }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [dragging, setDragging] = useState(false);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResponse | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    if (!isOpen) return null;

    const reset = () => {
        setFiles([]);
        setResult(null);
        setImporting(false);
    };

    const close = () => {
        if (importing) return;
        reset();
        onClose();
    };

    const addFiles = (list: FileList | null) => {
        if (!list) return;
        const valid = Array.from(list).filter((f) => /\.(xml|zip|xlsx|xls)$/i.test(f.name));
        if (valid.length !== list.length) errorToast("Solo se admiten archivos XML, ZIP o la plantilla Excel");
        setFiles((prev) => [...prev, ...valid]);
    };

    const isExcel = (name: string) => /\.(xlsx|xls)$/i.test(name);

    /** Descarga la plantilla Excel vacía (con un ejemplo) para importar compras/gastos. */
    const downloadTemplate = () => {
        downloadRowsXlsx(`plantilla-${kind === "expense" ? "gastos" : "compras"}.xlsx`, TEMPLATE_HEADERS, [TEMPLATE_EXAMPLE], "Plantilla");
        successToast("Plantilla descargada. Llénala y súbela aquí.");
    };

    const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

    const doImport = async () => {
        if (!files.length) {
            errorToast("Agrega al menos un archivo");
            return;
        }
        setImporting(true);
        try {
            const excelFile = files.find((f) => isExcel(f.name));
            if (excelFile) {
                // Importación por plantilla Excel (1 archivo .xlsx).
                const r = await importPurchaseExcel(kind, excelFile);
                if (r.imported > 0) onImported();
                successToast(`${r.imported} importada(s), ${r.duplicates} duplicada(s), ${r.errors} con error.`);
                const erroresMsg = r.results.filter((x) => x.code === "ERROR").slice(0, 5).map((x) => `Fila ${x.fila}: ${x.message}`);
                if (erroresMsg.length) errorToast(erroresMsg.join(" · "));
                close();
                return;
            }
            const res = await importPurchaseFiles(kind, files);
            setResult(res);
            if (res.imported > 0) onImported();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo importar");
        } finally {
            setImporting(false);
        }
    };

    const badge = (r: ImportResultItem) =>
        r.code === "IMPORTED" ? "ok" : r.code === "DUPLICATE" ? "dup" : "err";

    return (
        <AppModal
            wide
            title={`Importar ${kind === "expense" ? "gastos" : "compras"}`}
            onClose={close}
            closeDisabled={importing}
            footer={
                !result ? (
                    <>
                        <button type="button" className="export-cancel" onClick={close} disabled={importing}>Cancelar</button>
                        <button type="button" className="export-submit" onClick={doImport} disabled={importing || files.length === 0}>
                            {importing ? "Importando..." : `Importar ${files.length || ""}`.trim()}
                        </button>
                    </>
                ) : (
                    <>
                        <button type="button" className="export-cancel" onClick={reset}>Importar más</button>
                        <button type="button" className="export-submit" onClick={close}>Listo</button>
                    </>
                )
            }
        >
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
                <button className="btn-secondary" onClick={downloadTemplate} type="button" title="Descarga la plantilla Excel para importar sin XML">
                    <i className="ri-file-excel-2-line" /> Descargar plantilla
                </button>
            </div>
            {!result ? (
                        <>
                            <div className="led-form-grid">
                            <FilterField className="led-form-grid__full" label="Archivos a importar" htmlFor="purchase-import-files" icon="ri-upload-cloud-2-line">
                                <div
                                    className={`pm-dropzone ${dragging ? "pm-dropzone--active" : ""}`}
                                    onClick={() => inputRef.current?.click()}
                                    onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                    onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                                    onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                                >
                                    <i className="ri-upload-cloud-2-line"></i>
                                    <p>Arrastra los XML/ZIP de la DIAN, o la plantilla Excel llena</p>
                                    <span>Haz clic para seleccionar. Para importar sin XML, descarga la plantilla (arriba), llénala y súbela.</span>
                                    <input ref={inputRef} id="purchase-import-files" type="file" accept={ACCEPTED} multiple hidden onChange={(e) => addFiles(e.target.files)} />
                                </div>
                            </FilterField>
                            </div>

                            {files.length > 0 && (
                                <ul className="pm-filelist">
                                    {files.map((f, i) => (
                                        <li key={`${f.name}-${i}`}>
                                            <i className={f.name.toLowerCase().endsWith(".zip") ? "ri-folder-zip-line" : "ri-file-code-line"} />
                                            <span className="pm-filename">{f.name}</span>
                                            <span className="pm-filesize">{(f.size / 1024).toFixed(0)} KB</span>
                                            <button className="pm-fileremove" onClick={() => removeFile(i)} disabled={importing} aria-label="Quitar"><i className="ri-close-line" /></button>
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <p className="pm-hint">
                                Si el proveedor o el producto no existen, se crean automáticamente. La factura se guarda completa para el
                                siguiente paso (tesorería).
                            </p>
                        </>
                    ) : (
                        <div className="pm-result">
                            <div className="pm-result-summary">
                                <span className="pm-chip pm-chip--ok">{result.imported} importadas</span>
                                <span className="pm-chip pm-chip--dup">{result.duplicates} duplicadas</span>
                                <span className="pm-chip pm-chip--err">{result.errors} con error</span>
                            </div>
                            <table className="pm-result-table">
                                <thead>
                                    <tr><th>Archivo</th><th>Documento</th><th>Proveedor</th><th>Total</th><th>Resultado</th></tr>
                                </thead>
                                <tbody>
                                    {result.results.map((r, i) => (
                                        <tr key={i}>
                                            <td>{r.fileName}</td>
                                            <td>{r.document || "—"}</td>
                                            <td>{r.supplier_name || "—"}</td>
                                            <td>{formatCOP(r.total)}</td>
                                            <td><span className={`pm-status pm-status--${badge(r)}`}>{r.message}</span></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
        </AppModal>
    );
};

export default ImportModal;

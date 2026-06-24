import { useRef, useState } from "react";
import type { PurchaseKind, ImportResponse, ImportResultItem } from "../purchases.types";
import { importPurchaseFiles } from "../purchases.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import "./PurchaseModals.css";

interface Props {
    isOpen: boolean;
    kind: PurchaseKind;
    onClose: () => void;
    onImported: () => void;
}

const ACCEPTED = ".xml,.zip";

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
        const valid = Array.from(list).filter((f) => /\.(xml|zip)$/i.test(f.name));
        if (valid.length !== list.length) errorToast("Solo se admiten archivos XML o ZIP");
        setFiles((prev) => [...prev, ...valid]);
    };

    const removeFile = (idx: number) => setFiles((prev) => prev.filter((_, i) => i !== idx));

    const doImport = async () => {
        if (!files.length) {
            errorToast("Agrega al menos un archivo");
            return;
        }
        setImporting(true);
        try {
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
        <div className="pm-overlay" onClick={close} role="presentation">
            <div className="pm-modal pm-modal--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pm-header">
                    <h3>Importar {kind === "expense" ? "gastos" : "compras"} (XML / ZIP DIAN)</h3>
                    <button className="pm-close" onClick={close} disabled={importing} aria-label="Cerrar"><i className="ri-close-line" /></button>
                </div>

                <div className="pm-body">
                    {!result ? (
                        <>
                            <div
                                className={`pm-dropzone ${dragging ? "pm-dropzone--active" : ""}`}
                                onClick={() => inputRef.current?.click()}
                                onDragEnter={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
                                onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
                            >
                                <i className="ri-upload-cloud-2-line"></i>
                                <p>Arrastra y suelta los archivos XML o ZIP aquí</p>
                                <span>o haz clic para seleccionarlos (puedes importar varios a la vez)</span>
                                <input ref={inputRef} type="file" accept={ACCEPTED} multiple hidden onChange={(e) => addFiles(e.target.files)} />
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
                </div>

                <div className="pm-actions">
                    {!result ? (
                        <>
                            <button className="pm-cancel" onClick={close} disabled={importing}>Cancelar</button>
                            <button className="pm-submit" onClick={doImport} disabled={importing || files.length === 0}>
                                {importing ? "Importando..." : `Importar ${files.length || ""}`.trim()}
                            </button>
                        </>
                    ) : (
                        <>
                            <button className="pm-cancel" onClick={reset}>Importar más</button>
                            <button className="pm-submit" onClick={close}>Listo</button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ImportModal;

import { useEffect, useRef, useState } from "react";
import { listAttachments, uploadAttachment, deleteAttachment, type Attachment } from "./attachments.service";
import { errorToast, successToast } from "../toast/toasts";
import { useConfirm } from "../../design-system";
import "./Attachments.css";

/**
 * Componente reutilizable para adjuntar soportes (PDF/imagen) a cualquier documento.
 * Úsalo pasando `entidad` ("compra" | "factura" | "asiento" | ...) y el `entidadId`.
 */
const Attachments: React.FC<{ entidad: string; entidadId: string; titulo?: string; hideTitle?: boolean }> = ({
    entidad,
    entidadId,
    titulo = "Soportes",
    hideTitle = false,
}) => {
    const { confirm } = useConfirm();
    const [items, setItems] = useState<Attachment[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    const load = async () => {
        setLoading(true);
        try {
            setItems(await listAttachments(entidad, entidadId));
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        } finally {
            setLoading(false);
        }
    };
    useEffect(() => {
        if (entidadId) load();
        /* eslint-disable-next-line react-hooks/exhaustive-deps */
    }, [entidad, entidadId]);

    const onPick = async (file: File | null) => {
        if (!file) return;
        setUploading(true);
        try {
            await uploadAttachment(entidad, entidadId, file);
            successToast("Soporte adjuntado");
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al subir");
        } finally {
            setUploading(false);
            if (fileRef.current) fileRef.current.value = "";
        }
    };

    const onDelete = async (id: string) => {
        if (!(await confirm("¿Eliminar este soporte?"))) return;
        try {
            await deleteAttachment(id);
            await load();
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
        }
    };

    const attachButton = (
        <>
            <button
                type="button"
                className={hideTitle ? "export-cancel attachments-adjuntar-btn" : "btn-secondary"}
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
            >
                <i className="ri-attachment-2" aria-hidden /> {uploading ? "Subiendo…" : "Adjuntar"}
            </button>
            <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.xml"
                hidden
                onChange={(e) => onPick(e.target.files?.[0] ?? null)}
            />
        </>
    );

    return (
        <div className="attachments">
            {hideTitle ? (
                <div className="attachments-toolbar">{attachButton}</div>
            ) : (
                <div className="acc-card-head attachments-head">
                    <div>
                        <h3 className="acc-h3 attachments-head__title">{titulo}</h3>
                    </div>
                    <div className="acc-head-actions">{attachButton}</div>
                </div>
            )}
            {loading ? (
                <p className="attachments-empty">Cargando…</p>
            ) : items.length === 0 ? (
                <p className="attachments-empty">No hay soportes adjuntos.</p>
            ) : (
                <ul className="attachments-list">
                    {items.map((a) => (
                        <li key={a._id} className="attachments-list__item">
                            <a href={a.url} target="_blank" rel="noopener noreferrer" className="attachments-list__link">
                                <i className="ri-file-line" aria-hidden /> {a.nombre}
                            </a>
                            <button type="button" className="btn-action attachments-list__delete" title="Eliminar" onClick={() => onDelete(a._id)}>
                                <i className="ri-delete-bin-line" aria-hidden />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
};

export default Attachments;

import React, { useEffect, useState } from "react";
import { emitEvent, DIAN_EVENT_LABELS, type DianDocument, type DianEventCode } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import "../../../components/modals/nomina-modals.css";

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    credentialId: string;
    document: DianDocument | null;
}

/** Modal para emitir un evento (acuse) sobre una factura recibida. */
const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSuccess, credentialId, document: doc }) => {
    const [eventCode, setEventCode] = useState<DianEventCode>("030");
    const [serie, setSerie] = useState("");
    const [senderNit, setSenderNit] = useState("");
    const [documentTypeId, setDocumentTypeId] = useState("");
    const [eventPrefix, setEventPrefix] = useState("");
    const [loading, setLoading] = useState(false);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (isOpen && doc) {
            setEventCode("030");
            setSerie(`${doc.prefijo ?? ""}${doc.folio ? `-${doc.folio}` : ""}`);
            setSenderNit(doc.nit_emisor ?? "");
            setDocumentTypeId(doc.tipo_documento ?? "");
            setEventPrefix("");
        }
    }, [isOpen, doc]);

    if (!isOpen || !doc) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!serie.trim() || !senderNit.trim()) {
            errorToast("Serie y NIT del emisor son obligatorios.");
            return;
        }
        setLoading(true);
        try {
            await emitEvent({
                credentialId,
                cufe: doc.cufe,
                eventCode,
                serie: serie.trim(),
                senderNit: senderNit.trim(),
                documentTypeId: documentTypeId || undefined,
                eventPrefix: eventPrefix.trim() || undefined,
            });
            successToast("Evento procesado.");
            onSuccess();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al emitir el evento");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <div className="modal-container" style={{ maxWidth: 580, width: "100%", maxHeight: "90vh", borderRadius: 12 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Emitir evento</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form className="modal-body" onSubmit={handleSubmit}>
                    <div className="info-box">
                        <i className="ri-mail-check-line"></i>
                        <p>
                            Factura de <strong>{doc.nombre_emisor || doc.nit_emisor || "—"}</strong>.<br />
                            CUFE: <code style={{ wordBreak: "break-all" }}>{doc.cufe}</code>
                        </p>
                    </div>

                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Tipo de evento *</label>
                            <select value={eventCode} onChange={(e) => setEventCode(e.target.value as DianEventCode)} disabled={loading}>
                                {(Object.keys(DIAN_EVENT_LABELS) as DianEventCode[]).map((code) => (
                                    <option key={code} value={code}>{code} · {DIAN_EVENT_LABELS[code]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Serie (prefijo-folio) *</label>
                            <input type="text" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Ej. FEM-58" disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>NIT del emisor *</label>
                            <input type="text" value={senderNit} onChange={(e) => setSenderNit(e.target.value)} disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>Tipo de documento</label>
                            <input type="text" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} placeholder="Opcional" disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>Prefijo del evento</label>
                            <input type="text" value={eventPrefix} onChange={(e) => setEventPrefix(e.target.value)} placeholder="Opcional" disabled={loading} />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <><i className="ri-loader-4-line rotating"></i> Emitiendo...</> : "Emitir evento"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default EventModal;

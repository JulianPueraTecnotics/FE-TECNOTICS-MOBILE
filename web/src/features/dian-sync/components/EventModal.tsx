import React, { useEffect, useState } from "react";
import { emitEvent, DIAN_EVENT_LABELS, type DianDocument, type DianEventCode } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    credentialId: string;
    document: DianDocument | null;
}

const EventModal: React.FC<EventModalProps> = ({ isOpen, onClose, onSuccess, credentialId, document: doc }) => {
    const [eventCode, setEventCode] = useState<DianEventCode>("030");
    const [serie, setSerie] = useState("");
    const [senderNit, setSenderNit] = useState("");
    const [documentTypeId, setDocumentTypeId] = useState("");
    const [eventPrefix, setEventPrefix] = useState("");
    const [loading, setLoading] = useState(false);

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
        <AppModal
            title="Emitir evento"
            titleIcon="ri-mail-check-line"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="submit" form="dian-event-form" className="export-submit" disabled={loading}>
                        {loading ? <><i className="ri-loader-4-line rotating" aria-hidden /> Emitiendo…</> : "Emitir evento"}
                    </button>
                </>
            }
        >
            <form id="dian-event-form" onSubmit={handleSubmit}>
                <div className="info-box" style={{ marginBottom: "1rem" }}>
                    <i className="ri-mail-check-line" aria-hidden />
                    <p>
                        Factura de <strong>{doc.nombre_emisor || doc.nit_emisor || "—"}</strong>.<br />
                        CUFE: <code style={{ wordBreak: "break-all" }}>{doc.cufe}</code>
                    </p>
                </div>
                <div className="led-form-grid">
                    <FilterField label="Tipo de evento *" htmlFor="dian-ev-type" icon="ri-mail-check-line">
                        <FieldControl id="dian-ev-type" as="select" value={eventCode} onChange={(e) => setEventCode(e.target.value as DianEventCode)} disabled={loading}>
                            {(Object.keys(DIAN_EVENT_LABELS) as DianEventCode[]).map((code) => (
                                <option key={code} value={code}>{code} · {DIAN_EVENT_LABELS[code]}</option>
                            ))}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Serie (prefijo-folio) *" htmlFor="dian-ev-serie" icon="ri-file-text-line">
                        <FieldControl id="dian-ev-serie" type="text" value={serie} onChange={(e) => setSerie(e.target.value)} placeholder="Ej. FEM-58" disabled={loading} />
                    </FilterField>
                    <FilterField label="NIT del emisor *" htmlFor="dian-ev-nit" icon="ri-building-line">
                        <FieldControl id="dian-ev-nit" type="text" value={senderNit} onChange={(e) => setSenderNit(e.target.value)} disabled={loading} />
                    </FilterField>
                    <FilterField label="Tipo de documento" htmlFor="dian-ev-doctype" icon="ri-file-list-3-line">
                        <FieldControl id="dian-ev-doctype" type="text" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} placeholder="Opcional" disabled={loading} />
                    </FilterField>
                    <FilterField label="Prefijo del evento" htmlFor="dian-ev-prefix" icon="ri-price-tag-3-line">
                        <FieldControl id="dian-ev-prefix" type="text" value={eventPrefix} onChange={(e) => setEventPrefix(e.target.value)} placeholder="Opcional" disabled={loading} />
                    </FilterField>
                </div>
            </form>
        </AppModal>
    );
};

export default EventModal;

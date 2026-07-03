import React, { useEffect, useState } from "react";
import {
    triggerSync,
    DIAN_DOCUMENT_TYPES,
    DIAN_GROUP_LABELS,
    type DianCredential,
    type DianSyncGroup,
} from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";

interface SyncModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (jobId: string) => void;
    credentials: DianCredential[];
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthAgoISO = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
};

const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onSuccess, credentials }) => {
    const [credentialId, setCredentialId] = useState("");
    const [fromDate, setFromDate] = useState(monthAgoISO());
    const [toDate, setToDate] = useState(todayISO());
    const [group, setGroup] = useState<DianSyncGroup>("all");
    const [documentTypeId, setDocumentTypeId] = useState("");
    const [senderCode, setSenderCode] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setCredentialId(credentials[0]?._id ?? "");
            setFromDate(monthAgoISO());
            setToDate(todayISO());
            setGroup("all");
            setDocumentTypeId("");
            setSenderCode("");
        }
    }, [isOpen, credentials]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!credentialId) {
            errorToast("Selecciona una credencial.");
            return;
        }
        if (fromDate > toDate) {
            errorToast("La fecha inicial no puede ser mayor que la final.");
            return;
        }
        setLoading(true);
        try {
            const res = await triggerSync({
                credentialId,
                fromDate,
                toDate,
                group,
                documentTypeId: documentTypeId || undefined,
                senderCode: senderCode.trim() || undefined,
            });
            successToast("Sincronización iniciada.");
            onSuccess(res.jobId);
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al iniciar la sincronización");
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppModal
            wide
            title="Nueva sincronización"
            titleIcon="ri-refresh-line"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="submit" form="dian-sync-form" className="export-submit" disabled={loading || credentials.length === 0}>
                        {loading ? <><i className="ri-loader-4-line rotating" aria-hidden /> Iniciando…</> : <><i className="ri-refresh-line" aria-hidden /> Sincronizar</>}
                    </button>
                </>
            }
        >
            <form id="dian-sync-form" onSubmit={handleSubmit}>
                <div className="led-form-grid">
                    <FilterField label="Credencial *" htmlFor="dian-sync-cred" icon="ri-key-2-line">
                        <FieldControl id="dian-sync-cred" as="select" value={credentialId} onChange={(e) => setCredentialId(e.target.value)} disabled={loading}>
                            {credentials.length === 0 && <option value="">No hay credenciales</option>}
                            {credentials.map((c) => (
                                <option key={c._id} value={c._id}>{c.label ? `${c.label} · ` : ""}NIT {c.nit}</option>
                            ))}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Desde *" htmlFor="dian-sync-from" icon="ri-calendar-line">
                        <FieldControl id="dian-sync-from" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={loading} max={toDate} />
                    </FilterField>
                    <FilterField label="Hasta *" htmlFor="dian-sync-to" icon="ri-calendar-line">
                        <FieldControl id="dian-sync-to" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={loading} max={todayISO()} />
                    </FilterField>
                    <FilterField label="Grupo" htmlFor="dian-sync-group" icon="ri-folder-line">
                        <FieldControl id="dian-sync-group" as="select" value={group} onChange={(e) => setGroup(e.target.value as DianSyncGroup)} disabled={loading}>
                            {(Object.keys(DIAN_GROUP_LABELS) as DianSyncGroup[]).map((g) => (
                                <option key={g} value={g}>{DIAN_GROUP_LABELS[g]}</option>
                            ))}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Tipo de documento" htmlFor="dian-sync-doctype" icon="ri-file-list-3-line">
                        <FieldControl id="dian-sync-doctype" as="select" value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} disabled={loading}>
                            {DIAN_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="NIT a filtrar (opcional)" htmlFor="dian-sync-nit" icon="ri-building-line">
                        <FieldControl id="dian-sync-nit" type="text" value={senderCode} onChange={(e) => setSenderCode(e.target.value)} placeholder="Ej. 900123456" disabled={loading} />
                    </FilterField>
                </div>
                <p className="pm-hint" style={{ marginTop: "0.75rem" }}>Restringe a documentos de/para ese NIT.</p>
            </form>
        </AppModal>
    );
};

export default SyncModal;

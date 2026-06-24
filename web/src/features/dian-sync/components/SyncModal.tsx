import React, { useEffect, useState } from "react";
import {
    triggerSync,
    DIAN_DOCUMENT_TYPES,
    DIAN_GROUP_LABELS,
    type DianCredential,
    type DianSyncGroup,
} from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import "../../../components/modals/nomina-modals.css";

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

/** Modal para disparar una sincronización: credencial + rango de fechas + grupo + filtros opcionales. */
const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onSuccess, credentials }) => {
    const [credentialId, setCredentialId] = useState("");
    const [fromDate, setFromDate] = useState(monthAgoISO());
    const [toDate, setToDate] = useState(todayISO());
    const [group, setGroup] = useState<DianSyncGroup>("all");
    const [documentTypeId, setDocumentTypeId] = useState("");
    const [senderCode, setSenderCode] = useState("");
    const [loading, setLoading] = useState(false);

    useBodyScrollLock(isOpen);

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
            const res = await triggerSync({ credentialId, fromDate, toDate, group, documentTypeId: documentTypeId || undefined, senderCode: senderCode.trim() || undefined });
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
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <div className="modal-container" style={{ maxWidth: 620, width: "100%", maxHeight: "90vh", borderRadius: 12 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Nueva sincronización</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form className="modal-body" onSubmit={handleSubmit}>
                    <div className="form-grid">
                        <div className="form-group full-width">
                            <label>Credencial *</label>
                            <select value={credentialId} onChange={(e) => setCredentialId(e.target.value)} disabled={loading}>
                                {credentials.length === 0 && <option value="">No hay credenciales</option>}
                                {credentials.map((c) => (
                                    <option key={c._id} value={c._id}>{c.label ? `${c.label} · ` : ""}NIT {c.nit}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Desde *</label>
                            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} disabled={loading} max={toDate} />
                        </div>
                        <div className="form-group">
                            <label>Hasta *</label>
                            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} disabled={loading} max={todayISO()} />
                        </div>
                        <div className="form-group">
                            <label>Grupo</label>
                            <select value={group} onChange={(e) => setGroup(e.target.value as DianSyncGroup)} disabled={loading}>
                                {(Object.keys(DIAN_GROUP_LABELS) as DianSyncGroup[]).map((g) => (
                                    <option key={g} value={g}>{DIAN_GROUP_LABELS[g]}</option>
                                ))}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Tipo de documento</label>
                            <select value={documentTypeId} onChange={(e) => setDocumentTypeId(e.target.value)} disabled={loading}>
                                {DIAN_DOCUMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group full-width">
                            <label>NIT a filtrar (opcional)</label>
                            <input type="text" value={senderCode} onChange={(e) => setSenderCode(e.target.value)} placeholder="Ej. 900123456" disabled={loading} />
                            <span className="field-hint">Restringe a documentos de/para ese NIT.</span>
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading || credentials.length === 0}>
                            {loading ? <><i className="ri-loader-4-line rotating"></i> Iniciando...</> : <><i className="ri-refresh-line"></i> Sincronizar</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SyncModal;

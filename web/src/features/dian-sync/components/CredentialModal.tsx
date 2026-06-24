import React, { useEffect, useState } from "react";
import { upsertCredential, refreshCredentialToken, type DianCredential } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import "../../../components/modals/nomina-modals.css";

interface CredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    /** Si se pasa, el modal entra en modo "refrescar token" de esa credencial. */
    credential?: DianCredential | null;
}

/**
 * Modal para registrar una credencial DIAN (pegar el enlace de acceso) o refrescar su token.
 * El enlace dura 20 min reales; al pegarlo el backend lo cifra y calcula el vencimiento.
 */
const CredentialModal: React.FC<CredentialModalProps> = ({ isOpen, onClose, onSuccess, credential }) => {
    const isRefresh = !!credential;
    const [accessUrl, setAccessUrl] = useState("");
    const [label, setLabel] = useState("");
    const [loading, setLoading] = useState(false);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (isOpen) {
            setAccessUrl("");
            setLabel(credential?.label ?? "");
        }
    }, [isOpen, credential]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!accessUrl.trim()) {
            errorToast("Pega el enlace de acceso de la DIAN.");
            return;
        }
        setLoading(true);
        try {
            if (isRefresh && credential) {
                await refreshCredentialToken(credential._id, accessUrl.trim());
                successToast("Token DIAN actualizado.");
            } else {
                await upsertCredential(accessUrl.trim(), label.trim() || undefined);
                successToast("Credencial DIAN guardada.");
            }
            onSuccess();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar la credencial");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <div
                className="modal-container"
                style={{ maxWidth: 580, width: "100%", maxHeight: "90vh", borderRadius: 12 }}
                onClick={(e) => e.stopPropagation()}
            >
                <div className="modal-header">
                    <h2>{isRefresh ? `Refrescar token · NIT ${credential?.nit}` : "Nueva credencial DIAN"}</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form className="modal-body" onSubmit={handleSubmit}>
                    <div className="info-box">
                        <i className="ri-information-line"></i>
                        <p>
                            En el portal de la DIAN solicita el <strong>enlace de acceso</strong>; la DIAN lo envía al correo del
                            representante legal. Pega aquí la URL completa (incluye <code>pk</code>, <code>rk</code> y <code>token</code>).
                            El enlace vence a los <strong>20 minutos</strong>.
                        </p>
                    </div>

                    <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
                        {!isRefresh && (
                            <div className="form-group">
                                <label>Nombre / etiqueta</label>
                                <input
                                    type="text"
                                    value={label}
                                    onChange={(e) => setLabel(e.target.value)}
                                    placeholder="Ej. Tecnotics - Matriz"
                                    disabled={loading}
                                />
                                <span className="field-hint">Opcional. Para identificar la credencial.</span>
                            </div>
                        )}
                        <div className="form-group">
                            <label>Enlace de acceso DIAN *</label>
                            <input
                                type="text"
                                value={accessUrl}
                                onChange={(e) => setAccessUrl(e.target.value)}
                                placeholder="https://catalogo-vpfe.dian.gov.co/User/AuthToken?pk=...&rk=...&token=..."
                                disabled={loading}
                                autoFocus
                            />
                            {isRefresh && <span className="field-hint">El NIT del enlace debe coincidir con {credential?.nit}.</span>}
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <><i className="ri-loader-4-line rotating"></i> Guardando...</> : isRefresh ? "Refrescar token" : "Guardar credencial"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CredentialModal;

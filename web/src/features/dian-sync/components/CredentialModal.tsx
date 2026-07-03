import React, { useEffect, useState } from "react";
import { upsertCredential, refreshCredentialToken, type DianCredential } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";

interface CredentialModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    credential?: DianCredential | null;
}

const CredentialModal: React.FC<CredentialModalProps> = ({ isOpen, onClose, onSuccess, credential }) => {
    const isRefresh = !!credential;
    const [accessUrl, setAccessUrl] = useState("");
    const [label, setLabel] = useState("");
    const [loading, setLoading] = useState(false);

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
        <AppModal
            wide
            title={isRefresh ? `Refrescar token · NIT ${credential?.nit}` : "Nueva credencial DIAN"}
            titleIcon="ri-key-2-line"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="submit" form="dian-credential-form" className="export-submit" disabled={loading}>
                        {loading ? <><i className="ri-loader-4-line rotating" aria-hidden /> Guardando…</> : isRefresh ? "Refrescar token" : "Guardar credencial"}
                    </button>
                </>
            }
        >
            <form id="dian-credential-form" onSubmit={handleSubmit}>
                <div className="info-box" style={{ marginBottom: "1rem" }}>
                    <i className="ri-information-line" aria-hidden />
                    <p>
                        En el portal de la DIAN solicita el <strong>enlace de acceso</strong>; la DIAN lo envía al correo del
                        representante legal. Pega aquí la URL completa (incluye <code>pk</code>, <code>rk</code> y <code>token</code>).
                        El enlace vence a los <strong>20 minutos</strong>.
                    </p>
                </div>
                <div className="led-form-grid">
                    {!isRefresh && (
                        <FilterField label="Nombre / etiqueta" htmlFor="dian-cred-label" icon="ri-price-tag-3-line">
                            <FieldControl
                                id="dian-cred-label"
                                type="text"
                                value={label}
                                onChange={(e) => setLabel(e.target.value)}
                                placeholder="Ej. Tecnotics - Matriz"
                                disabled={loading}
                            />
                        </FilterField>
                    )}
                    <FilterField label="Enlace de acceso DIAN *" htmlFor="dian-cred-url" icon="ri-link">
                        <FieldControl
                            id="dian-cred-url"
                            type="text"
                            value={accessUrl}
                            onChange={(e) => setAccessUrl(e.target.value)}
                            placeholder="https://catalogo-vpfe.dian.gov.co/User/AuthToken?pk=...&rk=...&token=..."
                            disabled={loading}
                            autoFocus
                        />
                    </FilterField>
                </div>
                {isRefresh && (
                    <p className="pm-hint" style={{ marginTop: "0.75rem" }}>
                        El NIT del enlace debe coincidir con {credential?.nit}.
                    </p>
                )}
            </form>
        </AppModal>
    );
};

export default CredentialModal;

import React, { useEffect, useState } from "react";
import { updateResponsible, type DianCredential } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
import "../../../components/modals/nomina-modals.css";

interface ResponsibleModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    credential: DianCredential | null;
}

const DOC_TYPES = [
    { value: "CC", label: "Cédula de ciudadanía (CC)" },
    { value: "CE", label: "Cédula de extranjería (CE)" },
    { value: "TI", label: "Tarjeta de identidad (TI)" },
    { value: "PA", label: "Pasaporte (PA)" },
];

/**
 * Datos de "quien recibe" la factura. Son obligatorios para emitir eventos (acuses) en el portal DIAN.
 */
const ResponsibleModal: React.FC<ResponsibleModalProps> = ({ isOpen, onClose, onSuccess, credential }) => {
    const [form, setForm] = useState({ responsible_doc_type: "CC", responsible_id: "", responsible_first_name: "", responsible_last_name: "" });
    const [loading, setLoading] = useState(false);

    useBodyScrollLock(isOpen);

    useEffect(() => {
        if (isOpen && credential) {
            setForm({
                responsible_doc_type: credential.responsible_doc_type || "CC",
                responsible_id: credential.responsible_id || "",
                responsible_first_name: credential.responsible_first_name || "",
                responsible_last_name: credential.responsible_last_name || "",
            });
        }
    }, [isOpen, credential]);

    if (!isOpen || !credential) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.responsible_id.trim() || !form.responsible_first_name.trim() || !form.responsible_last_name.trim()) {
            errorToast("Documento, nombres y apellidos son obligatorios.");
            return;
        }
        setLoading(true);
        try {
            await updateResponsible(credential._id, form);
            successToast("Datos del responsable guardados.");
            onSuccess();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar el responsable");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="modal-overlay" style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem" }} onClick={onClose}>
            <div className="modal-container" style={{ maxWidth: 580, width: "100%", maxHeight: "90vh", borderRadius: 12 }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Responsable de eventos · NIT {credential.nit}</h2>
                    <button className="modal-close" onClick={onClose} disabled={loading} aria-label="Cerrar">
                        <i className="ri-close-line"></i>
                    </button>
                </div>

                <form className="modal-body" onSubmit={handleSubmit}>
                    <div className="info-box">
                        <i className="ri-user-line"></i>
                        <p>Persona que figura como "quien recibe" en los acuses. La DIAN exige estos datos para emitir eventos.</p>
                    </div>

                    <div className="form-grid">
                        <div className="form-group">
                            <label>Tipo de documento</label>
                            <select value={form.responsible_doc_type} onChange={(e) => setForm({ ...form, responsible_doc_type: e.target.value })} disabled={loading}>
                                {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                            </select>
                        </div>
                        <div className="form-group">
                            <label>Número de documento *</label>
                            <input type="text" value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })} disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>Nombres *</label>
                            <input type="text" value={form.responsible_first_name} onChange={(e) => setForm({ ...form, responsible_first_name: e.target.value })} disabled={loading} />
                        </div>
                        <div className="form-group">
                            <label>Apellidos *</label>
                            <input type="text" value={form.responsible_last_name} onChange={(e) => setForm({ ...form, responsible_last_name: e.target.value })} disabled={loading} />
                        </div>
                    </div>

                    <div className="modal-footer">
                        <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancelar</button>
                        <button type="submit" className="btn-primary" disabled={loading}>
                            {loading ? <><i className="ri-loader-4-line rotating"></i> Guardando...</> : "Guardar"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResponsibleModal;

import React, { useEffect, useState } from "react";
import { updateResponsible, type DianCredential } from "../../../services/dian.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AppModal, FilterField, FieldControl } from "../../../components/design-system";

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

const ResponsibleModal: React.FC<ResponsibleModalProps> = ({ isOpen, onClose, onSuccess, credential }) => {
    const [form, setForm] = useState({ responsible_doc_type: "CC", responsible_id: "", responsible_first_name: "", responsible_last_name: "" });
    const [loading, setLoading] = useState(false);

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
        <AppModal
            title={`Responsable de eventos · NIT ${credential.nit}`}
            titleIcon="ri-user-settings-line"
            onClose={onClose}
            closeDisabled={loading}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={loading}>Cancelar</button>
                    <button type="submit" form="dian-responsible-form" className="export-submit" disabled={loading}>
                        {loading ? <><i className="ri-loader-4-line rotating" aria-hidden /> Guardando…</> : "Guardar"}
                    </button>
                </>
            }
        >
            <form id="dian-responsible-form" onSubmit={handleSubmit}>
                <div className="info-box" style={{ marginBottom: "1rem" }}>
                    <i className="ri-user-line" aria-hidden />
                    <p>Persona que figura como &quot;quien recibe&quot; en los acuses. La DIAN exige estos datos para emitir eventos.</p>
                </div>
                <div className="led-form-grid">
                    <FilterField label="Tipo de documento" htmlFor="dian-resp-type" icon="ri-id-card-line">
                        <FieldControl id="dian-resp-type" as="select" value={form.responsible_doc_type} onChange={(e) => setForm({ ...form, responsible_doc_type: e.target.value })} disabled={loading}>
                            {DOC_TYPES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Número de documento *" htmlFor="dian-resp-id" icon="ri-hashtag">
                        <FieldControl id="dian-resp-id" type="text" value={form.responsible_id} onChange={(e) => setForm({ ...form, responsible_id: e.target.value })} disabled={loading} />
                    </FilterField>
                    <FilterField label="Nombres *" htmlFor="dian-resp-first" icon="ri-user-line">
                        <FieldControl id="dian-resp-first" type="text" value={form.responsible_first_name} onChange={(e) => setForm({ ...form, responsible_first_name: e.target.value })} disabled={loading} />
                    </FilterField>
                    <FilterField label="Apellidos *" htmlFor="dian-resp-last" icon="ri-user-line">
                        <FieldControl id="dian-resp-last" type="text" value={form.responsible_last_name} onChange={(e) => setForm({ ...form, responsible_last_name: e.target.value })} disabled={loading} />
                    </FilterField>
                </div>
            </form>
        </AppModal>
    );
};

export default ResponsibleModal;

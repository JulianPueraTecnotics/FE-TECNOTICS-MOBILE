import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { createSubUser, updateSubUser, patchSubUserAvatar } from "../../../services/sub-users.service";
import type { CreateSubUserRequest, ISubUser, UpdateSubUserRequest } from "../../../types";
import { AppDrawer, FilterField, FieldControl } from "../../../components/design-system";
import { useFormDraft, isFormDirty } from "../../../hooks/useFormDraft";
import UnsavedChangesModal from "../UnsavedChangesModal/UnsavedChangesModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import "../ClientModal/ClientModal.css";
import "./SubUserModal.css";

const SUBUSER_DRAFT_KEY = "tecnotics:draft:subuser-modal";

interface SubUserModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
    subUser?: ISubUser | null;
}

const sanitizeNumericInput = (value: string) => value.replace(/\D/g, "");

const sanitizeDocNumberInput = (value: string, docType: string) => {
    const raw = value.replace(/\s/g, "");
    if (docType === "Nit") {
        const withoutInvalidChars = raw.replace(/[^\d-]/g, "");
        const parts = withoutInvalidChars.split("-");
        if (parts.length === 1) return parts[0];
        const main = parts[0].replace(/\D/g, "");
        const dv = parts.slice(1).join("").replace(/\D/g, "").slice(0, 1);
        return dv ? `${main}-${dv}` : main;
    }
    return sanitizeNumericInput(raw);
};

const emptyForm: CreateSubUserRequest = {
    name: "",
    last_name: "",
    email: "",
    phone: "",
    doc_type: "Cc",
    doc_number: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isNitValid(docNumber: string) {
    return /^\d{9,10}(-\d)?$/.test(docNumber.replace(/\s/g, ""));
}

const SubUserModal: React.FC<SubUserModalProps> = ({ isOpen, onClose, onSuccess, subUser }) => {
    const isEditMode = !!subUser;
    const [loading, setLoading] = useState(false);
    const [avatarUploading, setAvatarUploading] = useState(false);
    const [formData, setFormData] = useState<CreateSubUserRequest>(emptyForm);
    /** Vista previa tras subir archivo (blob URL); si no, se usa la URL del API */
    const [avatarOverrideUrl, setAvatarOverrideUrl] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const blobUrlRef = useRef<string | null>(null);

    // Borrador en localStorage: solo en modo creación (en edición se cierra directo para no pisar el usuario).
    const draftEnabled = !isEditMode;
    const { loadDraft, saveDraft, clearDraft } = useFormDraft<CreateSubUserRequest>(SUBUSER_DRAFT_KEY, draftEnabled);
    const [showUnsaved, setShowUnsaved] = useState(false);

    const revokeBlob = () => {
        if (blobUrlRef.current) {
            URL.revokeObjectURL(blobUrlRef.current);
            blobUrlRef.current = null;
        }
    };

    useEffect(() => {
        revokeBlob();
        setAvatarOverrideUrl(null);
        if (subUser) {
            setFormData({
                name: subUser.name,
                last_name: subUser.last_name,
                email: subUser.email,
                phone: sanitizeNumericInput(String(subUser.phone ?? "")),
                doc_type: subUser.doc_type,
                doc_number: sanitizeDocNumberInput(String(subUser.doc_number ?? ""), subUser.doc_type),
            });
        } else {
            // Al abrir en modo creación, restauramos el borrador guardado (si existe) o arrancamos vacío.
            setFormData(loadDraft() ?? { ...emptyForm });
        }
    }, [subUser, isOpen, loadDraft]);

    const displayAvatarSrc = avatarOverrideUrl ?? subUser?.avatar?.url ?? null;

    const isFormValid = useMemo(() => {
        const name = formData.name?.trim() ?? "";
        const last = formData.last_name?.trim() ?? "";
        const em = formData.email?.trim() ?? "";
        const phone = formData.phone?.trim() ?? "";
        const doc = formData.doc_number?.trim() ?? "";
        if (!name || !last || !em || !phone || !doc) return false;
        if (!EMAIL_RE.test(em)) return false;
        if (formData.doc_type === "Nit") {
            return isNitValid(doc);
        }
        return /\d/.test(doc);
    }, [formData]);

    const handleDocNumberKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key.startsWith("Arrow")) return;
        if (formData.doc_type === "Nit") {
            if (e.key === "-" || /\d/.test(e.key)) return;
            e.preventDefault();
            return;
        }
        if (!/\d/.test(e.key)) e.preventDefault();
    };

    const handlePhoneKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.key === "Backspace" || e.key === "Delete" || e.key === "Tab" || e.key.startsWith("Arrow")) return;
        if (!/\d/.test(e.key)) e.preventDefault();
    };

    const handleDocPaste = useCallback(
        (e: React.ClipboardEvent<HTMLInputElement>) => {
            e.preventDefault();
            const pasted = e.clipboardData.getData("text") || "";
            setFormData((prev) => ({
                ...prev,
                doc_number: sanitizeDocNumberInput(pasted, prev.doc_type),
            }));
        },
        []
    );

    const handlePhonePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData("text") || "";
        setFormData((prev) => ({
            ...prev,
            phone: sanitizeNumericInput(pasted),
        }));
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        if (name === "doc_type") {
            setFormData((prev) => ({
                ...prev,
                doc_type: value,
                doc_number: sanitizeDocNumberInput(prev.doc_number, value),
            }));
            return;
        }
        if (name === "doc_number") {
            setFormData((prev) => ({
                ...prev,
                doc_number: sanitizeDocNumberInput(value, prev.doc_type),
            }));
            return;
        }
        if (name === "phone") {
            setFormData((prev) => ({
                ...prev,
                phone: sanitizeNumericInput(value),
            }));
            return;
        }
        setFormData((prev) => ({
            ...prev,
            [name]: value,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!isFormValid) {
            errorToast("Completa todos los campos correctamente.");
            return;
        }

        setLoading(true);

        try {
            if (isEditMode && subUser) {
                const patch: UpdateSubUserRequest = {
                    name: formData.name,
                    last_name: formData.last_name,
                    phone: formData.phone,
                    doc_type: formData.doc_type,
                    doc_number: formData.doc_number,
                };
                await updateSubUser(subUser._id, patch);
                successToast("Usuario actualizado correctamente");
            } else {
                await createSubUser({
                    name: formData.name.trim(),
                    last_name: formData.last_name.trim(),
                    email: formData.email.trim(),
                    phone: formData.phone,
                    doc_type: formData.doc_type,
                    doc_number: formData.doc_number,
                });
                successToast("Usuario creado correctamente");
            }
            clearDraft();
            onSuccess();
            onClose();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al guardar el usuario");
        } finally {
            setLoading(false);
        }
    };

    const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !subUser) return;
        setAvatarUploading(true);
        try {
            await patchSubUserAvatar(subUser._id, file);
            revokeBlob();
            const url = URL.createObjectURL(file);
            blobUrlRef.current = url;
            setAvatarOverrideUrl(url);
            successToast("Avatar actualizado correctamente");
            onSuccess();
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo subir el avatar");
        } finally {
            setAvatarUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    useEffect(() => {
        return () => revokeBlob();
    }, []);

    // Intercepta el cierre: si en modo creación hay datos sin guardar, pregunta por el borrador.
    const requestClose = () => {
        if (loading || avatarUploading) return;
        if (draftEnabled && isFormDirty(formData, emptyForm)) {
            setShowUnsaved(true);
            return;
        }
        onClose();
    };

    const handleSaveDraft = () => {
        saveDraft(formData);
        setShowUnsaved(false);
        onClose();
    };

    const handleDiscardDraft = () => {
        clearDraft();
        setShowUnsaved(false);
        onClose();
    };

    if (!isOpen) return null;

    const submitDisabled = !isFormValid || loading || avatarUploading;

    return (
        <>
        <AppDrawer
            wide
            title={isEditMode ? "Editar usuario" : "Nuevo usuario"}
            titleIcon={isEditMode ? "ri-edit-line" : "ri-user-add-line"}
            onClose={requestClose}
            closeDisabled={loading || avatarUploading}
            ariaLabelledBy="subuser-modal-title"
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={requestClose} disabled={loading || avatarUploading}>
                        Cancelar
                    </button>
                    <button type="submit" form="subuser-form" className="export-submit" disabled={submitDisabled}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden />
                                {isEditMode ? "Guardando…" : "Creando…"}
                            </>
                        ) : isEditMode ? (
                            "Guardar"
                        ) : (
                            "Crear usuario"
                        )}
                    </button>
                </>
            }
        >
                <form id="subuser-form" onSubmit={handleSubmit} noValidate>
                    <div className="led-form-grid">
                        <FilterField label="Tipo de documento *" htmlFor="sub_doc_type" icon="ri-id-card-line">
                            <FieldControl
                                as="select"
                                id="sub_doc_type"
                                name="doc_type"
                                value={formData.doc_type}
                                onChange={handleInputChange}
                                required
                                disabled={loading || isEditMode}
                            >
                                <option value="Nit">NIT</option>
                                <option value="Cc">Cédula de Ciudadanía</option>
                                <option value="Ce">Cédula de Extranjería</option>
                                <option value="Ti">Tarjeta de Identidad</option>
                                <option value="Pasaporte">Pasaporte</option>
                                <option value="Nuip">NUIP</option>
                                <option value="Rc">Registro Civil</option>
                                <option value="Te">Tarjeta de Extranjería</option>
                                <option value="Psp">Psp</option>
                                <option value="DiExtranjero">Documento identidad extranjero</option>
                                <option value="Pep">PEP</option>
                                <option value="NitExtranjero">NIT extranjero</option>
                            </FieldControl>
                        </FilterField>
                        <FilterField label="Número de documento *" htmlFor="sub_doc_number" icon="ri-fingerprint-line">
                            <FieldControl
                                type="text"
                                id="sub_doc_number"
                                name="doc_number"
                                value={formData.doc_number}
                                onChange={handleInputChange}
                                onKeyDown={handleDocNumberKeyDown}
                                onPaste={handleDocPaste}
                                required
                                placeholder={formData.doc_type === "Nit" ? "900123456-7" : "1234567890"}
                                disabled={loading || isEditMode}
                                autoComplete="off"
                                inputMode="numeric"
                                pattern={formData.doc_type === "Nit" ? "\\d{9,10}(-\\d)?" : "\\d+"}
                            />
                        </FilterField>
                        <FilterField label="Nombre *" htmlFor="sub_name" icon="ri-user-line">
                            <FieldControl
                                type="text"
                                id="sub_name"
                                name="name"
                                value={formData.name}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                            />
                        </FilterField>
                        <FilterField label="Apellido *" htmlFor="sub_last_name" icon="ri-user-line">
                            <FieldControl
                                type="text"
                                id="sub_last_name"
                                name="last_name"
                                value={formData.last_name}
                                onChange={handleInputChange}
                                required
                                disabled={loading}
                            />
                        </FilterField>
                        <FilterField label="Correo electrónico *" htmlFor="sub_email" icon="ri-mail-line">
                            <FieldControl
                                type="email"
                                id="sub_email"
                                name="email"
                                value={formData.email}
                                onChange={handleInputChange}
                                required
                                readOnly={isEditMode}
                                disabled={loading}
                                autoComplete="email"
                                inputMode="email"
                                spellCheck={false}
                                className={isEditMode ? "subuser-input-readonly" : undefined}
                            />
                        </FilterField>
                        <FilterField label="Teléfono *" htmlFor="sub_phone" icon="ri-phone-line">
                            <FieldControl
                                type="tel"
                                id="sub_phone"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                onKeyDown={handlePhoneKeyDown}
                                onPaste={handlePhonePaste}
                                required
                                disabled={loading}
                                inputMode="numeric"
                                autoComplete="tel-national"
                                pattern="[0-9]*"
                            />
                        </FilterField>
                    </div>

                    {isEditMode && (
                        <div className="info-box" style={{ marginTop: "0.5rem" }}>
                            <i className="ri-information-line"></i>
                            <p>El correo no se puede cambiar. La contraseña la gestiona el usuario por correo de bienvenida.</p>
                        </div>
                    )}

                    {isEditMode && subUser && (
                        <div className="subuser-avatar-block form-group full-width">
                            <label>Foto de perfil</label>
                            <div className="subuser-avatar-row">
                                <div className="subuser-avatar-preview-wrap">
                                    {displayAvatarSrc ? (
                                        <img src={displayAvatarSrc} alt="" className="subuser-avatar-preview" />
                                    ) : (
                                        <div className="subuser-avatar-placeholder" aria-hidden>
                                            <i className="ri-user-3-line"></i>
                                        </div>
                                    )}
                                </div>
                                <div className="subuser-avatar-actions">
                                    <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
                                    <button
                                        type="button"
                                        className="btn-secondary"
                                        disabled={avatarUploading || loading}
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        {avatarUploading ? "Subiendo…" : "Cambiar avatar"}
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {!isEditMode && (
                        <div className="info-box">
                            <i className="ri-information-line"></i>
                            <p>Se generará una contraseña provisional en el servidor; el usuario la recibirá por correo.</p>
                        </div>
                    )}

                </form>
        </AppDrawer>
        <UnsavedChangesModal
            isOpen={showUnsaved}
            onSaveDraft={handleSaveDraft}
            onDiscard={handleDiscardDraft}
            onKeepEditing={() => setShowUnsaved(false)}
        />
        </>
    );
};

export default SubUserModal;

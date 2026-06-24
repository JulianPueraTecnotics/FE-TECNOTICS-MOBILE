import React, { useState, useRef } from "react";
import "./UpdateLogoModal.css";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_SIZE_MB = 2;

interface UpdateLogoModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLogoUrl: string;
    onSuccess: (file: File) => void | Promise<void>;
}

const UpdateLogoModal: React.FC<UpdateLogoModalProps> = ({
    isOpen,
    onClose,
    currentLogoUrl,
    onSuccess,
}) => {
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    useBodyScrollLock(isOpen);

    const resetState = () => {
        setSelectedFile(null);
        setPreviewUrl((url) => {
            if (url) URL.revokeObjectURL(url);
            return null;
        });
        setError(null);
    };

    const handleClose = () => {
        if (!loading) {
            resetState();
            onClose();
        }
    };

    const validateFile = (file: File): string | null => {
        if (!ACCEPTED_TYPES.includes(file.type)) {
            return "Formato no válido. Usa JPG, PNG, WebP o GIF.";
        }
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
            return `El archivo no debe superar ${MAX_SIZE_MB} MB.`;
        }
        return null;
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setError(null);
        const file = e.target.files?.[0];
        if (!file) {
            setSelectedFile(null);
            setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            return;
        }
        const err = validateFile(file);
        if (err) {
            setError(err);
            setSelectedFile(null);
            setPreviewUrl((prev) => {
                if (prev) URL.revokeObjectURL(prev);
                return null;
            });
            return;
        }
        setSelectedFile(file);
        setPreviewUrl((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(file);
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedFile) {
            setError("Selecciona una imagen.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            await onSuccess(selectedFile);
            handleClose();
        } catch {
            setError("No se pudo actualizar el logo. Intenta de nuevo.");
        } finally {
            setLoading(false);
        }
    };

    const triggerFileInput = () => inputRef.current?.click();

    if (!isOpen) return null;

    return (
        <div className="modal-overlay update-logo-overlay" onClick={handleClose}>
            <div className="modal-container update-logo-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>Cambiar logo de la empresa</h2>
                    <button
                        type="button"
                        className="modal-close"
                        onClick={handleClose}
                        disabled={loading}
                        aria-label="Cerrar"
                    >
                        <i className="ri-close-line" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="update-logo-body">
                    <div className="update-logo-previews">
                        <div className="update-logo-preview-box">
                            <span className="update-logo-label">Actual</span>
                            <div className="update-logo-img-wrap">
                                <img
                                    src={currentLogoUrl || "/placeholder-logo.svg"}
                                    alt="Logo actual"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23eee' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23999' font-size='12'%3ESin logo%3C/text%3E%3C/svg%3E";
                                    }}
                                />
                            </div>
                        </div>
                        <div className="update-logo-preview-box">
                            <span className="update-logo-label">Nuevo</span>
                            <div
                                className="update-logo-img-wrap update-logo-dropzone"
                                onClick={triggerFileInput}
                                onKeyDown={(e) => e.key === "Enter" && triggerFileInput()}
                                role="button"
                                tabIndex={0}
                                aria-label="Seleccionar imagen"
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Vista previa" />
                                ) : (
                                    <div className="update-logo-placeholder">
                                        <i className="ri-image-add-line" />
                                        <span>Haz clic o arrastra una imagen</span>
                                        <small>JPG, PNG, WebP o GIF (máx. {MAX_SIZE_MB} MB)</small>
                                    </div>
                                )}
                            </div>
                            <input
                                ref={inputRef}
                                type="file"
                                accept={ACCEPTED_TYPES.join(",")}
                                onChange={handleFileChange}
                                className="update-logo-input-hidden"
                                aria-hidden
                            />
                        </div>
                    </div>

                    {error && (
                        <div className="update-logo-error" role="alert">
                            <i className="ri-error-warning-line" />
                            {error}
                        </div>
                    )}

                    <div className="modal-footer update-logo-footer">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={!selectedFile || loading}
                        >
                            {loading ? (
                                <>
                                    <i className="ri-loader-4-line rotating" />
                                    Actualizando...
                                </>
                            ) : (
                                <>
                                    <i className="ri-upload-2-line" />
                                    Reemplazar logo
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default UpdateLogoModal;

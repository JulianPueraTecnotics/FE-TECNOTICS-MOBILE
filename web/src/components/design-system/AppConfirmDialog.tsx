import { AppModal } from "./AppModal";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

export type ConfirmVariant = "danger" | "warning" | "info" | "primary";

export type AppConfirmDialogProps = {
    open: boolean;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    variant?: ConfirmVariant;
    loading?: boolean;
    hideCancel?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
};

const variantIcon: Record<ConfirmVariant, string> = {
    danger: "ri-error-warning-line",
    warning: "ri-alert-line",
    info: "ri-information-line",
    primary: "ri-question-line",
};

export function AppConfirmDialog({
    open,
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "primary",
    loading = false,
    hideCancel = false,
    onConfirm,
    onCancel,
}: AppConfirmDialogProps) {
    useBodyScrollLock(open);
    if (!open) return null;

    const confirmClass = variant === "danger"
        ? "export-submit export-submit--danger"
        : variant === "warning"
            ? "export-submit export-submit--warning"
            : "export-submit";

    return (
        <AppModal
            title={title}
            titleIcon={variantIcon[variant]}
            onClose={onCancel}
            closeDisabled={loading}
            compact
            ariaLabelledBy="ds-confirm-title"
            footer={
                <>
                    {!hideCancel && (
                        <button type="button" className="export-cancel" onClick={onCancel} disabled={loading}>
                            {cancelText}
                        </button>
                    )}
                    <button type="button" className={confirmClass} onClick={onConfirm} disabled={loading}>
                        {loading ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden />
                                Procesando…
                            </>
                        ) : confirmText}
                    </button>
                </>
            }
        >
            <div className="ds-confirm-body">
                <p className="ds-confirm-message">{message}</p>
            </div>
        </AppModal>
    );
}

import React from "react";
import { AppConfirmDialog, type ConfirmVariant } from "../../design-system/AppConfirmDialog";

interface ConfirmModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: "danger" | "warning" | "info";
    loading?: boolean;
}

const typeToVariant: Record<NonNullable<ConfirmModalProps["type"]>, ConfirmVariant> = {
    danger: "danger",
    warning: "warning",
    info: "info",
};

const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    onClose,
    onConfirm,
    title,
    message,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    type = "danger",
    loading = false,
}) => (
    <AppConfirmDialog
        open={isOpen}
        title={title}
        message={message}
        confirmText={confirmText}
        cancelText={cancelText}
        variant={typeToVariant[type]}
        loading={loading}
        onConfirm={onConfirm}
        onCancel={onClose}
    />
);

export default ConfirmModal;

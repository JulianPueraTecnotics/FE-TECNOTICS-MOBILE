import React from 'react';
import './ConfirmModal.css';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
  loading?: boolean;
}

const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'danger',
  loading = false,
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return 'ri-error-warning-line';
      case 'warning':
        return 'ri-alert-line';
      case 'info':
        return 'ri-information-line';
      default:
        return 'ri-question-line';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'danger':
        return '#ef4444';
      case 'warning':
        return '#f59e0b';
      case 'info':
        return '#3b82f6';
      default:
        return '#667eea';
    }
  };

  return (
    <div className="confirm-overlay" onClick={onClose}>
      <div className="confirm-container" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-icon" style={{ color: getIconColor() }}>
          <i className={getIcon()}></i>
        </div>
        <h3 className="confirm-title">{title}</h3>
        <p className="confirm-message">{message}</p>
        <div className="confirm-actions">
          <button
            className="btn-cancel"
            onClick={onClose}
            disabled={loading}
          >
            {cancelText}
          </button>
          <button
            className={`btn-confirm btn-confirm-${type}`}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line rotating"></i>
                Procesando...
              </>
            ) : (
              confirmText
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmModal;




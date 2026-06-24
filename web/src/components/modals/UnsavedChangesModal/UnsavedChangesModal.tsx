import React from 'react';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import './UnsavedChangesModal.css';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  /** Guardar el borrador (localStorage) y cerrar el modal. */
  onSaveDraft: () => void;
  /** Descartar los datos y cerrar el modal. */
  onDiscard: () => void;
  /** Volver al formulario sin cerrar. */
  onKeepEditing: () => void;
}

const UnsavedChangesModal: React.FC<UnsavedChangesModalProps> = ({
  isOpen,
  title = '¿Guardar borrador?',
  message = 'Tienes datos sin guardar. ¿Quieres guardar un borrador para continuar más tarde?',
  onSaveDraft,
  onDiscard,
  onKeepEditing,
}) => {
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  return (
    <div className="unsaved-overlay" onClick={onKeepEditing}>
      <div
        className="unsaved-container"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="unsaved-title"
      >
        <div className="unsaved-icon">
          <i className="ri-draft-line"></i>
        </div>
        <h3 id="unsaved-title" className="unsaved-title">{title}</h3>
        <p className="unsaved-message">{message}</p>
        <div className="unsaved-actions">
          <button type="button" className="unsaved-btn unsaved-btn-keep" onClick={onKeepEditing}>
            Seguir editando
          </button>
          <button type="button" className="unsaved-btn unsaved-btn-discard" onClick={onDiscard}>
            Descartar
          </button>
          <button type="button" className="unsaved-btn unsaved-btn-save" onClick={onSaveDraft}>
            Guardar borrador
          </button>
        </div>
      </div>
    </div>
  );
};

export default UnsavedChangesModal;

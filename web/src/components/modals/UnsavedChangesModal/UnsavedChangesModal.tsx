import React from 'react';
import { AppModal } from '../../../components/design-system';

interface UnsavedChangesModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  onSaveDraft: () => void;
  onDiscard: () => void;
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
  if (!isOpen) return null;

  return (
    <AppModal
      compact
      title={title}
      titleIcon="ri-draft-line"
      onClose={onKeepEditing}
      ariaLabelledBy="unsaved-title"
      footer={
        <>
          <button type="button" className="export-cancel" onClick={onKeepEditing}>
            Seguir editando
          </button>
          <button type="button" className="export-cancel export-submit--warning" onClick={onDiscard}>
            Descartar
          </button>
          <button type="button" className="export-submit" onClick={onSaveDraft}>
            Guardar borrador
          </button>
        </>
      }
    >
      <div className="ds-confirm-body">
        <p className="ds-confirm-message">{message}</p>
      </div>
    </AppModal>
  );
};

export default UnsavedChangesModal;

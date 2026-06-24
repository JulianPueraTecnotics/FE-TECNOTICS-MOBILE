import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { signupStep3UploadDocs } from '../../../services/register.service';
import './Step3.css';

interface Step3Props {
  companyId: string;
  contratoUrl: string;
  onComplete: () => void;
}

interface FileState {
  file: File | null;
  preview: string | null;
}

const Step3: React.FC<Step3Props> = ({ companyId }) => {
  const [loading, setLoading] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [files, setFiles] = useState<{
    rut: FileState;
    camara_comercio: FileState;
    cedula_front: FileState;
    cedula_back: FileState;
  }>({
    rut: { file: null, preview: null },
    camara_comercio: { file: null, preview: null },
    cedula_front: { file: null, preview: null },
    cedula_back: { file: null, preview: null },
  });

  const handleFileChange = (
    e: React.ChangeEvent<HTMLInputElement>,
    fieldName: keyof typeof files
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImageField = fieldName === 'cedula_front' || fieldName === 'cedula_back';
    const allowedTypes = isImageField
      ? ['image/png', 'image/jpg', 'image/jpeg', 'image/webp']
      : ['application/pdf'];

    if (!allowedTypes.includes(file.type)) {
      toast.error(
        isImageField
          ? 'Solo se permiten imágenes PNG, JPG, JPEG o WebP'
          : 'Solo se permiten archivos PDF'
      );
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe superar los 5MB');
      return;
    }

    if (isImageField) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFiles((prev) => ({
          ...prev,
          [fieldName]: {
            file,
            preview: reader.result as string,
          },
        }));
      };
      reader.readAsDataURL(file);
    } else {
      setFiles((prev) => ({
        ...prev,
        [fieldName]: {
          file,
          preview: null,
        },
      }));
    }
  };

  const handleRemoveFile = (fieldName: keyof typeof files) => {
    setFiles((prev) => ({
      ...prev,
      [fieldName]: { file: null, preview: null },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const missingFiles = (Object.entries(files) as [keyof typeof files, FileState][])
      .filter(([, value]) => !value.file)
      .map(([key]) => key);

    if (missingFiles.length > 0) {
      toast.error('Por favor sube todos los documentos requeridos');
      return;
    }

    setLoading(true);

    try {
      const response = await signupStep3UploadDocs(companyId, {
        rut: files.rut.file!,
        camara_comercio: files.camara_comercio.file!,
        cedula_front: files.cedula_front.file!,
        cedula_back: files.cedula_back.file!,
      });

      toast.success(response.message || 'Documentos subidos correctamente');
      setStep3Done(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir documentos');
    } finally {
      setLoading(false);
    }
  };

  const renderFileUpload = (
    fieldName: keyof typeof files,
    label: string,
    icon: string,
    isImage: boolean = false
  ) => {
    const fileState = files[fieldName];
    const hasFile = fileState.file !== null;

    return (
      <div className="file-upload-card" key={fieldName}>
        <div className="file-upload-header">
          <i className={icon}></i>
          <h4>{label}</h4>
        </div>
        <div className="file-upload-body">
          {hasFile ? (
            <div className="file-preview">
              {isImage && fileState.preview ? (
                <img src={fileState.preview} alt={label} />
              ) : (
                <div className="pdf-icon">
                  <i className="ri-file-pdf-line"></i>
                  <p>{fileState.file?.name}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => handleRemoveFile(fieldName)}
                className="btn-remove"
                disabled={loading}
              >
                <i className="ri-close-line"></i>
              </button>
            </div>
          ) : (
            <>
              <input
                type="file"
                id={fieldName}
                accept={isImage ? 'image/png,image/jpg,image/jpeg,image/webp' : 'application/pdf'}
                onChange={(e) => handleFileChange(e, fieldName)}
                className="file-input"
                disabled={loading}
              />
              <label htmlFor={fieldName} className="file-label">
                <i className="ri-upload-cloud-line"></i>
                <p>Haz clic para seleccionar</p>
                <span>{isImage ? 'PNG, JPG, JPEG o WebP' : 'PDF'} - Máx 5MB</span>
              </label>
            </>
          )}
        </div>
      </div>
    );
  };

  if (step3Done) {
    return (
      <div className="step3-container">
        <div className="step3-header">
          <h3>Documentos subidos correctamente</h3>
          <p>Revisa tu correo para completar el registro</p>
        </div>
        <div
          className="alert-info-box"
          style={{
            background: '#e6f7ff',
            border: '1px solid #91d5ff',
            padding: '1.5rem',
            borderRadius: '8px',
            marginTop: '1rem',
            display: 'flex',
            gap: '1rem',
            alignItems: 'flex-start',
            color: '#0050b3',
          }}
        >
          <i className="ri-mail-send-line" style={{ fontSize: '2rem' }}></i>
          <div>
            <strong>Revisa tu correo electrónico</strong>
            <p style={{ margin: '0.5rem 0 0 0' }}>
              Te hemos enviado un enlace para que el representante legal firme el contrato de mandato.
              Usa ese enlace para firmar el contrato y completar el proceso de registro.
            </p>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
              Después de firmar podrás continuar con el envío a SIMBA y finalizar el registro.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="step3-container">
      <div className="step3-header">
        <h3>Documentos Legales</h3>
        <p>Sube los documentos requeridos. El contrato de mandato se firmará mediante el enlace que te enviaremos por correo.</p>
      </div>

      <form onSubmit={handleSubmit} className="step3-form">
        <div className="files-grid">
          {renderFileUpload('rut', 'RUT (Registro Único Tributario)', 'ri-file-list-3-line')}
          {renderFileUpload(
            'camara_comercio',
            'Certificado de Cámara de Comercio',
            'ri-building-line'
          )}
          {renderFileUpload(
            'cedula_front',
            'Cédula del Representante Legal (Frente)',
            'ri-id-card-line',
            true
          )}
          {renderFileUpload(
            'cedula_back',
            'Cédula del Representante Legal (Reverso)',
            'ri-id-card-line',
            true
          )}
        </div>

        <div className="form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || Object.values(files).some((f) => !f.file)}
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line rotating"></i>
                Subiendo Documentos...
              </>
            ) : (
              <>
                Continuar
                <i className="ri-arrow-right-line"></i>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step3;

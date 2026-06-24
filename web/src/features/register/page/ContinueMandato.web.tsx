import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { uploadSignedMandato, getContratoMandatoForSigning } from '../../../services/register.service';
import PDFSignature from '../../../components/PDFSignature/PDFSignatureNew';
import Step4 from '../components/Step4';
import { clearRegisterProgress } from '../../../utils/registerStorage';
import { removeItemSync } from '../../../utils/storage';
import './Register.css';
import '../components/Step3.css';
import '../components/Step4.css';

// Flujo: companyId de la URL → GET /company/signup/contrato-mandato/:companyId → mostrar PDF para firma → POST /company/signup/upload-signed-mandato

const ContinueMandato: React.FC = () => {
  const { companyId } = useParams<{ companyId: string }>();
  const navigate = useNavigate();

  const [contratoUrl, setContratoUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(true);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [mandatoUploaded, setMandatoUploaded] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setLoadingUrl(false);
      setUrlError('Falta el identificador de la empresa en la URL.');
      return;
    }

    getContratoMandatoForSigning(companyId)
      .then((res) => {
        const url = res.contrato_mandato_url;
        if (url) {
          setContratoUrl(url);
        } else {
          setUrlError('No se pudo obtener la URL del contrato.');
        }
      })
      .catch(() => {
        setUrlError(
          'No se pudo cargar el contrato. Verifica que estés usando el enlace que te enviamos por correo.'
        );
      })
      .finally(() => setLoadingUrl(false));
  }, [companyId]);

  const handleSigned = async (signedFile: File) => {
    if (!companyId) return;
    setUploading(true);
    try {
      await uploadSignedMandato(companyId, signedFile);
      toast.success('Contrato mandato firmado subido correctamente. Puedes continuar con el envío a Simba.');
      setMandatoUploaded(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir el contrato firmado');
    } finally {
      setUploading(false);
    }
  };

  const handleStep4Complete = () => {
    toast.success('¡Registro completado exitosamente!');
    clearRegisterProgress();
    removeItemSync('signed_contract_mandato');
    removeItemSync('signed_contract_name');
    setTimeout(() => navigate('/dashboard'), 2000);
  };

  if (!companyId) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="step3-container">
            <div className="step3-header">
              <h3>Enlace no válido</h3>
              <p>Falta el identificador de la empresa. Usa el enlace que te enviamos por correo.</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mandatoUploaded) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="step-content">
            <Step4 companyId={companyId} onComplete={handleStep4Complete} />
          </div>
        </div>
      </div>
    );
  }

  if (loadingUrl) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="step3-container">
            <div className="step3-header">
              <h3>Cargando contrato...</h3>
              <p>Preparando el documento para firma.</p>
              <div style={{ marginTop: '1rem' }}>
                <i className="ri-loader-4-line rotating" style={{ fontSize: '2rem' }}></i>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (urlError || !contratoUrl) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="step3-container">
            <div className="step3-header">
              <h3>No se pudo cargar el contrato</h3>
              <p>{urlError || 'URL del contrato no disponible.'}</p>
              <p style={{ marginTop: '1rem', fontSize: '0.9rem' }}>
                Asegúrate de usar el enlace que te enviamos por correo con el identificador de la empresa.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="register-container">
      <div className="register-card">
        <div className="register-header">
          <h1>Firma del contrato de mandato</h1>
          <p>Completa la firma del contrato para continuar con el registro</p>
        </div>
        <div className="step-content">
          <div className="step3-container">
            <div
              className="alert-info-box"
              style={{
                background: '#e6f7ff',
                border: '1px solid #91d5ff',
                padding: '1rem',
                borderRadius: '8px',
                marginBottom: '1.5rem',
                display: 'flex',
                gap: '10px',
                alignItems: 'center',
                color: '#0050b3',
              }}
            >
              <i className="ri-information-line" style={{ fontSize: '1.5rem' }}></i>
              <div>
                <strong>Firma del contrato</strong>
                <p style={{ margin: 0 }}>
                  Revisa el contrato y fírmalo digitalmente. Al terminar se subirá y podrás continuar con el envío a SIMBA.
                </p>
              </div>
            </div>
            <PDFSignature pdfUrl={contratoUrl} onSigned={handleSigned} />
            {uploading && (
              <div style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--primary-color)' }}>
                <i className="ri-loader-4-line rotating"></i> Subiendo contrato firmado...
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContinueMandato;

import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { signupStep4SendToSimba } from '../../../services/register.service';
import './Step4.css';

interface Step4Props {
  companyId: string;
  onComplete: () => void;
}

const Step4: React.FC<Step4Props> = ({ companyId, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);

    try {
      const response = await signupStep4SendToSimba({ companyId });
      toast.success(response.message);
      setIsCompleted(true);
      
      setTimeout(() => {
        onComplete();
      }, 2000);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al enviar a SIMBA');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step4-container">
      {!isCompleted ? (
        <>
          <div className="step4-header">
            <div className="step4-icon">
              <i className="ri-send-plane-line"></i>
            </div>
            <h3>Paso Final: Enviar a SIMBA</h3>
            <p>
              Estamos listos para enviar toda tu documentación al sistema SIMBA de la DIAN para
              activar tu facturación electrónica.
            </p>
          </div>

          <div className="step4-info">
            <div className="info-card">
              <i className="ri-shield-check-line"></i>
              <div>
                <h4>Documentación Completa</h4>
                <p>Todos tus documentos han sido verificados y están listos para ser procesados</p>
              </div>
            </div>

            <div className="info-card">
              <i className="ri-time-line"></i>
              <div>
                <h4>Tiempo de Procesamiento</h4>
                <p>El proceso de tokenización puede tomar entre 24 y 48 horas hábiles</p>
              </div>
            </div>

            <div className="info-card">
              <i className="ri-mail-line"></i>
              <div>
                <h4>Notificación por Correo</h4>
                <p>Te enviaremos un correo cuando tu cuenta esté activa y lista para facturar</p>
              </div>
            </div>
          </div>

          <div className="step4-warning">
            <i className="ri-error-warning-line"></i>
            <div>
              <strong>Importante</strong>
              <p>
                Una vez enviada la información a SIMBA, no podrás modificar los datos de tu empresa.
                Asegúrate de que toda la información esté correcta antes de continuar.
              </p>
            </div>
          </div>

          <div className="step4-actions">
            <button
              onClick={handleSubmit}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line rotating"></i>
                  Enviando a SIMBA...
                </>
              ) : (
                <>
                  <i className="ri-send-plane-fill"></i>
                  Enviar a SIMBA y Finalizar
                </>
              )}
            </button>
          </div>
        </>
      ) : (
        <div className="step4-success">
          <div className="success-animation">
            <div className="checkmark-circle">
              <i className="ri-check-line"></i>
            </div>
          </div>
          <h3>¡Registro Completado Exitosamente!</h3>
          <p>
            Tu información ha sido enviada a SIMBA. Recibirás un correo electrónico cuando tu cuenta
            esté activa.
          </p>
          <div className="success-details">
            <div className="detail-item">
              <i className="ri-mail-check-line"></i>
              <span>Revisa tu correo en las próximas 48 horas</span>
            </div>
            <div className="detail-item">
              <i className="ri-customer-service-line"></i>
              <span>Contáctanos si tienes alguna duda</span>
            </div>
          </div>
          <p className="redirect-message">Serás redirigido al login en unos segundos...</p>
        </div>
      )}
    </div>
  );
};

export default Step4;


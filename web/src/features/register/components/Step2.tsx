import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { signupStep2VerifyOTP } from '../../../services/register.service';
import './Step2.css';

// El contrato se muestra para lectura; la firma se hace en /continue/mandato/:companyId (enlace del correo tras step 3).

interface Step2Props {
  companyId: string;
  email: string;
  onComplete: (contratoData: { public_id: string; url: string; original_name: string }) => void;
}

const Step2: React.FC<Step2Props> = ({ companyId, email, onComplete }) => {
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [contratoUrl, setContratoUrl] = useState<string | null>(null);
  const [contratoData, setContratoData] = useState<{ public_id: string; url: string; original_name: string } | null>(null);

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) {
      value = value.charAt(0);
    }

    if (!/^\d*$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus siguiente input
    if (value && index < 5) {
      const nextInput = document.getElementById(`otp-${index + 1}`);
      nextInput?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      const prevInput = document.getElementById(`otp-${index - 1}`);
      prevInput?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];

    for (let i = 0; i < pastedData.length; i++) {
      newOtp[i] = pastedData[i];
    }

    setOtp(newOtp);

    // Focus último input con valor
    const lastIndex = Math.min(pastedData.length, 5);
    const lastInput = document.getElementById(`otp-${lastIndex}`);
    lastInput?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const otpValue = otp.join('');
    if (otpValue.length !== 6) {
      toast.error('Por favor ingresa el código completo de 6 dígitos');
      return;
    }

    setLoading(true);

    try {
      const response = await signupStep2VerifyOTP({
        companyId,
        OTP_recovery: parseInt(otpValue),
      });

      toast.success('OTP verificado correctamente');
      setContratoUrl(response.data.contrato_mandato.url);
      setContratoData(response.data.contrato_mandato);
    } catch (error) {
      console.error('❌ [Step2] Error al verificar OTP:', error);
      toast.error(error instanceof Error ? error.message : 'Error al verificar OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleContinue = () => {
    if (!contratoData) return;
    onComplete(contratoData);
  };

  return (
    <div className="step2-container">
      <div className="step2-content">
        <div className="step2-header">
          <div className="email-icon">
            <i className="ri-mail-check-line"></i>
          </div>
          <h3>Verifica tu Correo Electrónico</h3>
          <p>
            Hemos enviado un código de 6 dígitos a <strong>{email}</strong>
          </p>
        </div>

        <form onSubmit={handleSubmit} className="step2-form">
          <div className="otp-inputs" onPaste={handlePaste}>
            {otp.map((digit, index) => (
              <input
                key={index}
                id={`otp-${index}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className="otp-input"
                disabled={loading || contratoUrl !== null}
                autoFocus={index === 0}
              />
            ))}
          </div>

          {!contratoUrl && (
            <button
              type="submit"
              className="btn-primary"
              disabled={loading || otp.some((digit) => !digit)}
            >
              {loading ? (
                <>
                  <i className="ri-loader-4-line rotating"></i>
                  Verificando...
                </>
              ) : (
                <>
                  Verificar Código
                  <i className="ri-arrow-right-line"></i>
                </>
              )}
            </button>
          )}
        </form>

        {contratoUrl && contratoData && (
          <div className="contract-section">
            <div className="success-message">
              <div className="success-icon">
                <i className="ri-checkbox-circle-line"></i>
              </div>
              <h4>¡Código Verificado Exitosamente!</h4>
              <p>
                Tu contrato de mandato ha sido generado. Puedes revisarlo o descargarlo si lo deseas. La firma del contrato se realizará más adelante mediante un enlace que te enviaremos por correo después de subir los documentos legales.
              </p>
            </div>

            <div className="next-step-action">
              <a
                href={contratoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-link"
                style={{ marginBottom: '1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
              >
                <i className="ri-file-pdf-line"></i>
                Ver / descargar contrato de mandato
              </a>
              <button
                onClick={handleContinue}
                className="btn-primary btn-lg"
              >
                Continuar al Siguiente Paso (subir documentos)
                <i className="ri-arrow-right-line"></i>
              </button>
            </div>
          </div>
        )}

        <div className="resend-section">
          <p>¿No recibiste el código?</p>
          <button
            type="button"
            className="btn-link"
            disabled={loading}
          >
            Reenviar Código
          </button>
        </div>
      </div>
    </div>
  );
};

export default Step2;


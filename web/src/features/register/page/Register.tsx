import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Step1 from '../components/Step1';
import Step2 from '../components/Step2';
import Step3 from '../components/Step3';
import Step4 from '../components/Step4';
import {
    getRegisterProgress,
    saveRegisterProgress,
    clearRegisterProgress,
    hasRecentProgress
} from '../../../utils/registerStorage';
import './Register.css';

export const Register: React.FC = () => {
    const navigate = useNavigate();
    // Cargar progreso guardado al iniciar
    const savedProgress = getRegisterProgress();

    const [currentStep, setCurrentStep] = useState(savedProgress.currentStep || 1);
    const [companyId, setCompanyId] = useState<string>(savedProgress.company_id || '');
    const [email, setEmail] = useState<string>(savedProgress.email || '');
    const [contratoUrl, setContratoUrl] = useState<string>(savedProgress.contrato_mandato?.url || '');

    const handleStep1Complete = (id: string, emailValue: string, razonSocial: string) => {

        setCompanyId(id);
        setEmail(emailValue);
        setCurrentStep(2);

        // Guardar en localStorage
        saveRegisterProgress({
            currentStep: 2,
            company_id: id,
            email: emailValue,
            razon_social: razonSocial,
        });
    };

    const handleStep2Complete = (contratoData: { public_id: string; url: string; original_name: string }) => {

        setContratoUrl(contratoData.url);
        setCurrentStep(3);

        // Guardar en localStorage
        saveRegisterProgress({
            currentStep: 3,
            contrato_mandato: contratoData,
        });
    };

    const handleStep3Complete = () => {
        setCurrentStep(4);

        // Guardar en localStorage
        saveRegisterProgress({
            currentStep: 4,
            documents_uploaded: true,
        });
    };

    const handleStep4Complete = () => {
        toast.success('¡Registro completado exitosamente!');

        // Limpiar localStorage después de completar
        clearRegisterProgress();
        localStorage.removeItem('signed_contract_mandato');
        localStorage.removeItem('signed_contract_name');

        setTimeout(() => {
            navigate('/dashboard');
        }, 2000);
    };

    const handleBackToLogin = () => {
        navigate('/login');
    };

    // Mostrar mensaje si hay progreso guardado
    useEffect(() => {
        if (hasRecentProgress() && savedProgress.currentStep > 1) {
            toast.success(`Progreso recuperado. Continuando desde el paso ${savedProgress.currentStep}`, {
                duration: 4000,
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    return (
        <div className="register-container">
            <div className="register-card">
                {/* Header */}
                <div className="register-header">
                    <h1>Registro de Empresa</h1>
                    <p>Completa los siguientes pasos para registrar tu empresa</p>
                </div>

                {/* Progress Bar */}
                <div className="progress-bar">
                    <div className={`progress-step ${currentStep >= 1 ? 'active' : ''}`}>
                        <div className="step-number">1</div>
                        <div className="step-label">Información</div>
                    </div>
                    <div className={`progress-line ${currentStep >= 2 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${currentStep >= 2 ? 'active' : ''}`}>
                        <div className="step-number">2</div>
                        <div className="step-label">Verificación</div>
                    </div>
                    <div className={`progress-line ${currentStep >= 3 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${currentStep >= 3 ? 'active' : ''}`}>
                        <div className="step-number">3</div>
                        <div className="step-label">Documentos</div>
                    </div>
                    <div className={`progress-line ${currentStep >= 4 ? 'active' : ''}`}></div>
                    <div className={`progress-step ${currentStep >= 4 ? 'active' : ''}`}>
                        <div className="step-number">4</div>
                        <div className="step-label">Finalizar</div>
                    </div>
                </div>

                {/* Steps Content */}
                <div className="step-content">
                    {currentStep === 1 && (
                        <Step1
                            onComplete={handleStep1Complete}
                            onBackToLogin={handleBackToLogin}
                        />
                    )}
                    {currentStep === 2 && (
                        <Step2
                            companyId={companyId}
                            email={email}
                            onComplete={handleStep2Complete}
                        />
                    )}
                    {currentStep === 3 && (
                        <Step3
                            companyId={companyId}
                            contratoUrl={contratoUrl}
                            onComplete={handleStep3Complete}
                        />
                    )}
                    {currentStep === 4 && (
                        <Step4
                            companyId={companyId}
                            onComplete={handleStep4Complete}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default Register;


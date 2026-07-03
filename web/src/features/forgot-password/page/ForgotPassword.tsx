import { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import InputComponent from "../../../components/ui/inputs/inputs";
import { appLogoSrc } from "../../../assets/app-logo";
import { PATHS } from "../../../router/paths.contants";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { requestCompanyPasswordReset, resetCompanyPasswordWithOtp } from "./service";
import { FilterField, FieldControl } from "../../../components/design-system";
import "./ForgotPassword.css";

const CODE_LENGTH = 6;
const MIN_PASSWORD_LEN = 8;

const ForgotPasswordPage: React.FC = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [email, setEmail] = useState("");
    const [code, setCode] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [sending, setSending] = useState(false);
    const [resetting, setResetting] = useState(false);

    const handleSendCode = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = email.trim();
        if (!trimmed) {
            errorToast("Indica un correo electrónico.");
            return;
        }
        setSending(true);
        try {
            const { message } = await requestCompanyPasswordReset(trimmed);
            successToast(message);
            setStep(2);
        } catch (err: unknown) {
            errorToast(err instanceof Error ? err.message : "No se pudo enviar el código");
        } finally {
            setSending(false);
        }
    };

    const handleVerifyCode = (e: React.FormEvent) => {
        e.preventDefault();
        const digitsOnly = code.replace(/\D/g, "");
        if (digitsOnly.length !== CODE_LENGTH) {
            errorToast(`El código debe tener ${CODE_LENGTH} dígitos.`);
            return;
        }
        setStep(3);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password.length < MIN_PASSWORD_LEN) {
            errorToast(`La contraseña debe tener al menos ${MIN_PASSWORD_LEN} caracteres.`);
            return;
        }
        if (password !== confirmPassword) {
            errorToast("Las contraseñas no coinciden.");
            return;
        }
        const digitsOnly = code.replace(/\D/g, "");
        if (digitsOnly.length !== CODE_LENGTH) {
            errorToast(`El código debe tener ${CODE_LENGTH} dígitos.`);
            return;
        }

        setResetting(true);
        try {
            const { message } = await resetCompanyPasswordWithOtp({
                email,
                otp: digitsOnly,
                new_password: password,
            });
            successToast(message);
            navigate(PATHS.LOGIN);
        } catch (err: unknown) {
            errorToast(err instanceof Error ? err.message : "No se pudo actualizar la contraseña");
        } finally {
            setResetting(false);
        }
    };

    const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH);
        setCode(value);
    };

    return (
        <main className="container-scroll">
            <div className="forgot__container">
                <div className="forgot__card">
                    <div className="forgot__header">
                        <img src={appLogoSrc} alt="Logo" className="app-logo" />
                        <h1>Recuperar contraseña</h1>
                        <p>
                            {step === 1 && "Ingresa tu correo y, si está registrado, te enviaremos un código de 6 dígitos."}
                            {step === 2 && "Revisa tu correo e ingresa el código de 6 dígitos (válido unos 15 minutos)."}
                            {step === 3 && "Elige una nueva contraseña segura (mínimo 8 caracteres)."}
                        </p>
                    </div>

                    <div className="forgot__steps">
                        <span className={step >= 1 ? "active" : ""}>1</span>
                        <span className="forgot__steps-line" />
                        <span className={step >= 2 ? "active" : ""}>2</span>
                        <span className="forgot__steps-line" />
                        <span className={step >= 3 ? "active" : ""}>3</span>
                    </div>

                    {step === 1 && (
                        <form className="forgot__form" onSubmit={(e) => void handleSendCode(e)}>
                            <InputComponent
                                label="Correo electrónico"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <button type="submit" className="forgot__btn" disabled={sending}>
                                {sending ? "Enviando…" : "Enviar código"}
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form className="forgot__form" onSubmit={handleVerifyCode}>
                            <FilterField label="Código de 6 dígitos" htmlFor="forgot-code" icon="ri-shield-keyhole-line">
                                <FieldControl
                                    id="forgot-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={CODE_LENGTH}
                                    value={code}
                                    onChange={handleCodeChange}
                                    placeholder="000000"
                                    className="forgot__code-input"
                                />
                            </FilterField>
                            <button type="button" className="forgot__link" onClick={() => setStep(1)}>
                                Cambiar correo
                            </button>
                            <button
                                type="submit"
                                className="forgot__btn"
                                disabled={code.replace(/\D/g, "").length !== CODE_LENGTH}
                            >
                                Continuar
                            </button>
                        </form>
                    )}

                    {step === 3 && (
                        <form className="forgot__form" onSubmit={(e) => void handleChangePassword(e)}>
                            <InputComponent
                                label="Nueva contraseña"
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <InputComponent
                                label="Confirmar contraseña"
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                            />
                            {password && confirmPassword && password !== confirmPassword && (
                                <p className="forgot__error">Las contraseñas no coinciden.</p>
                            )}
                            <button
                                type="button"
                                className="forgot__link"
                                onClick={() => setStep(2)}
                            >
                                Volver al código
                            </button>
                            <button
                                type="submit"
                                className="forgot__btn"
                                disabled={
                                    resetting ||
                                    password.length < MIN_PASSWORD_LEN ||
                                    password !== confirmPassword
                                }
                            >
                                {resetting ? "Guardando…" : "Cambiar contraseña"}
                            </button>
                        </form>
                    )}

                    <hr className="forgot__hr" />
                    <div className="forgot__footer">
                        <NavLink to={PATHS.LOGIN} className="forgot__footer-link">
                            <i className="ri-arrow-left-line" />
                            Volver a iniciar sesión
                        </NavLink>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default ForgotPasswordPage;

import { PATHS } from "../../../router/paths.contants";
import { NavLink } from "react-router-dom";
import InputComponent from "../../../components/ui/inputs/inputs";
import logo from "../../../assets/favicon.png";
import "./index.css";
import { loginService, resendCompanyLogin2fa, verifyCompanyLogin2fa, type CompanyLoginData, type VerifiedSessionPayload } from "./service";
import { useContext, useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AuthContext } from "../../../store/auth.context";
import type { AuthUser } from "../../../store/auth.context";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

const TWOFA_DURATION_MS = 5 * 60 * 1000;
/** Solo se puede reenviar cuando queda este tiempo o menos antes de que caduque el código (último minuto). */
const RESEND_AVAILABLE_MS = 60 * 1000;

const formatMmSs = (totalSeconds: number) => {
    const s = Math.max(0, totalSeconds);
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};

function sessionPayloadToUser(data: CompanyLoginData): AuthUser | null {
    if (data.need_twofa) return null;
    if (data.account === "super_admin" && data.super_admin_id) {
        return {
            id: data.super_admin_id,
            razon_social: `${data.name ?? ""} ${data.last_name ?? ""}`.trim() || "Superadmin",
            role: "super_admin",
            avatar: null,
            company_id: "",
        };
    }
    const isSubUser = data.account === "sub_user" || (data.user_id != null && data.user_name != null && data.razon_social == null);
    if (isSubUser && data.user_id && data.company_id && data.user_name != null && data.role != null) {
        return {
            id: data.user_id,
            razon_social: data.user_name,
            role: "user",
            avatar: data.avatar ?? null,
            company_id: data.company_id,
        };
    }
    if (data.company_id && data.razon_social != null && data.role != null) {
        return {
            id: data.company_id,
            razon_social: data.razon_social,
            role: data.role as AuthUser["role"],
            avatar: data.avatar ?? null,
            company_id: data.company_id,
        };
    }
    return null;
}

function verifiedToUser(payload: VerifiedSessionPayload): AuthUser {
    const sa = payload as Extract<VerifiedSessionPayload, { account: "super_admin" }>;
    if (sa.account === "super_admin" && sa.super_admin_id) {
        return {
            id: sa.super_admin_id,
            razon_social: `${sa.name ?? ""} ${sa.last_name ?? ""}`.trim() || "Superadmin",
            role: "super_admin",
            avatar: null,
            company_id: "",
        };
    }
    const sub = payload as Extract<VerifiedSessionPayload, { user_id: string }>;
    if (sub.user_id && sub.user_name != null) {
        return {
            id: sub.user_id,
            razon_social: sub.user_name,
            role: "user",
            avatar: sub.avatar ?? null,
            company_id: sub.company_id,
        };
    }
    const co = payload as Extract<VerifiedSessionPayload, { razon_social: string }>;
    if (co.company_id && co.razon_social != null && co.role != null) {
        return {
            id: co.company_id,
            razon_social: co.razon_social,
            role: co.role as AuthUser["role"],
            avatar: co.avatar ?? null,
            company_id: co.company_id,
        };
    }
    throw new Error("Respuesta de verificación incompleta.");
}

const LoginPage: React.FC = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const passwordFieldId = useId();
    const [phase, setPhase] = useState<"credentials" | "twofa">("credentials");
    const [twofaCode, setTwofaCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [resendLoading, setResendLoading] = useState(false);
    /** Marca de tiempo (ms) en la que caduca la ventana actual del código (5 min desde envío o reenvío). */
    const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
    const [tick, setTick] = useState(0);
    /** Tras `POST /auth/signin` con 2FA: empresa, subusuario o superadmin (define el cuerpo de verify-2fa). */
    const [twofaAccount, setTwofaAccount] = useState<"company" | "sub_user" | "super_admin">("company");
    const [pendingUserId, setPendingUserId] = useState<string | null>(null);
    const { setUser } = useContext(AuthContext);

    useEffect(() => {
        if (phase !== "twofa" || codeExpiresAt === null) return;
        const id = window.setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, [phase, codeExpiresAt]);

    const remainingMs = useMemo(() => {
        if (codeExpiresAt === null || phase !== "twofa") return 0;
        return Math.max(0, codeExpiresAt - Date.now());
    }, [codeExpiresAt, phase, tick]);

    const remainingSec = Math.ceil(remainingMs / 1000);
    const progressPercent = Math.min(100, (remainingMs / TWOFA_DURATION_MS) * 100);
    const canResend = remainingMs <= RESEND_AVAILABLE_MS;
    /** Segundos hasta que el reenvío quede permitido (mientras quede más de 1 min de validez). */
    const secondsUntilResendUnlock = remainingMs > RESEND_AVAILABLE_MS ? Math.max(0, Math.ceil((remainingMs - RESEND_AVAILABLE_MS) / 1000)) : 0;

    const applyUserAndGo = (next: AuthUser) => {
        setUser(next);
        navigate(next.role === "super_admin" ? PATHS.ADMIN_HOME : PATHS.DASHBOARD);
    };

    const handle_credentials = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setLoading(true);
        try {
            const { message, data } = await loginService({ email, password });

            if (data.need_twofa) {
                const acc = data.account === "sub_user" ? "sub_user" : data.account === "super_admin" ? "super_admin" : "company";
                setTwofaAccount(acc);
                setPendingUserId(acc === "sub_user" && data.user_id ? data.user_id : null);
                successToast(message);
                setPhase("twofa");
                setTwofaCode("");
                setCodeExpiresAt(Date.now() + TWOFA_DURATION_MS);
                return;
            }

            const mapped = sessionPayloadToUser(data);
            if (!mapped) {
                errorToast("Respuesta de inicio de sesión incompleta.");
                return;
            }
            applyUserAndGo(mapped);
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    const handle_twofa = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const code = twofaCode.replace(/\D/g, "").slice(0, 6);
        if (code.length !== 6) {
            errorToast("Introduce el código de 6 dígitos enviado a tu correo.");
            return;
        }

        setLoading(true);
        try {
            const session = twofaAccount === "sub_user" && pendingUserId ? await verifyCompanyLogin2fa({ user_id: pendingUserId, code }) : await verifyCompanyLogin2fa({ email, code });
            applyUserAndGo(verifiedToUser(session));
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "No se pudo verificar el código");
        } finally {
            setLoading(false);
        }
    };

    const handle_resend_2fa = async () => {
        setResendLoading(true);
        try {
            const { message, data } = await resendCompanyLogin2fa({ email, password });
            if (data.account === "sub_user" && data.user_id) {
                setTwofaAccount("sub_user");
                setPendingUserId(data.user_id);
            } else {
                setTwofaAccount("company");
                setPendingUserId(null);
            }
            successToast(message);
            setCodeExpiresAt(Date.now() + TWOFA_DURATION_MS);
            setTwofaCode("");
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "No se pudo reenviar el código");
        } finally {
            setResendLoading(false);
        }
    };

    const back_to_credentials = () => {
        setPhase("credentials");
        setTwofaCode("");
        setCodeExpiresAt(null);
        setTwofaAccount("company");
        setPendingUserId(null);
    };

    return (
        <main className="container-scroll">
            <div className="login__container">
                <div className="login__form">
                    <div className="login_header">
                        <img
                            src={logo}
                            alt="logo"
                        />
                        <h3>Facturación Electrónica | Apps for the World</h3>
                        {phase === "twofa" ? (
                            <p className="login__twofa-hint">
                                Introduce el código de 6 dígitos que enviamos a <strong>{email}</strong>.
                            </p>
                        ) : (
                            <p></p>
                        )}
                    </div>
                    {phase === "credentials" ? (
                        <form
                            className="login__form-content"
                            onSubmit={handle_credentials}
                        >
                            <InputComponent
                                label="Correo electrónico"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <div className="input__container login__password-field">
                                <label htmlFor={passwordFieldId}>Contraseña</label>
                                <div className="login__password-input-wrap">
                                    <input
                                        id={passwordFieldId}
                                        type={showPassword ? "text" : "password"}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="current-password"
                                    />
                                    <button
                                        type="button"
                                        className="login__password-toggle"
                                        onClick={() => setShowPassword((v) => !v)}
                                        aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                                        aria-pressed={showPassword}
                                    >
                                        <i
                                            className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}
                                            aria-hidden="true"
                                        />
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Entrando…" : "Iniciar sesión"}
                            </button>
                        </form>
                    ) : (
                        <form
                            className="login__form-content"
                            onSubmit={handle_twofa}
                        >
                            <div
                                className="login__twofa-timer"
                                aria-live="polite"
                            >
                                <div className="login__twofa-timer-label">
                                    {remainingSec > 0 ? (
                                        <>
                                            Caduca en <span className="login__twofa-timer-digits">{formatMmSs(remainingSec)}</span>
                                        </>
                                    ) : (
                                        <span className="login__twofa-expired">El código ha caducado. Solicita uno nuevo.</span>
                                    )}
                                </div>
                                <div
                                    className="login__twofa-progress-track"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={100}
                                    aria-valuenow={Math.round(progressPercent)}
                                    aria-label="Tiempo restante de validez del código"
                                >
                                    <div
                                        className="login__twofa-progress-fill"
                                        style={{ width: `${progressPercent}%` }}
                                    />
                                </div>
                            </div>
                            <div className="input__container">
                                <label htmlFor="login-twofa-code">Código de verificación</label>
                                <input
                                    id="login-twofa-code"
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete="one-time-code"
                                    maxLength={6}
                                    value={twofaCode}
                                    onChange={(e) => {
                                        const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                                        setTwofaCode(v);
                                    }}
                                    placeholder="000000"
                                    aria-label="Código de 6 dígitos"
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={loading}
                            >
                                {loading ? "Verificando…" : "Verificar e iniciar sesión"}
                            </button>
                            <div className="login__resend-block">
                                {!canResend && remainingSec > 0 ? (
                                    <p
                                        className="login__resend-countdown"
                                        aria-live="polite"
                                    >
                                        Podrás reenviar el código en <span className="login__twofa-timer-digits">{formatMmSs(secondsUntilResendUnlock)}</span>
                                        <span className="login__resend-hint"> </span>
                                    </p>
                                ) : canResend && remainingSec > 0 ? (
                                    <p className="login__resend-ready">Último minuto de validez: ya puedes solicitar un nuevo código.</p>
                                ) : null}
                                <button
                                    type="button"
                                    className="login__resend-2fa"
                                    onClick={() => void handle_resend_2fa()}
                                    disabled={loading || resendLoading || !canResend}
                                >
                                    {resendLoading ? "Enviando…" : "Reenviar código de verificación"}
                                </button>
                            </div>
                            <button
                                type="button"
                                className="login__back-credentials"
                                onClick={back_to_credentials}
                                disabled={loading || resendLoading}
                            >
                                Volver al inicio de sesión
                            </button>
                        </form>
                    )}
                    <hr />
                    <div className="login__form-footer">
                        <p>
                            ¿No tienes una cuenta? <NavLink to={PATHS.REGISTER}>Registrarse</NavLink>
                        </p>
                        <p>
                            ¿Olvidaste tu contraseña? <NavLink to={PATHS.FORGOT_PASSWORD}>Recuperar contraseña</NavLink>
                        </p>
                    </div>
                </div>
            </div>
        </main>
    );
};

export default LoginPage;

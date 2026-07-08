import { useContext, useState } from "react";
import { useNavigate } from "react-router-dom";
import InputComponent from "../../../components/ui/inputs/inputs";
import { appLogoSrc } from "../../../assets/app-logo";
import "../../login/page/index.css";
import Turnstile from "../../login/page/Turnstile";
import { AuthContext, type AuthUser } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { errorToast } from "../../../components/shared/toast/toasts";
import { markSessionHint } from "../../../store/auth.service";
import { contadorSignIn, contadorVerify2FA, contadorSelectCompany, type ContadorEmpresa } from "../contador.service";
import { FilterField, FieldControl } from "../../../components/design-system";

type Phase = "credentials" | "twofa" | "select";

/** Login del contador: credenciales (+ Turnstile/2FA) → selector de empresa → entra como esa empresa. */
const ContadorLogin: React.FC = () => {
    const navigate = useNavigate();
    const { setUser } = useContext(AuthContext);
    const [phase, setPhase] = useState<Phase>("credentials");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [turnstileToken, setTurnstileToken] = useState("");
    const [code, setCode] = useState("");
    const [loading, setLoading] = useState(false);
    const [contadorId, setContadorId] = useState("");
    const [empresas, setEmpresas] = useState<ContadorEmpresa[]>([]);

    const onCredentials = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!turnstileToken) { errorToast("Completa la verificación de seguridad"); return; }
        setLoading(true);
        try {
            const data = await contadorSignIn(email, password, turnstileToken);
            setContadorId(data.contador_id);
            if (data.need_twofa) { setPhase("twofa"); return; }
            setEmpresas(data.empresas ?? []);
            setPhase("select");
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Error al iniciar sesión");
        } finally {
            setLoading(false);
        }
    };

    const onVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            const data = await contadorVerify2FA(email, code);
            setContadorId(data.contador_id);
            setEmpresas(data.empresas ?? []);
            setPhase("select");
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "Código inválido");
        } finally {
            setLoading(false);
        }
    };

    const onSelect = async (company_id: string) => {
        setLoading(true);
        try {
            const data = await contadorSelectCompany(contadorId, company_id);
            const user: AuthUser = { id: data.company_id, razon_social: data.razon_social, role: "company", avatar: data.avatar ?? null, company_id: data.company_id };
            markSessionHint();
            setUser(user);
            navigate(PATHS.DASHBOARD);
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "No se pudo seleccionar la empresa");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login">
            <div className="login__card">
                <div className="login__header">
                    <img src={appLogoSrc} alt="Tecnotics" className="login__logo app-logo" />
                    <h1>Portal del contador</h1>
                    <p>
                        {phase === "credentials" && "Ingresa con tu cuenta de contador"}
                        {phase === "twofa" && "Ingresa el código que enviamos a tu correo"}
                        {phase === "select" && "Elige la empresa que vas a gestionar"}
                    </p>
                </div>

                {phase === "credentials" && (
                    <form className="login__form-content" onSubmit={onCredentials}>
                        <InputComponent label="Correo electrónico" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                        <FilterField label="Contraseña" htmlFor="contador-password" icon="ri-lock-password-line">
                            <div className="ds-password-wrap">
                                <FieldControl
                                    id="contador-password"
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                />
                                <button type="button" className="ds-password-wrap__toggle" onClick={() => setShowPassword((v) => !v)} aria-label="Mostrar/ocultar contraseña">
                                    <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"} aria-hidden="true" />
                                </button>
                            </div>
                        </FilterField>
                        <Turnstile onVerify={setTurnstileToken} onExpire={() => setTurnstileToken("")} />
                        <button type="submit" disabled={loading || !turnstileToken}>{loading ? "Entrando…" : "Iniciar sesión"}</button>
                    </form>
                )}

                {phase === "twofa" && (
                    <form className="login__form-content" onSubmit={onVerify}>
                        <InputComponent label="Código de verificación" type="text" value={code} onChange={(e) => setCode(e.target.value)} icon="ri-shield-keyhole-line" inputMode="numeric" autoComplete="one-time-code" />
                        <button type="submit" disabled={loading || !code}>{loading ? "Verificando…" : "Verificar"}</button>
                    </form>
                )}

                {phase === "select" && (
                    <div className="login__form-content">
                        {empresas.length === 0 ? (
                            <p style={{ textAlign: "center", color: "var(--text-muted)" }}>No tienes empresas asignadas. Contacta al administrador.</p>
                        ) : (
                            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                                {empresas.map((emp) => (
                                    <button
                                        key={emp.company_id}
                                        type="button"
                                        onClick={() => onSelect(emp.company_id)}
                                        disabled={loading}
                                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: "1px solid var(--border-light)", borderRadius: 10, background: "var(--card-bg)", color: "var(--primary-text)", cursor: "pointer", textAlign: "left" }}
                                    >
                                        {emp.avatar ? <img src={emp.avatar} alt="" style={{ width: 32, height: 32, borderRadius: 8, objectFit: "cover" }} /> : <i className="ri-building-line" style={{ fontSize: 24 }} />}
                                        <span style={{ fontWeight: 600 }}>{emp.razon_social}</span>
                                        <i className="ri-arrow-right-line" style={{ marginLeft: "auto" }} />
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ContadorLogin;

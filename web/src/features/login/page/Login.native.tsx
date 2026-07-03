import { useContext, useEffect, useMemo, useState, useCallback } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-dom";
import appLogo from "../../../assets/app-logo";
import { APP_BRAND_NAME } from "../../../utils/global";
import AuthScreenLayout from "../../../components/shared/AuthScreenLayout.native";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext, type AuthUser } from "../../../store/auth.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import { PortalPasswordField, PortalTextField } from "../../../components/shared/PortalField.native";
import PortalOtpInput, { PortalOtpPasteHint } from "../../../components/shared/PortalOtpInput.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
  loginService,
  resendCompanyLogin2fa,
  verifyCompanyLogin2fa,
  type CompanyLoginData,
  type VerifiedSessionPayload,
} from "./service";
const TWOFA_DURATION_MS = 5 * 60 * 1000;
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
  const isSubUser =
    data.account === "sub_user" ||
    (data.user_id != null && data.user_name != null && data.razon_social == null);
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
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [phase, setPhase] = useState<"credentials" | "twofa">("credentials");
  const [twofaCode, setTwofaCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [codeExpiresAt, setCodeExpiresAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [twofaAccount, setTwofaAccount] = useState<"company" | "sub_user" | "super_admin">("company");
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const { setUser, user } = useContext(AuthContext);

  useEffect(() => {
    if (user) {
      navigate(user.role === "super_admin" ? PATHS.ADMIN_HOME : PATHS.DASHBOARD, {
        replace: true,
      });
    }
  }, [user, navigate]);

  useEffect(() => {
    if (phase !== "twofa" || codeExpiresAt === null) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [phase, codeExpiresAt]);

  const remainingMs = useMemo(() => {
    if (codeExpiresAt === null || phase !== "twofa") return 0;
    return Math.max(0, codeExpiresAt - Date.now());
  }, [codeExpiresAt, phase, tick]);

  const remainingSec = Math.ceil(remainingMs / 1000);
  const canResend = remainingMs <= RESEND_AVAILABLE_MS;
  const secondsUntilResendUnlock =
    remainingMs > RESEND_AVAILABLE_MS
      ? Math.max(0, Math.ceil((remainingMs - RESEND_AVAILABLE_MS) / 1000))
      : 0;

  const applyUserAndGo = (next: AuthUser) => {
    setUser(next);
    navigate(next.role === "super_admin" ? PATHS.ADMIN_HOME : PATHS.DASHBOARD);
  };

  const handleCredentials = async () => {
    setLoading(true);
    try {
      const { message, data } = await loginService({ email, password });
      if (data.need_twofa) {
        const acc =
          data.account === "sub_user"
            ? "sub_user"
            : data.account === "super_admin"
              ? "super_admin"
              : "company";
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

  const handleTwofa = async () => {
    const code = twofaCode.replace(/\D/g, "").slice(0, 6);
    if (code.length !== 6) {
      errorToast("Introduce el código de 6 dígitos enviado a tu correo.");
      return;
    }
    setLoading(true);
    try {
      const session =
        twofaAccount === "sub_user" && pendingUserId
          ? await verifyCompanyLogin2fa({ user_id: pendingUserId, code })
          : await verifyCompanyLogin2fa({ email, code });
      applyUserAndGo(verifiedToUser(session));
    } catch (error: unknown) {
      errorToast(error instanceof Error ? error.message : "No se pudo verificar el código");
    } finally {
      setLoading(false);
    }
  };

  const handleResend2fa = async () => {
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

  const handleTwofaCodeChange = useCallback((next: string) => setTwofaCode(next), []);

  return (
    <AuthScreenLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.bgSubtle }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.page}>
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.title, { color: colors.primary }]}>{APP_BRAND_NAME}</Text>

            {phase === "credentials" ? (
              <>
                <PortalTextField
                  icon="mail-outline"
                  label="Correo electrónico"
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  autoComplete="email"
                  placeholder="Correo electrónico"
                />
                <PortalPasswordField
                  label="Contraseña"
                  value={password}
                  onChangeText={setPassword}
                  autoComplete="password"
                  placeholder="Contraseña"
                  showPassword={showPassword}
                  onTogglePassword={() => setShowPassword((v) => !v)}
                />
                <Pressable
                  style={styles.primaryBtn}
                  onPress={() => void handleCredentials()}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Iniciar sesión</Text>
                  )}
                </Pressable>
                <View style={styles.footer}>
                  <Pressable onPress={() => navigate(PATHS.REGISTER)}>
                    <Text style={styles.footerText}>
                      ¿No tienes una cuenta? <Text style={styles.footerLink}>Registrarse</Text>
                    </Text>
                  </Pressable>
                  <Pressable onPress={() => navigate(PATHS.FORGOT_PASSWORD)} style={{ marginTop: 8 }}>
                    <Text style={styles.footerText}>
                      ¿Olvidaste tu contraseña? <Text style={styles.footerLink}>Recuperar contraseña</Text>
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.hint}>Código enviado a {email}</Text>
                <Text style={styles.timer}>
                  {remainingSec > 0 ? `Caduca en ${formatMmSs(remainingSec)}` : "El código ha caducado"}
                </Text>
                <PortalOtpInput
                  value={twofaCode}
                  onChange={handleTwofaCodeChange}
                  disabled={loading}
                  autoFocus
                  style={{ marginBottom: 8 }}
                />
                <PortalOtpPasteHint disabled={loading} />
                <Pressable style={styles.primaryBtn} onPress={() => void handleTwofa()} disabled={loading}>
                  {loading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.primaryBtnText}>Verificar e iniciar sesión</Text>
                  )}
                </Pressable>
                {!canResend && remainingSec > 0 ? (
                  <Text style={styles.hint}>Reenvío en {formatMmSs(secondsUntilResendUnlock)}</Text>
                ) : null}
                <Pressable
                  style={styles.secondaryBtn}
                  onPress={() => void handleResend2fa()}
                  disabled={loading || resendLoading || !canResend}
                >
                  <Text style={styles.secondaryBtnText}>
                    {resendLoading ? "Enviando…" : "Reenviar código"}
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.linkBtn}
                  onPress={() => {
                    setPhase("credentials");
                    setTwofaCode("");
                    setCodeExpiresAt(null);
                  }}
                >
                  <Text style={styles.linkText}>Volver al inicio de sesión</Text>
                </Pressable>
              </>
            )}
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthScreenLayout>
  );
};

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24 },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: { width: 72, height: 72, alignSelf: "center", marginBottom: 12 },
  title: { fontSize: 17, fontWeight: "700", color: "#002737", textAlign: "center", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#334155", marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderColor: "#cbd5e1",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: "#fff",
  },
  passwordRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  passwordInput: { flex: 1 },
  eyeBtn: { padding: 8 },
  eyeText: { color: "#0077b6", fontWeight: "600" },
  primaryBtn: {
    marginTop: 20,
    backgroundColor: "#002737",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  secondaryBtn: { marginTop: 12, paddingVertical: 10, alignItems: "center" },
  secondaryBtnText: { color: "#0077b6", fontWeight: "600" },
  linkBtn: { marginTop: 8, alignItems: "center" },
  linkText: { color: "#64748b" },
  hint: { fontSize: 13, color: "#64748b", marginTop: 8, textAlign: "center" },
  timer: { fontSize: 15, fontWeight: "600", color: "#002737", textAlign: "center", marginVertical: 8 },
  footer: { marginTop: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: "#e2e8f0", alignItems: "center" },
  footerText: { fontSize: 14, color: "#64748b", textAlign: "center" },
  footerLink: { color: "#0077b6", fontWeight: "600" },
});

export default LoginPage;

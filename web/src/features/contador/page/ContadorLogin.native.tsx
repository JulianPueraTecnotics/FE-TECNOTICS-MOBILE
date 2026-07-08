import { useContext, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-dom";
import { PortalPasswordField, PortalTextField } from "../../../components/shared/PortalField.native";
import appLogo from "../../../assets/app-logo";
import { APP_BRAND_NAME } from "../../../utils/global";
import { AuthContext, type AuthUser } from "../../../store/auth.context";
import { markSessionHint } from "../../../store/auth.service";
import { PATHS } from "../../../router/paths.contants";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import AuthScreenLayout from "../../../components/shared/AuthScreenLayout.native";
import Turnstile from "../../login/page/Turnstile";
import { contadorSelectCompany, contadorSignIn, contadorVerify2FA, type ContadorEmpresa } from "../../contador/contador.service";

type Phase = "credentials" | "twofa" | "select";

export default function ContadorLoginNative() {
  const colors = useThemeColors();
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

  const onCredentials = async () => {
    if (!turnstileToken) {
      errorToast("Completa la verificación de seguridad");
      return;
    }
    setLoading(true);
    try {
      console.log("[ContadorLogin] turnstileToken en estado antes de enviar:", turnstileToken);
      const data = await contadorSignIn(email.trim(), password, turnstileToken);
      setContadorId(data.contador_id);
      if (data.need_twofa) {
        setPhase("twofa");
        return;
      }
      setEmpresas(data.empresas ?? []);
      setPhase("select");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  const onVerify = async () => {
    setLoading(true);
    try {
      const data = await contadorVerify2FA(email.trim(), code.trim());
      setContadorId(data.contador_id);
      setEmpresas(data.empresas ?? []);
      setPhase("select");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setLoading(false);
    }
  };

  const onSelect = async (companyId: string) => {
    setLoading(true);
    try {
      const data = await contadorSelectCompany(contadorId, companyId);
      const user: AuthUser = {
        id: data.company_id,
        razon_social: data.razon_social,
        role: "company",
        avatar: data.avatar ?? null,
        company_id: data.company_id,
      };
      markSessionHint();
      setUser(user);
      successToast(`Sesión iniciada como ${data.razon_social}`);
      navigate(PATHS.DASHBOARD);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo seleccionar la empresa");
    } finally {
      setLoading(false);
    }
  };

  if (phase === "select" || phase === "twofa") {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.pageBg }}
        contentContainerStyle={styles.pad}
        keyboardShouldPersistTaps="handled"
      >
        <Image source={appLogo} style={styles.logo} resizeMode="cover" />
        <Text style={[styles.brand, { color: colors.primary }]}>{APP_BRAND_NAME}</Text>
        <Text style={[styles.title, { color: colors.primary }]}>Portal del contador</Text>

        {phase === "twofa" ? (
          <>
            <PortalTextField
              icon="keypad-outline"
              placeholder="Código 2FA"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
            />
            <Pressable onPress={onVerify} disabled={loading} style={[styles.btn, { backgroundColor: colors.accent }]}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verificar</Text>}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: 12 }}>Selecciona empresa:</Text>
            {empresas.map((e) => (
              <Pressable
                key={e.company_id}
                onPress={() => onSelect(e.company_id)}
                disabled={loading}
                style={[styles.company, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
              >
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{e.razon_social}</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    );
  }

  return (
    <AuthScreenLayout>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.pageBg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.page}>
          <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <Image source={appLogo} style={styles.logo} resizeMode="contain" />
            <Text style={[styles.brand, { color: colors.primary }]}>{APP_BRAND_NAME}</Text>
            <Text style={[styles.title, { color: colors.primary }]}>Portal del contador</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              Ingresa y elige la empresa a administrar.
            </Text>

            <PortalTextField
              icon="mail-outline"
              placeholder="Correo"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <PortalPasswordField
              icon="lock-closed-outline"
              placeholder="Contraseña"
              value={password}
              onChangeText={setPassword}
              showPassword={showPassword}
              onTogglePassword={() => setShowPassword((s) => !s)}
            />
            <View style={styles.turnstileWrap} collapsable={false}>
              <Turnstile
                onVerify={(token) => {
                  console.log("[ContadorLogin] captcha onVerify token:", token);
                  setTurnstileToken(token);
                }}
                onExpire={() => {
                  console.log("[ContadorLogin] captcha onExpire: token limpiado");
                  setTurnstileToken("");
                }}
              />
            </View>
            <Pressable
              onPress={onCredentials}
              disabled={loading || !turnstileToken}
              style={[styles.btn, { backgroundColor: colors.accent, opacity: loading || !turnstileToken ? 0.5 : 1 }]}
            >
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Ingresar</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </AuthScreenLayout>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, justifyContent: "center", padding: 24 },
  pad: { padding: 24, paddingTop: 48, alignItems: "center" },
  card: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  logo: { width: 64, height: 64, borderRadius: 8, marginBottom: 8, alignSelf: "center" },
  brand: { fontSize: 17, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, textAlign: "center" },
  subtitle: { fontSize: 14, marginBottom: 16, textAlign: "center" },
  turnstileWrap: { width: "100%", minHeight: 140, marginBottom: 8 },
  btn: { paddingVertical: 14, borderRadius: SHELL_RADIUS.button, alignItems: "center", marginTop: 4 },
  btnText: { color: "#fff", fontWeight: "700" },
  company: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10, alignSelf: "stretch" },
});

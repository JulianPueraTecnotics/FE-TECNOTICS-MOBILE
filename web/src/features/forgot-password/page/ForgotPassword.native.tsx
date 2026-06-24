import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate } from "react-router-dom";
import PortalOtpInput from "../../../components/shared/PortalOtpInput.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { PATHS } from "../../../router/paths.contants";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import {
  requestCompanyPasswordReset,
  resetCompanyPasswordWithOtp,
} from "./service";

const CODE_LENGTH = 6;
const MIN_PASSWORD_LEN = 8;

export default function ForgotPasswordNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [sending, setSending] = useState(false);
  const [resetting, setResetting] = useState(false);

  const handleSendCode = async () => {
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

  const handleVerifyCode = () => {
    const digitsOnly = code.replace(/\D/g, "");
    if (digitsOnly.length !== CODE_LENGTH) {
      errorToast(`El código debe tener ${CODE_LENGTH} dígitos.`);
      return;
    }
    setStep(3);
  };

  const handleChangePassword = async () => {
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>Recuperar contraseña</Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {step === 1 && "Ingresa tu correo y te enviaremos un código de 6 dígitos."}
            {step === 2 && "Revisa tu correo e ingresa el código (válido unos 15 minutos)."}
            {step === 3 && "Elige una nueva contraseña segura (mínimo 8 caracteres)."}
          </Text>

          <View style={styles.steps}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[
                  styles.stepDot,
                  step >= n
                    ? { backgroundColor: colors.accent }
                    : { backgroundColor: colors.bgSubtle, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.stepNum, { color: step >= n ? "#fff" : colors.textMuted }]}>
                  {n}
                </Text>
              </View>
            ))}
          </View>

          {step === 1 ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Correo electrónico</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
              />
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={() => void handleSendCode()}
                disabled={sending}
              >
                {sending ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Enviar código</Text>
                )}
              </Pressable>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Código de 6 dígitos</Text>
              <PortalOtpInput value={code} onChange={setCode} length={CODE_LENGTH} />
              <Pressable onPress={() => setStep(1)}>
                <Text style={[styles.link, { color: colors.accent }]}>Cambiar correo</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={handleVerifyCode}
                disabled={code.replace(/\D/g, "").length !== CODE_LENGTH}
              >
                <Text style={styles.btnText}>Continuar</Text>
              </Pressable>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <Text style={[styles.label, { color: colors.textMuted }]}>Nueva contraseña</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
              />
              <Text style={[styles.label, { color: colors.textMuted }]}>Confirmar contraseña</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <Pressable onPress={() => setStep(2)}>
                <Text style={[styles.link, { color: colors.accent }]}>Volver al código</Text>
              </Pressable>
              <Pressable
                style={[styles.btn, { backgroundColor: colors.accent }]}
                onPress={() => void handleChangePassword()}
                disabled={
                  resetting ||
                  password.length < MIN_PASSWORD_LEN ||
                  password !== confirmPassword
                }
              >
                {resetting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.btnText}>Cambiar contraseña</Text>
                )}
              </Pressable>
            </>
          ) : null}

          <Pressable onPress={() => navigate(PATHS.LOGIN)} style={styles.footerLink}>
            <Text style={[styles.link, { color: colors.accent }]}>Volver a iniciar sesión</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, padding: 20, justifyContent: "center" },
  card: {
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 22,
    gap: 12,
  },
  title: { fontSize: 22, fontWeight: "700", textAlign: "center" },
  subtitle: { fontSize: 14, lineHeight: 20, textAlign: "center", marginBottom: 8 },
  steps: { flexDirection: "row", justifyContent: "center", gap: 8, marginVertical: 8 },
  stepDot: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  stepNum: { fontWeight: "700", fontSize: 14 },
  label: { fontSize: 13, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  btn: {
    borderRadius: SHELL_RADIUS.button,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  link: { fontSize: 14, fontWeight: "600", textAlign: "center" },
  footerLink: { marginTop: 12 },
});

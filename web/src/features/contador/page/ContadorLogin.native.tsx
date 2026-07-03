import { useContext, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigate } from "react-router-dom";
import appLogo from "../../../assets/app-logo";
import { APP_BRAND_NAME } from "../../../utils/global";
import { AuthContext } from "../../../store/auth.context";
import { PATHS } from "../../../router/paths.contants";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { contadorSelectCompany, contadorSignIn, contadorVerify2FA, type ContadorEmpresa } from "../../contador/contador.service";

type Phase = "credentials" | "twofa" | "select";

export default function ContadorLoginNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const { setUser } = useContext(AuthContext);
  const [phase, setPhase] = useState<Phase>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [contadorId, setContadorId] = useState("");
  const [empresas, setEmpresas] = useState<ContadorEmpresa[]>([]);

  const onCredentials = async () => {
    setLoading(true);
    try {
      const data = await contadorSignIn(email.trim(), password);
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
      setUser({
        account: "company",
        company_id: data.company_id,
        razon_social: data.razon_social,
        role: "company",
        avatar: data.avatar,
      });
      successToast(`Sesión iniciada como ${data.razon_social}`);
      navigate(PATHS.DASHBOARD);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo seleccionar la empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pageBg }} contentContainerStyle={styles.pad} keyboardShouldPersistTaps="handled">
      <Image source={appLogo} style={styles.logo} resizeMode="cover" />
      <Text style={[styles.brand, { color: colors.primary }]}>{APP_BRAND_NAME}</Text>
      <Text style={[styles.title, { color: colors.primary }]}>Portal del contador</Text>
      <Text style={{ color: colors.textMuted, marginBottom: 20 }}>Ingresa y elige la empresa a administrar.</Text>

      {phase === "credentials" ? (
        <>
          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.primary }]} placeholder="Correo" placeholderTextColor={colors.textMuted} autoCapitalize="none" value={email} onChangeText={setEmail} />
          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.primary }]} placeholder="Contraseña" placeholderTextColor={colors.textMuted} secureTextEntry value={password} onChangeText={setPassword} />
          <Pressable onPress={onCredentials} disabled={loading} style={[styles.btn, { backgroundColor: colors.accent, opacity: loading ? 0.5 : 1 }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Ingresar</Text>}
          </Pressable>
        </>
      ) : null}

      {phase === "twofa" ? (
        <>
          <TextInput style={[styles.input, { borderColor: colors.border, color: colors.primary }]} placeholder="Código 2FA" placeholderTextColor={colors.textMuted} value={code} onChangeText={setCode} keyboardType="number-pad" />
          <Pressable onPress={onVerify} disabled={loading} style={[styles.btn, { backgroundColor: colors.accent }]}>
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>Verificar</Text>}
          </Pressable>
        </>
      ) : null}

      {phase === "select" ? (
        <>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>Selecciona empresa:</Text>
          {empresas.map((e) => (
            <Pressable key={e.company_id} onPress={() => onSelect(e.company_id)} disabled={loading} style={[styles.company, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>{e.razon_social}</Text>
            </Pressable>
          ))}
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  pad: { padding: 24, paddingTop: 48, alignItems: "center" },
  logo: { width: 64, height: 64, borderRadius: 8, marginBottom: 8 },
  brand: { fontSize: 17, fontWeight: "700", marginBottom: 4, textAlign: "center" },
  title: { fontSize: 20, fontWeight: "700", marginBottom: 8, alignSelf: "stretch" },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12, fontSize: 16, alignSelf: "stretch" },
  btn: { paddingVertical: 14, borderRadius: SHELL_RADIUS.button, alignItems: "center", marginTop: 8, alignSelf: "stretch" },
  btnText: { color: "#fff", fontWeight: "700" },
  company: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10, alignSelf: "stretch" },
});

import { useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { adminCreateAdmin, adminListAdmins, type AdminAccount } from "../services/admin_companies.service";

const emptyForm = { name: "", last_name: "", email: "", password: "" };

export default function AdminAdminsNative() {
  const colors = useThemeColors();
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    adminListAdmins()
      .then(setAdmins)
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error al listar"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => { load(); }, []);

  const submit = async () => {
    if (!form.name.trim() || !form.last_name.trim() || !form.email.trim()) {
      return errorToast("Nombre, apellido y correo son obligatorios");
    }
    if (form.password.length < 8) return errorToast("Contraseña mínimo 8 caracteres");
    setSaving(true);
    try {
      await adminCreateAdmin({
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
      });
      successToast("Administrador creado");
      setShowCreate(false);
      setForm(emptyForm);
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <DsModuleScreen
        title="Administradores"
        subtitle={`${admins.length} cuenta(s)`}
        loading={loading && admins.length === 0}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        headerActions={<DsButton label="Nuevo" icon="add" compact onPress={() => setShowCreate(true)} />}
      >
        {admins.map((a) => (
          <View key={a._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
            <Text style={{ color: colors.primary, fontWeight: "700" }}>{a.name} {a.last_name}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{a.email}</Text>
          </View>
        ))}
      </DsModuleScreen>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.overlay}>
          <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
            <Text style={[styles.modalTitle, { color: colors.primary }]}>Nuevo administrador</Text>
            {(["name", "last_name", "email", "password"] as const).map((k) => (
              <TextInput
                key={k}
                style={[styles.input, { color: colors.primary, borderColor: colors.border }]}
                placeholder={k === "name" ? "Nombre" : k === "last_name" ? "Apellido" : k === "email" ? "Correo" : "Contraseña"}
                placeholderTextColor={colors.textMuted}
                secureTextEntry={k === "password"}
                autoCapitalize={k === "email" ? "none" : "words"}
                value={form[k]}
                onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
              />
            ))}
            <View style={styles.modalActions}>
              <Pressable onPress={() => setShowCreate(false)} style={[styles.btn, { borderColor: colors.border }]}>
                <Text style={{ color: colors.textMuted }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={submit} disabled={saving} style={[styles.btn, { backgroundColor: colors.headerAccent }]}>
                <Text style={{ color: "#fff", fontWeight: "600" }}>{saving ? "…" : "Crear"}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: SHELL_RADIUS.button, alignItems: "center", borderWidth: 1 },
});

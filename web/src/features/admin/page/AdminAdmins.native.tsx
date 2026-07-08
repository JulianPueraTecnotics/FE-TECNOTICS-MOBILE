import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DsButton, DsField, DsModuleScreen, DsSideModal } from "../../../components/design-system-native";
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

      <DsSideModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        title="Nuevo administrador"
        icon="shield-outline"
        closeDisabled={saving}
        submitting={saving}
        submitLabel="Crear"
        onSubmit={() => void submit()}
      >
        <DsField label="Nombre" icon="person-outline" placeholder="Nombre" autoCapitalize="words" value={form.name} onChangeText={(v) => setForm((f) => ({ ...f, name: v }))} />
        <DsField label="Apellido" icon="person-outline" placeholder="Apellido" autoCapitalize="words" value={form.last_name} onChangeText={(v) => setForm((f) => ({ ...f, last_name: v }))} />
        <DsField label="Correo" icon="mail-outline" placeholder="Correo" autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(v) => setForm((f) => ({ ...f, email: v }))} />
        <DsField label="Contraseña" icon="lock-closed-outline" placeholder="Contraseña" secureTextEntry value={form.password} onChangeText={(v) => setForm((f) => ({ ...f, password: v }))} />
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
});


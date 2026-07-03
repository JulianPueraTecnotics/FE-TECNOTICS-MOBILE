import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { adminListCompanies, type AdminCompanyListItem } from "../services/admin_companies.service";
import { adminCreateContador, adminDeleteContador, adminListContadores, adminUpdateContador, type ContadorRow } from "../../contador/contador.service";

const emptyForm = { name: "", last_name: "", email: "", password: "" };

export default function AdminContadoresNative() {
  const colors = useThemeColors();
  const [rows, setRows] = useState<ContadorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [companies, setCompanies] = useState<AdminCompanyListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    adminListContadores()
      .then(setRows)
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!showCreate) return;
    adminListCompanies({ page: 1, limit: 200 })
      .then((r) => setCompanies(r.companies))
      .catch(() => setCompanies([]));
  }, [showCreate]);

  const submit = async () => {
    if (!form.name.trim() || !form.email.trim() || form.password.length < 8) {
      return errorToast("Completa nombre, correo y contraseña (mín. 8)");
    }
    if (selected.size === 0) return errorToast("Asigna al menos una empresa");
    setSaving(true);
    try {
      await adminCreateContador({
        name: form.name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim(),
        password: form.password,
        companies_assigned: [...selected],
      });
      successToast("Contador creado");
      setShowCreate(false);
      setForm(emptyForm);
      setSelected(new Set());
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = (c: ContadorRow) => {
    Alert.alert(c.active ? "Desactivar" : "Activar", c.email, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          try {
            await adminUpdateContador(c._id, { active: !c.active });
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const onDelete = (c: ContadorRow) => {
    Alert.alert("Eliminar contador", c.email, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeleteContador(c._id);
            successToast("Eliminado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  return (
    <>
      <DsModuleScreen
        title="Contadores"
        subtitle={`${rows.length} registrado(s)`}
        loading={loading && rows.length === 0}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        headerActions={<DsButton label="Nuevo" icon="add" compact onPress={() => setShowCreate(true)} />}
      >
        {rows.map((c) => (
          <View key={c._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
            <Text style={{ fontWeight: "700", color: colors.primary }}>{c.name} {c.last_name}</Text>
            <Text style={{ color: colors.textMuted }}>{c.email}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
              {c.empresas ?? 0} empresa(s) · {c.active ? "Activo" : "Inactivo"}
            </Text>
            <View style={{ flexDirection: "row", gap: 12, marginTop: 10 }}>
              <Pressable onPress={() => toggleActive(c)}><Text style={{ color: colors.headerAccent }}>{c.active ? "Desactivar" : "Activar"}</Text></Pressable>
              <Pressable onPress={() => onDelete(c)}><Text style={{ color: "#c0392b" }}>Eliminar</Text></Pressable>
            </View>
          </View>
        ))}
      </DsModuleScreen>

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
              <Text style={[styles.modalTitle, { color: colors.primary }]}>Nuevo contador</Text>
              {(["name", "last_name", "email", "password"] as const).map((k) => (
                <TextInput
                  key={k}
                  style={[styles.input, { color: colors.primary, borderColor: colors.border }]}
                  placeholder={k === "name" ? "Nombre" : k === "last_name" ? "Apellido" : k === "email" ? "Correo" : "Contraseña"}
                  secureTextEntry={k === "password"}
                  value={form[k]}
                  onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
                />
              ))}
              <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Empresas ({selected.size})</Text>
              {companies.map((co) => (
                <Pressable key={co._id} onPress={() => setSelected((s) => { const n = new Set(s); n.has(co._id) ? n.delete(co._id) : n.add(co._id); return n; })} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: selected.has(co._id) ? colors.headerAccent : colors.primary }}>{selected.has(co._id) ? "✓ " : ""}{co.razon_social}</Text>
                </Pressable>
              ))}
              <View style={styles.modalActions}>
                <Pressable onPress={() => setShowCreate(false)} style={[styles.btn, { borderColor: colors.border }]}><Text style={{ color: colors.textMuted }}>Cancelar</Text></Pressable>
                <Pressable onPress={submit} disabled={saving} style={[styles.btn, { backgroundColor: colors.headerAccent }]}><Text style={{ color: "#fff" }}>{saving ? "…" : "Crear"}</Text></Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, maxHeight: "90%" },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 12 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: SHELL_RADIUS.button, alignItems: "center", borderWidth: 1 },
});

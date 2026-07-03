import { useEffect, useState } from "react";
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import {
  adminCreatePlan,
  adminDeletePlan,
  adminListPlans,
  adminUpdatePlan,
  type AdminPlan,
  type AdminPlanBody,
} from "../services/admin_companies.service";

const formatCOP = (n?: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n ?? 0);

type FormState = {
  title: string;
  description: string;
  price: string;
  include_documents: string;
  type: "1year" | "trial2days";
  is_public: boolean;
  features: string;
};

const emptyForm: FormState = { title: "", description: "", price: "", include_documents: "", type: "1year", is_public: false, features: "" };

export default function AdminPlansNative() {
  const colors = useThemeColors();
  const [plans, setPlans] = useState<AdminPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AdminPlan | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    adminListPlans()
      .then(setPlans)
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error"))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (p: AdminPlan) => {
    setEditing(p);
    setForm({
      title: p.title,
      description: p.description,
      price: String(p.price),
      include_documents: String(p.include_documents),
      type: p.type,
      is_public: Boolean(p.is_public),
      features: (p.features ?? []).join("\n"),
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditing(null);
    setForm(emptyForm);
  };

  const submit = async () => {
    if (!form.title.trim()) return errorToast("Título obligatorio");
    const price = Number(form.price);
    const docs = Number(form.include_documents);
    if (!Number.isFinite(price) || price < 0) return errorToast("Precio inválido");
    if (!Number.isFinite(docs) || docs < 0) return errorToast("Documentos inválido");

    const body: AdminPlanBody = {
      title: form.title.trim(),
      description: form.description.trim(),
      price,
      include_documents: docs,
      type: form.type,
      is_public: form.is_public,
      features: form.features.split("\n").map((f) => f.trim()).filter(Boolean),
    };

    setSaving(true);
    try {
      if (editing) await adminUpdatePlan(editing._id, body);
      else await adminCreatePlan(body);
      successToast(editing ? "Plan actualizado" : "Plan creado");
      closeModal();
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (p: AdminPlan) => {
    Alert.alert("Eliminar plan", `¿Eliminar "${p.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await adminDeletePlan(p._id);
            successToast("Plan eliminado");
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
        title="Planes"
        subtitle={`${plans.length} plan(es)`}
        loading={loading && plans.length === 0}
        refreshing={refreshing}
        onRefresh={() => load(true)}
        headerActions={<DsButton label="Nuevo plan" icon="add" compact onPress={openCreate} />}
      >
        {plans.map((p) => (
          <View key={p._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 16 }}>{p.title}</Text>
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>{formatCOP(p.price)} · {p.include_documents} docs</Text>
            <View style={styles.row}>
              <Pressable onPress={() => openEdit(p)}><Text style={{ color: colors.headerAccent }}>Editar</Text></Pressable>
              <Pressable onPress={() => onDelete(p)}><Text style={{ color: "#c0392b" }}>Eliminar</Text></Pressable>
            </View>
          </View>
        ))}
      </DsModuleScreen>

      <Modal visible={showModal} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={styles.overlay}>
          <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "flex-end" }}>
            <View style={[styles.modal, { backgroundColor: colors.cardBg }]}>
              <Text style={[styles.modalTitle, { color: colors.primary }]}>{editing ? "Editar plan" : "Nuevo plan"}</Text>
              <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border }]} placeholder="Título" placeholderTextColor={colors.textMuted} value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
              <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border }]} placeholder="Descripción" placeholderTextColor={colors.textMuted} value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
              <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border }]} placeholder="Precio COP" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v.replace(/[^\d]/g, "") }))} />
              <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border }]} placeholder="Documentos incluidos" placeholderTextColor={colors.textMuted} keyboardType="number-pad" value={form.include_documents} onChangeText={(v) => setForm((f) => ({ ...f, include_documents: v.replace(/[^\d]/g, "") }))} />
              <View style={styles.switchRow}>
                <Text style={{ color: colors.primary }}>Público en web</Text>
                <Switch value={form.is_public} onValueChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
              </View>
              <TextInput style={[styles.input, styles.area, { color: colors.primary, borderColor: colors.border }]} placeholder="Características (una por línea)" placeholderTextColor={colors.textMuted} multiline value={form.features} onChangeText={(v) => setForm((f) => ({ ...f, features: v }))} />
              <View style={styles.modalActions}>
                <Pressable onPress={closeModal} style={[styles.btn, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.textMuted }}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={submit} disabled={saving} style={[styles.btn, { backgroundColor: colors.headerAccent }]}>
                  <Text style={{ color: "#fff", fontWeight: "600" }}>{saving ? "…" : "Guardar"}</Text>
                </Pressable>
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
  row: { flexDirection: "row", gap: 16, marginTop: 10 },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)" },
  modal: { borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 20, paddingBottom: 32 },
  modalTitle: { fontSize: 18, fontWeight: "700", marginBottom: 16 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, fontSize: 15 },
  area: { minHeight: 80, textAlignVertical: "top" },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 12, borderRadius: SHELL_RADIUS.button, alignItems: "center", borderWidth: 1 },
});

import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { DsButton, DsField, DsModuleScreen, DsSideModal } from "../../../components/design-system-native";
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

      <DsSideModal
        visible={showModal}
        onClose={closeModal}
        title={editing ? "Editar plan" : "Nuevo plan"}
        icon="pricetag-outline"
        closeDisabled={saving}
        submitting={saving}
        onSubmit={() => void submit()}
      >
        <DsField label="Título" icon="create-outline" placeholder="Título" value={form.title} onChangeText={(v) => setForm((f) => ({ ...f, title: v }))} />
        <DsField label="Descripción" icon="document-text-outline" placeholder="Descripción" value={form.description} onChangeText={(v) => setForm((f) => ({ ...f, description: v }))} />
        <DsField label="Precio COP" icon="cash-outline" placeholder="Precio COP" keyboardType="number-pad" value={form.price} onChangeText={(v) => setForm((f) => ({ ...f, price: v.replace(/[^\d]/g, "") }))} />
        <DsField label="Documentos incluidos" icon="documents-outline" placeholder="Documentos incluidos" keyboardType="number-pad" value={form.include_documents} onChangeText={(v) => setForm((f) => ({ ...f, include_documents: v.replace(/[^\d]/g, "") }))} />
        <View style={styles.switchRow}>
          <Text style={{ color: colors.primaryText }}>Público en web</Text>
          <Switch value={form.is_public} onValueChange={(v) => setForm((f) => ({ ...f, is_public: v }))} />
        </View>
        <DsField label="Características (una por línea)" icon="list-outline" placeholder="Características (una por línea)" multiline value={form.features} onChangeText={(v) => setForm((f) => ({ ...f, features: v }))} />
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
  row: { flexDirection: "row", gap: 16, marginTop: 10 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
});


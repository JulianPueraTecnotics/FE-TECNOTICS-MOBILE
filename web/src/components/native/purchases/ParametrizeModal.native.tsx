import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import type { SupplierItem } from "../../../features/purchases/supplierItems.service";

type Props = {
  visible: boolean;
  item: SupplierItem | null;
  onClose: () => void;
  onSave: (params: {
    cuenta_gasto_costo?: { niif: string; colgaap: string };
    cuenta_por_pagar?: { niif: string; colgaap: string };
    cuenta_iva?: { niif: string; colgaap: string };
    cuenta_retefuente?: { niif: string; colgaap: string };
    retefuente: number;
  }) => Promise<void>;
};

export default function ParametrizeModalNative({ visible, item, onClose, onSave }: Props) {
  const colors = useThemeColors();
  const [form, setForm] = useState({ gasto: "", cxp: "", iva: "", retefuente_cta: "", retefuente: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !item) return;
    setForm({
      gasto: item.params?.cuenta_gasto_costo?.niif ?? "",
      cxp: item.params?.cuenta_por_pagar?.niif ?? "",
      iva: item.params?.cuenta_iva?.niif ?? "",
      retefuente_cta: item.params?.cuenta_retefuente?.niif ?? "",
      retefuente: item.params?.retefuente != null ? String(item.params.retefuente) : "",
    });
  }, [visible, item]);

  if (!item) return null;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        cuenta_gasto_costo: form.gasto ? { niif: form.gasto, colgaap: form.gasto } : undefined,
        cuenta_por_pagar: form.cxp ? { niif: form.cxp, colgaap: form.cxp } : undefined,
        cuenta_iva: form.iva ? { niif: form.iva, colgaap: form.iva } : undefined,
        cuenta_retefuente: form.retefuente_cta
          ? { niif: form.retefuente_cta, colgaap: form.retefuente_cta }
          : undefined,
        retefuente: Number(form.retefuente) || 0,
      });
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = [styles.input, { borderColor: colors.border, backgroundColor: colors.cardBg, color: colors.primaryText }];

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={colors.primaryText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Parametrizar — {item.codigo}</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.desc, { color: colors.textMuted }]}>{item.descripcion}</Text>

          {item.ai_suggestion ? (
            <View style={[styles.aiBox, { backgroundColor: colors.bgSubtle }]}>
              <Text style={{ color: colors.primaryText, fontSize: 13 }}>
                IA sugiere: gasto {item.ai_suggestion.cuenta_gasto_costo?.codigo ?? "—"}, CxP{" "}
                {item.ai_suggestion.cuenta_por_pagar?.codigo ?? "—"}, retef{" "}
                {item.ai_suggestion.retefuente_porcentaje ?? 0}%
              </Text>
            </View>
          ) : null}

          <Field label="Cuenta gasto/costo *" colors={colors}>
            <TextInput style={inputStyle} value={form.gasto} onChangeText={(v) => setForm((f) => ({ ...f, gasto: v }))} placeholder="513595" placeholderTextColor={colors.textMuted} />
          </Field>
          <Field label="Cuenta por pagar *" colors={colors}>
            <TextInput style={inputStyle} value={form.cxp} onChangeText={(v) => setForm((f) => ({ ...f, cxp: v }))} placeholder="220505" placeholderTextColor={colors.textMuted} />
          </Field>
          <Field label="Cuenta IVA" colors={colors}>
            <TextInput style={inputStyle} value={form.iva} onChangeText={(v) => setForm((f) => ({ ...f, iva: v }))} placeholder="240810" placeholderTextColor={colors.textMuted} />
          </Field>
          <Field label="Cuenta retefuente" colors={colors}>
            <TextInput style={inputStyle} value={form.retefuente_cta} onChangeText={(v) => setForm((f) => ({ ...f, retefuente_cta: v }))} placeholder="236540" placeholderTextColor={colors.textMuted} />
          </Field>
          <Field label="Retefuente (%)" colors={colors}>
            <TextInput style={inputStyle} value={form.retefuente} onChangeText={(v) => setForm((f) => ({ ...f, retefuente: v }))} keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} />
          </Field>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            El estado pasa a Listo cuando tiene cuenta de gasto y de por pagar.
          </Text>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={onClose} disabled={saving}>
            <Text style={{ color: colors.primaryText }}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void save()}
            disabled={saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Guardar</Text>}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Field({
  label,
  colors,
  children,
}: {
  label: string;
  colors: ReturnType<typeof useThemeColors>;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.primary }]}>{label}</Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  desc: { fontSize: 14, lineHeight: 20 },
  aiBox: { borderRadius: 10, padding: 12 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  hint: { fontSize: 12, lineHeight: 18 },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnGhost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});

import { Ionicons } from "@expo/vector-icons";
import { Picker } from "@react-native-picker/picker";
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
import type { Supplier } from "../purchases.types";

type Props = {
  visible: boolean;
  supplier: Supplier | null;
  onClose: () => void;
  onSave: (payload: Partial<Supplier>) => Promise<void>;
};

const empty = {
  name: "",
  doc_number: "",
  email: "",
  phone: "",
  address: "",
  banco: "",
  tipo_cuenta: "",
  numero_cuenta: "",
};

export default function SupplierModalNative({ visible, supplier, onClose, onSave }: Props) {
  const colors = useThemeColors();
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (supplier) {
      setForm({
        name: supplier.name ?? "",
        doc_number: supplier.doc_number ?? "",
        email: supplier.email ?? "",
        phone: supplier.phone ?? "",
        address: supplier.address?.value ?? "",
        banco: supplier.bank?.banco ?? "",
        tipo_cuenta: supplier.bank?.tipo_cuenta ?? "",
        numero_cuenta: supplier.bank?.numero_cuenta ?? "",
      });
    } else {
      setForm(empty);
    }
  }, [visible, supplier]);

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name.trim() || !form.doc_number.trim()) {
      errorToast("Nombre y NIT/documento son obligatorios");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name: form.name.trim(),
        doc_number: form.doc_number.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() ? { value: form.address.trim() } : undefined,
        bank:
          form.banco || form.numero_cuenta
            ? {
                banco: form.banco,
                tipo_cuenta: form.tipo_cuenta,
                numero_cuenta: form.numero_cuenta,
              }
            : undefined,
      });
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={() => !saving && onClose()}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} disabled={saving}>
            <Ionicons name="close" size={24} color={colors.primaryText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>
            {supplier ? "Editar proveedor" : "Nuevo proveedor"}
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Field label="Nombre / Razón social *" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.name}
              onChangeText={(v) => set("name", v)}
              placeholder="Proveedor S.A.S"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="NIT / Documento *" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.doc_number}
              onChangeText={(v) => set("doc_number", v)}
              placeholder="900123456"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="Teléfono" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.phone}
              onChangeText={(v) => set("phone", v)}
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="Correo" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.email}
              onChangeText={(v) => set("email", v)}
              placeholder="proveedor@correo.com"
              placeholderTextColor={colors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </Field>
          <Field label="Dirección" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.address}
              onChangeText={(v) => set("address", v)}
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="Banco" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.banco}
              onChangeText={(v) => set("banco", v)}
              placeholder="Bancolombia"
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Field label="Tipo de cuenta" colors={colors}>
            <View style={[styles.pickerWrap, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Picker
                selectedValue={form.tipo_cuenta}
                onValueChange={(v) => set("tipo_cuenta", v)}
                style={{ color: colors.primaryText }}
              >
                <Picker.Item label="—" value="" />
                <Picker.Item label="Ahorros" value="ahorros" />
                <Picker.Item label="Corriente" value="corriente" />
              </Picker>
            </View>
          </Field>
          <Field label="Número de cuenta" colors={colors}>
            <TextInput
              style={inputStyle(colors)}
              value={form.numero_cuenta}
              onChangeText={(v) => set("numero_cuenta", v)}
              placeholderTextColor={colors.textMuted}
            />
          </Field>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Los datos bancarios se usarán en tesorería (pago a proveedores).
          </Text>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={onClose} disabled={saving}>
            <Text style={{ color: colors.primaryText }}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void submit()}
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

function inputStyle(colors: ReturnType<typeof useThemeColors>) {
  return [styles.input, { borderColor: colors.border, backgroundColor: colors.cardBg, color: colors.primaryText }];
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
  headerTitle: { fontSize: 17, fontWeight: "700" },
  body: { padding: 16, gap: 12, paddingBottom: 32 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: "600" },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  pickerWrap: { borderWidth: 1, borderRadius: 10, overflow: "hidden" },
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

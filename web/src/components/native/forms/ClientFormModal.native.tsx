import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { createClient, updateClient } from "../../../services/clients.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import type { CreateClientRequest, IExternUser } from "../../../types";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";

type Props = {
  visible: boolean;
  client?: IExternUser | null;
  onClose: () => void;
  onSuccess: () => void;
};

const DOC_TYPES = ["Cc", "Nit", "Ce", "Pasaporte", "Ti"] as const;

const emptyForm = (): CreateClientRequest => ({
  name: "",
  email: "",
  phone: "",
  doc_type: "Cc",
  doc_number: "",
  address: {
    value: "",
    ciudad_codigo: "",
    departamento_codigo: "",
    pais_codigo: "CO",
    zip_code: "",
  },
  tipoPersona: "2",
});

export default function ClientFormModalNative({ visible, client, onClose, onSuccess }: Props) {
  const colors = useThemeColors();
  const isEdit = !!client;
  const [form, setForm] = useState<CreateClientRequest>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (client) {
      const addr = typeof client.address === "string"
        ? { ...emptyForm().address, value: client.address }
        : {
            value: (client.address as { value?: string })?.value ?? "",
            ciudad_codigo: (client.address as { ciudad_codigo?: string })?.ciudad_codigo ?? "",
            departamento_codigo: (client.address as { departamento_codigo?: string })?.departamento_codigo ?? "",
            pais_codigo: (client.address as { pais_codigo?: string })?.pais_codigo ?? "CO",
            zip_code: (client.address as { zip_code?: string })?.zip_code ?? "",
          };
      setForm({
        name: client.name,
        email: client.email,
        phone: client.phone,
        doc_type: client.doc_type,
        doc_number: client.doc_number,
        address: addr,
        tipoPersona: client.tipoPersona ?? "2",
      });
    } else {
      setForm(emptyForm());
    }
  }, [visible, client]);

  const setField = <K extends keyof CreateClientRequest>(key: K, value: CreateClientRequest[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      errorToast("El nombre es obligatorio");
      return;
    }
    if (!form.doc_number.trim()) {
      errorToast("El número de documento es obligatorio");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && client) {
        await updateClient(client._id, form);
        successToast("Cliente actualizado");
      } else {
        await createClient(form);
        successToast("Cliente creado");
      }
      onSuccess();
      onClose();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar cliente");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[styles.sheet, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>
              {isEdit ? "Editar cliente" : "Nuevo cliente"}
            </Text>
            <Pressable onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            {[
              { label: "Nombre *", key: "name" as const, value: form.name },
              { label: "Email", key: "email" as const, value: form.email },
              { label: "Teléfono", key: "phone" as const, value: form.phone },
            ].map((field) => (
              <View key={field.key}>
                <Text style={[styles.label, { color: colors.textMuted }]}>{field.label}</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                  value={field.value}
                  onChangeText={(v) => setField(field.key, v)}
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize={field.key === "email" ? "none" : "sentences"}
                  keyboardType={field.key === "email" ? "email-address" : field.key === "phone" ? "phone-pad" : "default"}
                />
              </View>
            ))}

            <Text style={[styles.label, { color: colors.textMuted }]}>Tipo documento</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
              {DOC_TYPES.map((t) => (
                <Pressable
                  key={t}
                  style={[
                    styles.chip,
                    form.doc_type === t ? { backgroundColor: colors.accent } : { borderColor: colors.border },
                  ]}
                  onPress={() => setField("doc_type", t)}
                >
                  <Text style={{ color: form.doc_type === t ? "#fff" : colors.primaryText, fontWeight: "600" }}>{t}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={[styles.label, { color: colors.textMuted }]}>Número documento *</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
              value={form.doc_number}
              onChangeText={(v) => setField("doc_number", v)}
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textMuted }]}>Dirección</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
              value={form.address.value}
              onChangeText={(v) => setField("address", { ...form.address, value: v })}
              placeholderTextColor={colors.textMuted}
            />
          </ScrollView>

          <Pressable
            style={[styles.saveBtn, { backgroundColor: colors.accent, opacity: saving ? 0.7 : 1 }]}
            onPress={() => void handleSave()}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>{isEdit ? "Guardar cambios" : "Crear cliente"}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    padding: 18,
    maxHeight: "90%",
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  title: { fontSize: 20, fontWeight: "700" },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
  },
  chips: { marginBottom: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  saveBtn: {
    marginTop: 14,
    paddingVertical: 14,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
  },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

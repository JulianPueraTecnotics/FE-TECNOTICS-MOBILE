import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createSubUser, updateSubUser } from "../../../services/sub-users.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import type { CreateSubUserRequest, ISubUser, UpdateSubUserRequest } from "../../../types";
import { DsField, DsSideModal } from "../../design-system-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";

type Props = {
  visible: boolean;
  subUser?: ISubUser | null;
  onClose: () => void;
  onSuccess: () => void;
};

const DOC_TYPES = ["Cc", "Nit", "Ce", "Pasaporte", "Ti"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const emptyForm = (): CreateSubUserRequest => ({
  name: "",
  last_name: "",
  email: "",
  phone: "",
  doc_type: "Cc",
  doc_number: "",
});

const sanitizeNumericInput = (value: string) => value.replace(/\D/g, "");

const sanitizeDocNumberInput = (value: string, docType: string) => {
  const raw = value.replace(/\s/g, "");
  if (docType === "Nit") {
    const withoutInvalidChars = raw.replace(/[^\d-]/g, "");
    const parts = withoutInvalidChars.split("-");
    if (parts.length === 1) return parts[0];
    const main = parts[0].replace(/\D/g, "");
    const dv = parts.slice(1).join("").replace(/\D/g, "").slice(0, 1);
    return dv ? `${main}-${dv}` : main;
  }
  return sanitizeNumericInput(raw);
};

function isNitValid(docNumber: string) {
  return /^\d{9,10}(-\d)?$/.test(docNumber.replace(/\s/g, ""));
}

export default function SubUserFormModalNative({ visible, subUser, onClose, onSuccess }: Props) {
  const colors = useThemeColors();
  const isEdit = !!subUser;
  const [form, setForm] = useState<CreateSubUserRequest>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (subUser) {
      setForm({
        name: subUser.name,
        last_name: subUser.last_name,
        email: subUser.email,
        phone: sanitizeNumericInput(String(subUser.phone ?? "")),
        doc_type: subUser.doc_type,
        doc_number: sanitizeDocNumberInput(String(subUser.doc_number ?? ""), subUser.doc_type),
      });
    } else {
      setForm(emptyForm());
    }
  }, [visible, subUser]);

  const isValid = useMemo(() => {
    const name = form.name?.trim() ?? "";
    const last = form.last_name?.trim() ?? "";
    const em = form.email?.trim() ?? "";
    const phone = form.phone?.trim() ?? "";
    const doc = form.doc_number?.trim() ?? "";
    if (!name || !last || !phone || !doc) return false;
    if (!isEdit && (!em || !EMAIL_RE.test(em))) return false;
    if (form.doc_type === "Nit") return isNitValid(doc);
    return /\d/.test(doc);
  }, [form, isEdit]);

  const setField = <K extends keyof CreateSubUserRequest>(key: K, value: CreateSubUserRequest[K]) => {
    setForm((prev) => {
      if (key === "doc_type") {
        return { ...prev, doc_type: value as string, doc_number: sanitizeDocNumberInput(prev.doc_number, value as string) };
      }
      if (key === "doc_number") {
        return { ...prev, doc_number: sanitizeDocNumberInput(value as string, prev.doc_type) };
      }
      if (key === "phone") {
        return { ...prev, phone: sanitizeNumericInput(value as string) };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSave = async () => {
    if (!isValid) {
      errorToast("Completa todos los campos correctamente.");
      return;
    }
    setSaving(true);
    try {
      if (isEdit && subUser) {
        const patch: UpdateSubUserRequest = {
          name: form.name.trim(),
          last_name: form.last_name.trim(),
          phone: form.phone,
          doc_type: form.doc_type,
          doc_number: form.doc_number,
        };
        await updateSubUser(subUser._id, patch);
        successToast("Usuario actualizado correctamente");
      } else {
        await createSubUser({
          name: form.name.trim(),
          last_name: form.last_name.trim(),
          email: form.email.trim(),
          phone: form.phone,
          doc_type: form.doc_type,
          doc_number: form.doc_number,
        });
        successToast("Usuario creado correctamente");
      }
      onSuccess();
      onClose();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar el usuario");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={isEdit ? "Editar usuario" : "Nuevo usuario"}
      icon="person-add-outline"
      closeDisabled={saving}
      submitting={saving}
      submitDisabled={!isValid}
      onSubmit={() => void handleSave()}
    >
      <DsField label="Nombre" required icon="person-outline" value={form.name} onChangeText={(v) => setField("name", v)} />
      <DsField label="Apellido" required icon="person-outline" value={form.last_name} onChangeText={(v) => setField("last_name", v)} />
      <DsField
        label="Email"
        required={!isEdit}
        icon="mail-outline"
        value={form.email}
        onChangeText={(v) => setField("email", v)}
        editable={!isEdit}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <DsField
        label="Teléfono"
        required
        icon="call-outline"
        value={form.phone}
        onChangeText={(v) => setField("phone", v)}
        keyboardType="phone-pad"
      />

      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: colors.primaryText }]}>Tipo documento</Text>
        <View style={styles.chips}>
          {DOC_TYPES.map((t) => (
            <Pressable
              key={t}
              onPress={() => setField("doc_type", t)}
              style={[
                styles.chip,
                { borderColor: form.doc_type === t ? colors.headerAccent : colors.border, backgroundColor: form.doc_type === t ? colors.headerAccent : colors.bgSubtle },
              ]}
            >
              <Text style={{ color: form.doc_type === t ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DsField label="Número documento" required icon="card-outline" value={form.doc_number} onChangeText={(v) => setField("doc_number", v)} />
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

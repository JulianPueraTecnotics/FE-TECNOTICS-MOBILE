import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createClient, updateClient } from "../../../services/clients.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import type { CreateClientRequest, IExternUser } from "../../../types";
import { DsField, DsSideModal } from "../../design-system-native";
import { useThemeColors } from "../../../theme/useThemeColors";

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
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={isEdit ? "Editar cliente" : "Nuevo cliente"}
      icon="person-outline"
      closeDisabled={saving}
      submitting={saving}
      submitLabel={isEdit ? "Guardar cambios" : "Crear cliente"}
      onSubmit={() => void handleSave()}
    >
      <DsField
        label="Nombre"
        required
        icon="person-outline"
        value={form.name}
        onChangeText={(v) => setField("name", v)}
      />
      <DsField
        label="Email"
        icon="mail-outline"
        value={form.email}
        onChangeText={(v) => setField("email", v)}
        autoCapitalize="none"
        keyboardType="email-address"
      />
      <DsField
        label="Teléfono"
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
              style={[
                styles.chip,
                form.doc_type === t
                  ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent }
                  : { borderColor: colors.border },
              ]}
              onPress={() => setField("doc_type", t)}
            >
              <Text style={{ color: form.doc_type === t ? "#fff" : colors.primaryText, fontWeight: "600" }}>{t}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <DsField
        label="Número documento"
        required
        icon="card-outline"
        value={form.doc_number}
        onChangeText={(v) => setField("doc_number", v)}
      />
      <DsField
        label="Dirección"
        icon="location-outline"
        value={form.address.value}
        onChangeText={(v) => setField("address", { ...form.address, value: v })}
      />
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
});

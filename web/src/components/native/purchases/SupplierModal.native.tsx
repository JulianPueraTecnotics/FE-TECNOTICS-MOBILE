import { Picker } from "@react-native-picker/picker";
import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { DsField, DsSideModal } from "../../../components/design-system-native";
import { useThemeColors } from "../../../theme/useThemeColors";
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
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={supplier ? "Editar proveedor" : "Nuevo proveedor"}
      icon="business-outline"
      closeDisabled={saving}
      submitting={saving}
      onSubmit={() => void submit()}
    >
      <DsField
        label="Nombre / Razón social"
        required
        icon="business-outline"
        value={form.name}
        onChangeText={(v) => set("name", v)}
        placeholder="Proveedor S.A.S"
      />
      <DsField
        label="NIT / Documento"
        required
        icon="card-outline"
        value={form.doc_number}
        onChangeText={(v) => set("doc_number", v)}
        placeholder="900123456"
      />
      <DsField
        label="Teléfono"
        icon="call-outline"
        value={form.phone}
        onChangeText={(v) => set("phone", v)}
        keyboardType="phone-pad"
      />
      <DsField
        label="Correo"
        icon="mail-outline"
        value={form.email}
        onChangeText={(v) => set("email", v)}
        placeholder="proveedor@correo.com"
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <DsField
        label="Dirección"
        icon="location-outline"
        value={form.address}
        onChangeText={(v) => set("address", v)}
      />
      <DsField
        label="Banco"
        icon="wallet-outline"
        value={form.banco}
        onChangeText={(v) => set("banco", v)}
        placeholder="Bancolombia"
      />
      <DsField label="Tipo de cuenta" icon="swap-vertical-outline">
        <Picker
          selectedValue={form.tipo_cuenta}
          onValueChange={(v) => set("tipo_cuenta", v)}
          style={{ color: colors.primaryText }}
          dropdownIconColor={colors.textMuted}
        >
          <Picker.Item label="—" value="" />
          <Picker.Item label="Ahorros" value="ahorros" />
          <Picker.Item label="Corriente" value="corriente" />
        </Picker>
      </DsField>
      <DsField
        label="Número de cuenta"
        icon="card-outline"
        value={form.numero_cuenta}
        onChangeText={(v) => set("numero_cuenta", v)}
        keyboardType="number-pad"
      />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Los datos bancarios se usarán en tesorería (pago a proveedores).
      </Text>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 12, lineHeight: 18 },
});

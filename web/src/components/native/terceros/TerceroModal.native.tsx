import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LedgerChip, LedgerChipRow, LedgerField, LedgerPrimaryBtn } from "../ledger/LedgerUi.native";
import { createTercero, updateTercero } from "../../../features/terceros/terceros.service";
import { ROLE_LABELS, type Tercero, type TerceroRole } from "../../../features/terceros/terceros.types";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";

const ROLES: TerceroRole[] = ["cliente", "proveedor", "empleado", "otro"];

type Props = {
  visible: boolean;
  tercero?: Tercero | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function TerceroModalNative({ visible, tercero, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [docNumber, setDocNumber] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [roles, setRoles] = useState<TerceroRole[]>(["cliente"]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (tercero) {
      setName(tercero.name);
      setDocNumber(tercero.doc_number);
      setEmail(tercero.email || "");
      setPhone(tercero.phone || "");
      setRoles(tercero.roles?.length ? [...tercero.roles] : ["cliente"]);
    } else {
      setName("");
      setDocNumber("");
      setEmail("");
      setPhone("");
      setRoles(["cliente"]);
    }
  }, [visible, tercero]);

  const toggleRole = (r: TerceroRole) => {
    setRoles((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r]));
  };

  const save = async () => {
    if (!name.trim() || !docNumber.trim()) {
      errorToast("Nombre y documento son obligatorios");
      return;
    }
    if (!roles.length) {
      errorToast("Selecciona al menos un rol");
      return;
    }
    setSaving(true);
    try {
      const payload = { name: name.trim(), doc_number: docNumber.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined, roles };
      if (tercero) await updateTercero(tercero._id, payload);
      else await createTercero(payload);
      successToast(tercero ? "Tercero actualizado" : "Tercero creado");
      onSaved();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>{tercero ? "Editar tercero" : "Nuevo tercero"}</Text>
          <Pressable onPress={onClose}><Text style={{ color: colors.accent, fontWeight: "600" }}>Cerrar</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <LedgerField label="Nombre *" value={name} onChangeText={setName} />
          <LedgerField label="NIT / Documento *" value={docNumber} onChangeText={setDocNumber} />
          <LedgerField label="Email" value={email} onChangeText={setEmail} />
          <LedgerField label="Teléfono" value={phone} onChangeText={setPhone} />
          <Text style={[styles.label, { color: colors.textMuted }]}>Roles</Text>
          <LedgerChipRow>
            {ROLES.map((r) => (
              <LedgerChip key={r} label={ROLE_LABELS[r]} active={roles.includes(r)} onPress={() => toggleRole(r)} />
            ))}
          </LedgerChipRow>
          <LedgerPrimaryBtn label="Guardar" onPress={save} loading={saving} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 48 },
  head: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 40 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
});

import { useEffect, useState } from "react";
import { StyleSheet, Text } from "react-native";
import { LedgerChip, LedgerChipRow, LedgerField } from "../ledger/LedgerUi.native";
import { DsSideModal } from "../../design-system-native";
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
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={tercero ? "Editar tercero" : "Nuevo tercero"}
      icon="people-outline"
      closeDisabled={saving}
      submitting={saving}
      onSubmit={() => void save()}
    >
      <LedgerField label="Nombre *" value={name} onChangeText={setName} icon="person-outline" />
      <LedgerField label="NIT / Documento *" value={docNumber} onChangeText={setDocNumber} icon="card-outline" />
      <LedgerField label="Email" value={email} onChangeText={setEmail} icon="mail-outline" />
      <LedgerField label="Teléfono" value={phone} onChangeText={setPhone} icon="call-outline" />
      <Text style={[styles.label, { color: colors.primaryText }]}>Roles</Text>
      <LedgerChipRow>
        {ROLES.map((r) => (
          <LedgerChip key={r} label={ROLE_LABELS[r]} active={roles.includes(r)} onPress={() => toggleRole(r)} />
        ))}
      </LedgerChipRow>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: 4 },
});

import { useEffect, useState } from "react";
import { StyleSheet, Switch, Text, View } from "react-native";
import { LedgerChip, LedgerChipRow, LedgerField } from "../ledger/LedgerUi.native";
import { DsSideModal } from "../../design-system-native";
import { TIPO_CONTRATO_OPTIONS, TIPO_DOCUMENTO_OPTIONS, TIPO_TRABAJADOR_OPTIONS } from "../../../features/nomina/nomina.constants";
import { createEmpleado, updateEmpleado, type Empleado, type EmpleadoInput } from "../../../services/empleados.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";

const emptyForm = (): EmpleadoInput => ({
  tipo_documento: "13",
  numero_documento: "",
  primer_nombre: "",
  otros_nombres: "",
  primer_apellido: "",
  segundo_apellido: "",
  email: "",
  tipo_trabajador: "01",
  subtipo_trabajador: "00",
  tipo_contrato: "1",
  alto_riesgo_pension: false,
  salario_integral: false,
  sueldo: 0,
  fecha_ingreso: "",
  codigo_trabajador: "",
});

type Props = {
  visible: boolean;
  empleado?: Empleado | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EmpleadoModalNative({ visible, empleado, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const [form, setForm] = useState<EmpleadoInput>(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (empleado) {
      setForm({
        tipo_documento: empleado.tipo_documento,
        numero_documento: empleado.numero_documento,
        primer_nombre: empleado.primer_nombre,
        otros_nombres: empleado.otros_nombres ?? "",
        primer_apellido: empleado.primer_apellido,
        segundo_apellido: empleado.segundo_apellido ?? "",
        email: empleado.email ?? "",
        tipo_trabajador: empleado.tipo_trabajador,
        subtipo_trabajador: empleado.subtipo_trabajador,
        tipo_contrato: empleado.tipo_contrato,
        alto_riesgo_pension: empleado.alto_riesgo_pension,
        salario_integral: empleado.salario_integral,
        sueldo: empleado.sueldo,
        fecha_ingreso: empleado.fecha_ingreso?.slice(0, 10) ?? "",
        codigo_trabajador: empleado.codigo_trabajador ?? "",
      });
    } else {
      setForm(emptyForm());
    }
  }, [visible, empleado]);

  const set = <K extends keyof EmpleadoInput>(key: K, value: EmpleadoInput[K]) =>
    setForm((p) => ({ ...p, [key]: value }));

  const save = async () => {
    if (!form.numero_documento.trim() || !form.primer_nombre.trim() || !form.primer_apellido.trim()) {
      errorToast("Documento, primer nombre y primer apellido son obligatorios");
      return;
    }
    if (!form.sueldo || !form.fecha_ingreso) {
      errorToast("Sueldo y fecha de ingreso son obligatorios");
      return;
    }
    setSaving(true);
    try {
      if (empleado) await updateEmpleado(empleado._id, form);
      else await createEmpleado(form);
      successToast(empleado ? "Empleado actualizado" : "Empleado creado");
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
      title={empleado ? "Editar empleado" : "Nuevo empleado"}
      icon="person-outline"
      closeDisabled={saving}
      submitting={saving}
      onSubmit={() => void save()}
    >
      <Text style={[styles.label, { color: colors.primaryText }]}>Tipo documento</Text>
      <LedgerChipRow>
        {TIPO_DOCUMENTO_OPTIONS.slice(0, 4).map((o) => (
          <LedgerChip
            key={o.value}
            label={o.label.split(" ")[0]}
            active={form.tipo_documento === o.value}
            onPress={() => set("tipo_documento", o.value)}
          />
        ))}
      </LedgerChipRow>
      <LedgerField label="Número documento *" value={form.numero_documento} onChangeText={(v) => set("numero_documento", v)} icon="card-outline" />
      <LedgerField label="Primer nombre *" value={form.primer_nombre} onChangeText={(v) => set("primer_nombre", v)} icon="person-outline" />
      <LedgerField label="Otros nombres" value={form.otros_nombres || ""} onChangeText={(v) => set("otros_nombres", v)} icon="person-outline" />
      <LedgerField label="Primer apellido *" value={form.primer_apellido} onChangeText={(v) => set("primer_apellido", v)} icon="person-outline" />
      <LedgerField label="Segundo apellido" value={form.segundo_apellido || ""} onChangeText={(v) => set("segundo_apellido", v)} icon="person-outline" />
      <LedgerField label="Email" value={form.email || ""} onChangeText={(v) => set("email", v)} icon="mail-outline" />
      <LedgerField label="Sueldo *" value={String(form.sueldo || "")} onChangeText={(v) => set("sueldo", Number(v) || 0)} keyboardType="numeric" icon="cash-outline" />
      <LedgerField label="Fecha ingreso (YYYY-MM-DD) *" value={form.fecha_ingreso} onChangeText={(v) => set("fecha_ingreso", v)} icon="calendar-outline" />
      <Text style={[styles.label, { color: colors.primaryText }]}>Tipo contrato</Text>
      <LedgerChipRow>
        {TIPO_CONTRATO_OPTIONS.map((o) => (
          <LedgerChip key={o.value} label={o.label.split(" ")[0]} active={form.tipo_contrato === o.value} onPress={() => set("tipo_contrato", o.value)} />
        ))}
      </LedgerChipRow>
      <Text style={[styles.label, { color: colors.primaryText, marginTop: 8 }]}>Tipo trabajador</Text>
      <LedgerChip label={labelFrom(form.tipo_trabajador)} active onPress={() => {}} />
      <LedgerChipRow>
        {TIPO_TRABAJADOR_OPTIONS.slice(0, 3).map((o) => (
          <LedgerChip key={o.value} label={o.label.slice(0, 12)} active={form.tipo_trabajador === o.value} onPress={() => set("tipo_trabajador", o.value)} />
        ))}
      </LedgerChipRow>
      <View style={styles.switchRow}>
        <Text style={{ color: colors.primaryText }}>Salario integral</Text>
        <Switch value={form.salario_integral} onValueChange={(v) => set("salario_integral", v)} />
      </View>
    </DsSideModal>
  );
}

function labelFrom(value: string) {
  return TIPO_TRABAJADOR_OPTIONS.find((o) => o.value === value)?.label ?? value;
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  switchRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: 4 },
});

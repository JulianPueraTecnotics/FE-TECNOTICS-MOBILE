import { useCallback, useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { LedgerField, LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { createBank, deleteBank, getBanks, updateBank, type Bank } from "../treasury.service";

const empty = {
  nombre_banco: "",
  numero_cuenta: "",
  tipo_cuenta: "corriente" as "corriente" | "ahorros",
  identificador: "6",
  validacion_id: "V",
  descripcion_lote: "PROVEEDOR",
};

export default function TreasuryBanksNative() {
  const colors = useThemeColors();
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Bank | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBanks();
      setBanks(res.banks);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar bancos");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openCreate = () => {
    setEditing(null);
    setForm(empty);
    setModalOpen(true);
  };

  const openEdit = (b: Bank) => {
    setEditing(b);
    setForm({
      nombre_banco: b.nombre_banco,
      numero_cuenta: b.numero_cuenta,
      tipo_cuenta: b.tipo_cuenta,
      identificador: b.identificador,
      validacion_id: b.validacion_id,
      descripcion_lote: b.descripcion_lote,
    });
    setModalOpen(true);
  };

  const save = async () => {
    if (!form.nombre_banco.trim() || !form.numero_cuenta.trim()) {
      errorToast("Banco y número de cuenta son obligatorios");
      return;
    }
    setSaving(true);
    try {
      if (editing) await updateBank(editing._id, form);
      else await createBank(form);
      successToast(editing ? "Banco actualizado" : "Banco creado");
      setModalOpen(false);
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (b: Bank) => {
    Alert.alert("Eliminar banco", `¿Eliminar ${b.nombre_banco}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteBank(b._id);
            successToast("Banco eliminado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <DsModuleScreen
        title="Bancos"
        subtitle="Cuentas desde las que pagas a proveedores"
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        headerActions={<DsButton label="Nuevo banco" icon="add" compact onPress={openCreate} />}
      >
        {banks.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin bancos configurados.</Text>
        ) : (
          banks.map((b) => (
            <View key={b._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <LedgerRow cells={[{ value: b.nombre_banco, bold: true }, { value: b.numero_cuenta, align: "right" }]} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {b.tipo_cuenta === "ahorros" ? "Ahorros" : "Corriente"} · {b.descripcion_lote}
              </Text>
              <LedgerStatusBadge label={b.active ? "Activo" : "Inactivo"} tone={b.active ? "ok" : "warn"} />
              <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => openEdit(b)} />
                <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDelete(b)} />
              </View>
            </View>
          ))
        )}
      </DsModuleScreen>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <ScrollView style={{ flex: 1, backgroundColor: colors.pageBg, paddingTop: 48 }} contentContainerStyle={{ padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.primary, marginBottom: 12 }}>{editing ? "Editar banco" : "Nuevo banco"}</Text>
          <LedgerField label="Banco *" value={form.nombre_banco} onChangeText={(v) => set("nombre_banco", v)} />
          <LedgerField label="Número cuenta *" value={form.numero_cuenta} onChangeText={(v) => set("numero_cuenta", v)} />
          <View style={{ flexDirection: "row", gap: 8, marginVertical: 8 }}>
            {(["corriente", "ahorros"] as const).map((t) => (
              <Pressable key={t} onPress={() => setForm((f) => ({ ...f, tipo_cuenta: t }))} style={[styles.chip, { borderColor: form.tipo_cuenta === t ? colors.headerAccent : colors.border }]}>
                <Text style={{ color: colors.primaryText }}>{t === "corriente" ? "Corriente" : "Ahorros"}</Text>
              </Pressable>
            ))}
          </View>
          <LedgerField label="Identificador ACH" value={form.identificador} onChangeText={(v) => set("identificador", v)} />
          <LedgerField label="Validación ACH" value={form.validacion_id} onChangeText={(v) => set("validacion_id", v)} />
          <LedgerField label="Descripción lote" value={form.descripcion_lote} onChangeText={(v) => set("descripcion_lote", v)} />
          <View style={{ flexDirection: "row", gap: 8, marginTop: 12 }}>
            <LedgerPrimaryBtn label="Cancelar" variant="secondary" onPress={() => setModalOpen(false)} />
            <LedgerPrimaryBtn label="Guardar" onPress={save} loading={saving} />
          </View>
        </ScrollView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

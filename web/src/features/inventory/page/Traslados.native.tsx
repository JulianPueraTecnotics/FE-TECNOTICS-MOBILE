import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ItemPickerFieldNative, { InvFieldLabel } from "../../../components/native/inventory/InventoryUi.native";
import { DsField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { createTraslado, getWarehouses } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import type { ItemData } from "../../../types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { todayIso } from "../inventoryFormat";

export default function TrasladosNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [item, setItem] = useState<ItemData | null>(null);
  const [fromId, setFromId] = useState("");
  const [toId, setToId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWarehouses()
      .then((ws) => {
        setWarehouses(ws);
        if (ws[0]) setFromId(ws[0]._id);
        if (ws[1]) setToId(ws[1]._id);
        else if (ws[0]) setToId(ws[0]._id);
      })
      .catch(() => setWarehouses([]));
  }, []);

  const submit = async () => {
    if (!item?._id) {
      errorToast("Selecciona un producto");
      return;
    }
    if (!fromId || !toId) {
      errorToast("Selecciona bodegas origen y destino");
      return;
    }
    if (fromId === toId) {
      errorToast("Origen y destino deben ser distintos");
      return;
    }
    const cant = Number(cantidad);
    if (!cant || cant <= 0 || Number.isNaN(cant)) {
      errorToast("Indica una cantidad positiva");
      return;
    }
    setSaving(true);
    try {
      await createTraslado({
        item_id: item._id,
        from_warehouse_id: fromId,
        to_warehouse_id: toId,
        cantidad: cant,
        motivo: motivo.trim() || undefined,
        fecha: fecha || undefined,
      });
      successToast("Traslado registrado");
      setCantidad("");
      setMotivo("");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al registrar traslado");
    } finally {
      setSaving(false);
    }
  };

  const WarehousePicker = ({ label, value, onChange }: { label: string; value: string; onChange: (id: string) => void }) => (
    <>
      <InvFieldLabel>{label}</InvFieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {warehouses.map((w) => (
          <Pressable
            key={w._id}
            onPress={() => onChange(w._id)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: value === w._id ? colors.headerAccent : colors.cardBg }]}
          >
            <Text style={{ color: value === w._id ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>{w.codigo}</Text>
          </Pressable>
        ))}
      </ScrollView>
    </>
  );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Mueve existencias entre bodegas sin cambiar el costo total del inventario.
      </Text>

      <ItemPickerFieldNative label="Producto *" value={item} onChange={setItem} />
      <WarehousePicker label="Bodega origen *" value={fromId} onChange={setFromId} />
      <WarehousePicker label="Bodega destino *" value={toId} onChange={setToId} />

      <View style={{ gap: 12 }}>
        <DsField label="Cantidad *" icon="layers-outline" value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" />
        <DsField label="Fecha" icon="calendar-outline" value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />
        <DsField label="Motivo" icon="document-text-outline" value={motivo} onChangeText={setMotivo} multiline />
      </View>

      <View style={{ marginTop: 12 }}>
        <LedgerPrimaryBtn label="Registrar traslado" icon="swap-horizontal-outline" onPress={submit} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

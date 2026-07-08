import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ItemPickerFieldNative, { InvFieldLabel } from "../../../components/native/inventory/InventoryUi.native";
import { DsField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { createAjuste, getWarehouses } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import type { ItemData } from "../../../types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { todayIso } from "../inventoryFormat";

export default function AjustesNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [item, setItem] = useState<ItemData | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [motivo, setMotivo] = useState("");
  const [fecha, setFecha] = useState(todayIso());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getWarehouses()
      .then((ws) => {
        setWarehouses(ws);
        const principal = ws.find((w) => w.es_principal) ?? ws[0];
        if (principal) setWarehouseId(principal._id);
      })
      .catch(() => setWarehouses([]));
  }, []);

  const reset = () => {
    setItem(null);
    setCantidad("");
    setCostoUnitario("");
    setMotivo("");
    setFecha(todayIso());
  };

  const submit = async () => {
    if (!item?._id) {
      errorToast("Selecciona un producto");
      return;
    }
    if (!warehouseId) {
      errorToast("Selecciona una bodega");
      return;
    }
    const cant = Number(cantidad);
    if (!cant || Number.isNaN(cant)) {
      errorToast("Indica una cantidad distinta de cero (negativo para descontar)");
      return;
    }
    setSaving(true);
    try {
      await createAjuste({
        item_id: item._id,
        warehouse_id: warehouseId,
        cantidad: cant,
        costo_unitario: costoUnitario ? Number(costoUnitario) : undefined,
        motivo: motivo.trim() || undefined,
        fecha: fecha || undefined,
      });
      successToast("Ajuste registrado");
      reset();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al registrar ajuste");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Aumenta (cantidad positiva) o disminuye (cantidad negativa) existencias en una bodega.
      </Text>

      <ItemPickerFieldNative label="Producto *" value={item} onChange={setItem} />

      <InvFieldLabel>Bodega *</InvFieldLabel>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 12 }}>
        {warehouses.map((w) => (
          <Pressable
            key={w._id}
            onPress={() => setWarehouseId(w._id)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: warehouseId === w._id ? colors.headerAccent : colors.cardBg }]}
          >
            <Text style={{ color: warehouseId === w._id ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>{w.codigo}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ gap: 12 }}>
        <DsField label="Cantidad (+/−) *" icon="swap-vertical-outline" value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" placeholder="Ej. 10 o -3" />
        <DsField label="Costo unitario (opcional)" icon="cash-outline" value={costoUnitario} onChangeText={setCostoUnitario} keyboardType="decimal-pad" />
        <DsField label="Fecha" icon="calendar-outline" value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />
        <DsField label="Motivo" icon="document-text-outline" value={motivo} onChangeText={setMotivo} multiline />
      </View>

      <View style={{ marginTop: 12 }}>
        <LedgerPrimaryBtn label="Registrar ajuste" icon="checkmark-outline" onPress={submit} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

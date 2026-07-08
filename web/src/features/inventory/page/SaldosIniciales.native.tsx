import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ItemPickerFieldNative, { InvFieldLabel } from "../../../components/native/inventory/InventoryUi.native";
import { DsField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { cargarSaldosIniciales, getWarehouses } from "../inventory.service";
import type { Warehouse } from "../inventory.types";
import type { ItemData } from "../../../types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { todayIso } from "../inventoryFormat";

export default function SaldosInicialesNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [item, setItem] = useState<ItemData | null>(null);
  const [warehouseId, setWarehouseId] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
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

  const submit = async () => {
    if (!item?._id || !warehouseId) {
      errorToast("Selecciona producto y bodega");
      return;
    }
    const cant = Number(cantidad);
    const costo = Number(costoUnitario);
    if (!cant || cant <= 0 || Number.isNaN(cant)) {
      errorToast("Indica cantidad inicial válida");
      return;
    }
    if (!costo || costo <= 0 || Number.isNaN(costo)) {
      errorToast("Indica costo unitario válido");
      return;
    }
    setSaving(true);
    try {
      const res = await cargarSaldosIniciales([
        {
          item_id: item._id,
          warehouse_id: warehouseId,
          cantidad: cant,
          costo_unitario: costo,
          fecha: fecha || undefined,
        },
      ]);
      successToast(`${res.importados} saldo(s) inicial(es) cargado(s)`);
      setCantidad("");
      setCostoUnitario("");
      setItem(null);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar saldo inicial");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Carga existencias y costo de arranque por ítem y bodega.
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
        <DsField label="Cantidad *" icon="layers-outline" value={cantidad} onChangeText={setCantidad} keyboardType="decimal-pad" />
        <DsField label="Costo unitario *" icon="cash-outline" value={costoUnitario} onChangeText={setCostoUnitario} keyboardType="decimal-pad" />
        <DsField label="Fecha" icon="calendar-outline" value={fecha} onChangeText={setFecha} placeholder="YYYY-MM-DD" />
      </View>

      <View style={{ marginTop: 12 }}>
        <LedgerPrimaryBtn label="Cargar saldo inicial" icon="flag-outline" onPress={submit} loading={saving} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

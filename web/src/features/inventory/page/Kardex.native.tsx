import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import ItemPickerFieldNative, { InvFieldLabel, InvTextInput } from "../../../components/native/inventory/InventoryUi.native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import type { ItemData } from "../../../types";
import { getKardex, getWarehouses } from "../inventory.service";
import type { KardexMov, Warehouse } from "../inventory.types";
import { TIPO_KARDEX_LABELS, formatDate, formatMoney, formatQty, todayIso, yearStartIso } from "../inventoryFormat";

export default function KardexNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [item, setItem] = useState<ItemData | null>(null);
  const [desde, setDesde] = useState(yearStartIso());
  const [hasta, setHasta] = useState(todayIso());
  const [movs, setMovs] = useState<KardexMov[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getWarehouses()
      .then((ws) => {
        setWarehouses(ws);
        const principal = ws.find((w) => w.es_principal) ?? ws[0];
        if (principal) setWarehouseId(principal._id);
      })
      .catch(() => setWarehouses([]));
  }, []);

  const consultar = async () => {
    if (!item?._id) {
      errorToast("Selecciona un producto");
      return;
    }
    setLoading(true);
    try {
      const data = await getKardex(item._id, {
        warehouse_id: warehouseId || undefined,
        desde: desde || undefined,
        hasta: hasta || undefined,
      });
      setMovs(data);
      setLoaded(true);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar kardex");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Consulta movimientos de un ítem por bodega y rango de fechas.
      </Text>

      <ItemPickerFieldNative label="Producto *" value={item} onChange={setItem} />

      <InvFieldLabel>Bodega</InvFieldLabel>
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

      <InvFieldLabel>Desde</InvFieldLabel>
      <InvTextInput value={desde} onChangeText={setDesde} placeholder="YYYY-MM-DD" />
      <InvFieldLabel>Hasta</InvFieldLabel>
      <InvTextInput value={hasta} onChangeText={setHasta} placeholder="YYYY-MM-DD" />

      <View style={{ marginTop: 8, marginBottom: 16 }}>
        <LedgerPrimaryBtn label={loading ? "Consultando…" : "Consultar kardex"} icon="search-outline" onPress={consultar} loading={loading} />
      </View>

      {!loaded ? null : movs.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sin movimientos en el período.</Text>
      ) : (
        movs.map((m) => (
          <View key={m._id} style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
            <View style={styles.cardTop}>
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{TIPO_KARDEX_LABELS[m.tipo] ?? m.tipo}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(m.fecha)}</Text>
            </View>
            {m.descripcion ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{m.descripcion}</Text> : null}
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Cantidad</Text>
              <Text style={{ color: colors.primaryText }}>{formatQty(m.cantidad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Costo unit.</Text>
              <Text style={{ color: colors.primaryText }}>{formatMoney(m.costo_unitario)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Saldo cant.</Text>
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatQty(m.saldo_cantidad)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 12, marginBottom: 8 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
});

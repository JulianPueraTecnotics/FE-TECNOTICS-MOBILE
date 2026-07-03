import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import LoadingScreen from "../../../router/LoadingScreen";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { getValorizado, getWarehouses } from "../inventory.service";
import type { StockRow, Warehouse } from "../inventory.types";
import { formatMoney, formatQty } from "../inventoryFormat";

export default function ValorizadoNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await getValorizado(warehouseId || undefined);
      setRows(res.rows);
      setTotal(res.total);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar valorizado");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  if (loading && !refreshing) return <LoadingScreen />;

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.headerAccent} />}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}
    >
      <View style={styles.kpi}>
        <AnalyticsKpiNative label="Total inventario valorizado" value={formatMoney(total)} icon="cash-outline" accent="#14b8a6" />
      </View>

      {rows.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>Sin datos de inventario valorizado.</Text>
      ) : (
        rows.map((r) => (
          <View
            key={`${r.item_id}-${r.warehouse_id}`}
            style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <Text style={[styles.name, { color: colors.primaryText }]}>{r.item_nombre}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.warehouse_nombre}</Text>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Cantidad</Text>
              <Text style={{ color: colors.primaryText }}>{formatQty(r.cantidad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Costo prom.</Text>
              <Text style={{ color: colors.primaryText }}>{formatMoney(r.costo_promedio)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Valor</Text>
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatMoney(r.costo_total)}</Text>
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  kpi: { marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
});

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import LoadingScreen from "../../../router/LoadingScreen";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { getStock, getWarehouses } from "../inventory.service";
import type { StockRow, Warehouse } from "../inventory.types";
import { formatMoney, formatQty } from "../inventoryFormat";

export default function ExistenciasNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    getWarehouses().then(setWarehouses).catch(() => setWarehouses([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(search), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      setRows(await getStock(warehouseId || undefined));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar existencias");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.item_nombre.toLowerCase().includes(q) ||
        (r.item_code || "").toLowerCase().includes(q) ||
        r.warehouse_nombre.toLowerCase().includes(q),
    );
  }, [rows, debounced]);

  if (loading && !refreshing) return <LoadingScreen />;

  return (
    <ScrollView
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={colors.headerAccent} />}
      contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}
    >
      <TextInput
        value={search}
        onChangeText={setSearch}
        placeholder="Buscar ítem, código o bodega…"
        placeholderTextColor={colors.textMuted}
        style={[styles.search, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginVertical: 12 }}>
        <Pressable
          onPress={() => setWarehouseId("")}
          style={[styles.chip, { borderColor: colors.border, backgroundColor: !warehouseId ? colors.headerAccent : colors.cardBg }]}
        >
          <Text style={{ color: !warehouseId ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>Todas</Text>
        </Pressable>
        {warehouses.map((w) => (
          <Pressable
            key={w._id}
            onPress={() => setWarehouseId(w._id)}
            style={[styles.chip, { borderColor: colors.border, backgroundColor: warehouseId === w._id ? colors.headerAccent : colors.cardBg }]}
          >
            <Text style={{ color: warehouseId === w._id ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }} numberOfLines={1}>
              {w.codigo}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtered.length === 0 ? (
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 32 }}>Sin existencias registradas.</Text>
      ) : (
        filtered.map((r) => (
          <View
            key={`${r.item_id}-${r.warehouse_id}`}
            style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border, borderLeftColor: r.bajo_minimo ? "#dc2626" : colors.headerAccent, borderLeftWidth: r.bajo_minimo ? 4 : 0 }]}
          >
            <Text style={[styles.name, { color: colors.primaryText }]}>{r.item_nombre}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.item_code || "—"} · {r.warehouse_nombre}</Text>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Cantidad</Text>
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatQty(r.cantidad)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Costo prom.</Text>
              <Text style={{ color: colors.primaryText }}>{formatMoney(r.costo_promedio)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>Costo total</Text>
              <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatMoney(r.costo_total)}</Text>
            </View>
            {r.bajo_minimo ? (
              <View style={styles.warn}>
                <Ionicons name="warning-outline" size={14} color="#dc2626" />
                <Text style={{ color: "#dc2626", fontSize: 12, fontWeight: "600" }}>Bajo mínimo ({formatQty(r.stock_minimo)})</Text>
              </View>
            ) : null}
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  search: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 6 },
  warn: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
});

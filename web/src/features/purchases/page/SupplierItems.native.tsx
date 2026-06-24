import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
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
import ParametrizeModalNative from "../../../components/native/purchases/ParametrizeModal.native";
import LoadingScreen from "../../../router/LoadingScreen";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { accountCode } from "../purchases.shared";
import {
  applySupplierItemSuggestion,
  getSupplierItems,
  parametrizeSupplierItem,
  suggestSupplierItem,
  type SupplierItem,
  type SupplierItemParams,
} from "../supplierItems.service";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "NO_PARAMETRIZADO", label: "Pendientes" },
  { value: "PARAMETRIZADO", label: "Parametrizados" },
];

export default function SupplierItemsNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [items, setItems] = useState<SupplierItem[]>([]);
  const [pendientes, setPendientes] = useState(0);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SupplierItem | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    try {
      const res = await getSupplierItems({ search: debouncedSearch.trim(), status, page: 1 });
      setItems(res.items);
      setPendientes(res.pendientes);
      setAiEnabled(res.ai_enabled);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debouncedSearch, status, refreshKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const suggest = async (it: SupplierItem) => {
    setBusyId(it._id);
    try {
      await suggestSupplierItem(it._id);
      successToast("Sugerencia generada");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const applyAi = async (it: SupplierItem) => {
    setBusyId(it._id);
    try {
      const res = await applySupplierItemSuggestion(it._id);
      successToast(res.message || "Sugerencia aplicada");
      setRefreshKey((k) => k + 1);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const saveManual = async (params: SupplierItemParams) => {
    if (!editing) return;
    await parametrizeSupplierItem(editing._id, params);
    successToast("Parametrización guardada");
    setEditing(null);
    setRefreshKey((k) => k + 1);
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Parametrización de productos</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Cuentas contables y retención por producto de cada proveedor.{" "}
          {aiEnabled ? "La IA sugiere automáticamente." : "IA no configurada (manual)."}
        </Text>
      </View>

      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Buscar producto, NIT..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 48, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
        contentContainerStyle={styles.filters}
      >
        {STATUS_OPTIONS.map((opt) => (
          <Pressable
            key={opt.value || "all"}
            style={[
              styles.chip,
              status === opt.value
                ? { backgroundColor: colors.accent }
                : { borderColor: colors.border, borderWidth: 1 },
            ]}
            onPress={() => setStatus(opt.value)}
          >
            <Text style={{ color: status === opt.value ? "#fff" : colors.primaryText, fontSize: 13 }}>
              {opt.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {pendientes > 0 ? (
        <View style={[styles.banner, { backgroundColor: "#fef3c7", borderBottomColor: colors.border }]}>
          <Ionicons name="warning-outline" size={18} color="#d97706" />
          <Text style={{ color: "#92400e", fontSize: 13 }}>
            <Text style={{ fontWeight: "700" }}>{pendientes}</Text> producto(s) sin parametrizar.
          </Text>
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRefreshKey((k) => k + 1);
            }}
            tintColor={colors.accent}
          />
        }
      >
        {items.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="pricetag-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No hay productos de proveedor. Se crean al importar compras.
            </Text>
          </View>
        ) : (
          items.map((it) => {
            const busy = busyId === it._id;
            const hasAi = !!it.ai_suggestion;
            const isReady = it.status === "PARAMETRIZADO";
            return (
              <View
                key={it._id}
                style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.code, { color: colors.primaryText }]}>{it.codigo}</Text>
                    <Text style={[styles.desc, { color: colors.textMuted }]}>{it.descripcion}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>NIT: {it.supplier_doc}</Text>
                    <Text style={[styles.meta, { color: colors.textMuted }]}>
                      Gasto {accountCode(it.params?.cuenta_gasto_costo)} · CxP {accountCode(it.params?.cuenta_por_pagar)} · Retef{" "}
                      {it.params?.retefuente ? `${it.params.retefuente}%` : "—"}
                    </Text>
                    {hasAi ? (
                      <Text style={[styles.aiHint, { color: colors.accent }]}>
                        IA: {it.ai_suggestion?.cuenta_gasto_costo?.codigo ?? "—"} (conf. {it.ai_suggestion?.confianza ?? "—"})
                      </Text>
                    ) : it.ai_error ? (
                      <Text style={[styles.aiHint, { color: "#dc2626" }]}>IA: error</Text>
                    ) : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: isReady ? "#d1fae5" : "#fef3c7" }]}>
                    <Text style={{ fontSize: 11, fontWeight: "600", color: isReady ? "#065f46" : "#92400e" }}>
                      {isReady ? "Listo" : "Pendiente"}
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  {aiEnabled && !hasAi ? (
                    <Pressable
                      style={[styles.actionBtn, { borderColor: colors.border }]}
                      onPress={() => void suggest(it)}
                      disabled={busy}
                    >
                      {busy ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <>
                          <Ionicons name="sparkles-outline" size={16} color={colors.accent} />
                          <Text style={{ color: colors.accent, fontSize: 12 }}>Sugerir IA</Text>
                        </>
                      )}
                    </Pressable>
                  ) : null}
                  {hasAi ? (
                    <Pressable
                      style={[styles.actionBtn, { borderColor: colors.accent }]}
                      onPress={() => void applyAi(it)}
                      disabled={busy}
                    >
                      <Ionicons name="checkmark-circle-outline" size={16} color={colors.accent} />
                      <Text style={{ color: colors.accent, fontSize: 12 }}>Aplicar IA</Text>
                    </Pressable>
                  ) : null}
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    onPress={() => setEditing(it)}
                  >
                    <Ionicons name="create-outline" size={16} color={colors.primaryText} />
                    <Text style={{ color: colors.primaryText, fontSize: 12 }}>Editar</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ParametrizeModalNative
        visible={!!editing}
        item={editing}
        onClose={() => setEditing(null)}
        onSave={saveManual}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  toolbar: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  filters: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  empty: { textAlign: "center", fontSize: 14, paddingHorizontal: 24 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", gap: 10 },
  code: { fontSize: 15, fontWeight: "700" },
  desc: { fontSize: 13, marginTop: 2 },
  meta: { fontSize: 12, marginTop: 4 },
  aiHint: { fontSize: 12, marginTop: 4, fontWeight: "500" },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
});

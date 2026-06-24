import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import ItemFormModalNative from "../../../components/native/items/ItemFormModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { deleteItem, getAllItems, searchItems } from "../../../services/items.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { ItemData } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";

type FilterType = "all" | "product" | "service";

export default function ProductsServicesNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [items, setItems] = useState<ItemData[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [selected, setSelected] = useState<ItemData | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = debounced.trim();
      const res = q ? await searchItems(q, page, 20) : await getAllItems(page, 20);
      if (res) {
        setItems(res.items);
        setTotalPages(res.pagination.totalPages);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced]);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((i) => i.kind === filter);
  }, [items, filter]);

  const formatPrice = (n: number) =>
    (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

  const onDelete = (item: ItemData) => {
    if (!item._id) return;
    Alert.alert("Eliminar", `¿Eliminar ${item.name}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteItem(item._id!);
            successToast("Item eliminado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Productos y servicios</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Catálogo para facturación y cotizaciones</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
      >
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Buscar por nombre o código..."
          placeholderTextColor={colors.textMuted}
          style={[styles.search, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
        />
        <LedgerChipRow>
          {(["all", "product", "service"] as FilterType[]).map((f) => (
            <LedgerChip
              key={f}
              label={f === "all" ? "Todos" : f === "product" ? "Productos" : "Servicios"}
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </LedgerChipRow>
        <LedgerPrimaryBtn label="Nuevo item" onPress={() => { setSelected(null); setModalOpen(true); }} />

        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : filtered.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin items.</Text>
        ) : (
          filtered.map((item) => (
            <View key={item._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Text style={{ fontWeight: "700", color: colors.primaryText }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {item.code || "—"} · {item.kind === "product" ? "Producto" : "Servicio"} · IVA {item.taxes?.iva ?? 0}%
              </Text>
              <Text style={{ color: colors.primaryText, marginVertical: 4 }}>{formatPrice(item.price)}</Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => { setSelected(item); setModalOpen(true); }} />
                <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDelete(item)} />
              </View>
            </View>
          ))
        )}
        <NativePagination page={page} totalPages={totalPages} loading={loading} onChange={setPage} />
      </ScrollView>

      <ItemFormModalNative
        visible={modalOpen}
        item={selected}
        onClose={() => setModalOpen(false)}
        onSaved={() => { setModalOpen(false); load(); }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 4 },
  search: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 10 },
});

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import SupplierModalNative from "../../../components/native/purchases/SupplierModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import {
  createSupplier,
  deleteSupplier,
  getAllSuppliers,
  updateSupplier,
} from "../purchases.service";
import type { Supplier } from "../purchases.types";

const PAGE_SIZE = 20;

export default function SuppliersNative() {
  const colors = useThemeColors();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const load = useCallback(async () => {
    if (hasLoadedOnce) setFetching(true);
    else setLoading(true);
    try {
      const res = await getAllSuppliers(page, PAGE_SIZE, debouncedSearch.trim());
      setSuppliers(res.suppliers);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar proveedores");
    } finally {
      setLoading(false);
      setFetching(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [page, debouncedSearch, refreshKey, hasLoadedOnce]);

  useEffect(() => {
    void load();
  }, [load]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = (supplier: Supplier) => {
    Alert.alert(
      "Eliminar proveedor",
      `¿Eliminar a "${supplier.name}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void handleDelete(supplier),
        },
      ]
    );
  };

  const handleDelete = async (supplier: Supplier) => {
    setDeletingId(supplier._id);
    try {
      await deleteSupplier(supplier._id);
      successToast("Proveedor eliminado");
      if (suppliers.length === 1 && page > 1) setPage((p) => p - 1);
      else setRefreshKey((k) => k + 1);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSave = async (payload: Partial<Supplier>) => {
    if (editing) await updateSupplier(editing._id, payload);
    else await createSupplier(payload);
    successToast(editing ? "Proveedor actualizado" : "Proveedor creado");
    setModalOpen(false);
    setEditing(null);
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <DsModuleScreen
        title="Proveedores"
        subtitle="Gestiona la agenda de proveedores de compras y gastos"
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setRefreshKey((k) => k + 1);
        }}
        toolbar={
          <>
            <DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar proveedor, NIT..." />
            <DsButton
              label=""
              icon="add"
              compact
              onPress={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              style={{ minWidth: 44, paddingHorizontal: 0 }}
            />
          </>
        }
      >
        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={setPage} />

        {suppliers.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay proveedores para mostrar</Text>
        ) : (
          suppliers.map((s) => (
            <View
              key={s._id}
              style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <View style={styles.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.primaryText }]}>{s.name}</Text>
                  <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{s.doc_number}</Text>
                  {s.email ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{s.email}</Text> : null}
                  {s.phone ? <Text style={[styles.cardMeta, { color: colors.textMuted }]}>{s.phone}</Text> : null}
                </View>
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: s.source === "import" ? "#fef3c7" : "#d1fae5" },
                  ]}
                >
                  <Text style={{ fontSize: 11, fontWeight: "600", color: s.source === "import" ? "#92400e" : "#065f46" }}>
                    {s.source === "import" ? "Importado" : "Manual"}
                  </Text>
                </View>
              </View>
              <View style={styles.actions}>
                <Pressable
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                  onPress={() => {
                    setEditing(s);
                    setModalOpen(true);
                  }}
                >
                  <Ionicons name="create-outline" size={18} color={colors.headerAccent} />
                </Pressable>
                <Pressable
                  style={[styles.iconBtn, { borderColor: colors.border }]}
                  onPress={() => confirmDelete(s)}
                  disabled={deletingId === s._id}
                >
                  {deletingId === s._id ? (
                    <ActivityIndicator size="small" color="#dc2626" />
                  ) : (
                    <Ionicons name="trash-outline" size={18} color="#dc2626" />
                  )}
                </Pressable>
              </View>
            </View>
          ))
        )}
      </DsModuleScreen>

      <SupplierModalNative
        visible={modalOpen}
        supplier={editing}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
        }}
        onSave={handleSave}
      />
    </>
  );
}

const styles = StyleSheet.create({
  empty: { textAlign: "center", paddingVertical: 32, fontSize: 14 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", gap: 10 },
  cardTitle: { fontSize: 15, fontWeight: "700" },
  cardMeta: { fontSize: 12, marginTop: 2 },
  badge: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  actions: { flexDirection: "row", gap: 8, justifyContent: "flex-end" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ImportModalNative from "../../../components/native/purchases/ImportModal.native";
import RetentionModalNative from "../../../components/native/purchases/RetentionModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import LoadingScreen from "../../../router/LoadingScreen";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { formatDateCO } from "../../../utils/format";
import { deletePurchase, getPurchases } from "../purchases.service";
import { DOC_LABELS, formatPurchaseTotal, purchaseKindMeta } from "../purchases.shared";
import type { Purchase, PurchaseKind } from "../purchases.types";

const PAGE_SIZE = 20;

type Props = { kind: PurchaseKind };

export default function PurchasesNative({ kind }: Props) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const meta = purchaseKindMeta(kind);

  const [rows, setRows] = useState<Purchase[]>([]);
  const [totalAmount, setTotalAmount] = useState(0);
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
      const res = await getPurchases(kind, page, PAGE_SIZE, debouncedSearch.trim());
      setRows(res.purchases);
      setTotalAmount(res.total_amount);
      setTotalPages(res.pagination.totalPages);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar los documentos");
    } finally {
      setLoading(false);
      setFetching(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [kind, page, debouncedSearch, refreshKey, hasLoadedOnce]);

  useEffect(() => {
    void load();
  }, [load]);

  const [importOpen, setImportOpen] = useState(false);
  const [retencionOf, setRetencionOf] = useState<Purchase | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const confirmDelete = (row: Purchase) => {
    const label = `${row.prefix ?? ""}${row.number ?? ""}` || "documento";
    Alert.alert(
      "Eliminar documento",
      `¿Eliminar el documento "${label}"? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Eliminar", style: "destructive", onPress: () => void handleDelete(row) },
      ]
    );
  };

  const handleDelete = async (row: Purchase) => {
    setDeletingId(row._id);
    try {
      await deletePurchase(row._id);
      successToast("Documento eliminado");
      if (rows.length === 1 && page > 1) setPage((p) => p - 1);
      else setRefreshKey((k) => k + 1);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo eliminar");
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>{meta.title}</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>{meta.subtitle}</Text>
      </View>

      <View style={[styles.toolbar, { borderBottomColor: colors.border }]}>
        <View style={[styles.searchBox, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.textMuted} />
          <TextInput
            style={[styles.searchInput, { color: colors.primaryText }]}
            placeholder="Buscar proveedor, NIT, número..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <Pressable style={[styles.createBtn, { backgroundColor: colors.accent }]} onPress={() => setImportOpen(true)}>
          <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      {rows.length > 0 ? (
        <View style={[styles.summary, { backgroundColor: colors.bgSubtle, borderBottomColor: colors.border }]}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>
            Total {meta.emptyLabel} (esta vista):
          </Text>
          <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 15 }}>
            {formatPurchaseTotal(totalAmount)}
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
        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={setPage} />

        {rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="archive-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No hay {meta.emptyLabel} importados todavía.
            </Text>
            <Pressable style={[styles.importBtn, { backgroundColor: colors.accent }]} onPress={() => setImportOpen(true)}>
              <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
              <Text style={styles.importBtnText}>Importar XML / ZIP</Text>
            </Pressable>
          </View>
        ) : (
          rows.map((r) => {
            const docNum = `${r.prefix ?? ""}${r.number ?? ""}` || "—";
            const hasRet = (r.total_retenido ?? 0) > 0;
            return (
              <View
                key={r._id}
                style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
              >
                <View style={styles.cardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.docType, { color: colors.textMuted }]}>
                      {DOC_LABELS[r.document_type_code ?? ""] ?? "Documento"}
                    </Text>
                    <Text style={[styles.cardTitle, { color: colors.primaryText }]}>{docNum}</Text>
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                      {r.supplier_name} · {r.supplier_doc}
                    </Text>
                    <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
                      {formatDateCO(r.issue_date)} · {formatPurchaseTotal(r.total, r.currency)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.badge,
                      { backgroundColor: r.import_source === "email" ? "#fef3c7" : "#d1fae5" },
                    ]}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: r.import_source === "email" ? "#92400e" : "#065f46",
                      }}
                    >
                      {r.import_source === "email" ? "Correo" : "Manual"}
                    </Text>
                  </View>
                </View>
                <View style={styles.actions}>
                  <Pressable
                    style={[
                      styles.iconBtn,
                      {
                        borderColor: hasRet ? colors.accent : colors.border,
                        backgroundColor: hasRet ? `${colors.accent}15` : "transparent",
                      },
                    ]}
                    onPress={() => setRetencionOf(r)}
                  >
                    <Ionicons name="calculator-outline" size={18} color={hasRet ? colors.accent : colors.primaryText} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                    onPress={() => confirmDelete(r)}
                    disabled={deletingId === r._id}
                  >
                    {deletingId === r._id ? (
                      <ActivityIndicator size="small" color="#dc2626" />
                    ) : (
                      <Ionicons name="trash-outline" size={18} color="#dc2626" />
                    )}
                  </Pressable>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <ImportModalNative
        visible={importOpen}
        kind={kind}
        onClose={() => setImportOpen(false)}
        onImported={() => setRefreshKey((k) => k + 1)}
      />
      <RetentionModalNative
        visible={!!retencionOf}
        purchase={retencionOf}
        onClose={() => setRetencionOf(null)}
        onApplied={() => {
          setRetencionOf(null);
          setRefreshKey((k) => k + 1);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchInput: { flex: 1, fontSize: 14 },
  createBtn: {
    width: 42,
    height: 42,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  empty: { textAlign: "center", fontSize: 14 },
  importBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    marginTop: 8,
  },
  importBtnText: { color: "#fff", fontWeight: "700" },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 10, gap: 10 },
  cardTop: { flexDirection: "row", gap: 10 },
  docType: { fontSize: 11, fontWeight: "600", textTransform: "uppercase" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
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

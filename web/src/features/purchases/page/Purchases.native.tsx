import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ImportModalNative from "../../../components/native/purchases/ImportModal.native";
import RetentionModalNative from "../../../components/native/purchases/RetentionModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { formatDateCO } from "../../../utils/format";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { deletePurchase, getPurchases, setPurchaseKind, uploadPurchasePdf } from "../purchases.service";
import { openPurchasePdfNative } from "../purchasePdf.native";
import { DOC_LABELS, formatPurchaseTotal, purchaseKindMeta } from "../purchases.shared";
import type { Purchase, PurchaseKind } from "../purchases.types";

const PAGE_SIZE = 20;

type Props = { kind: PurchaseKind };

export default function PurchasesNative({ kind }: Props) {
  const colors = useThemeColors();
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

  useRealtime(RealtimeEvents.PURCHASE_CHANGED, () => {
    setRefreshKey((k) => k + 1);
  });

  const [importOpen, setImportOpen] = useState(false);
  const [retencionOf, setRetencionOf] = useState<Purchase | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pdfBusyId, setPdfBusyId] = useState<string | null>(null);

  const handleViewPdf = async (row: Purchase) => {
    const label = `${row.prefix ?? ""}${row.number ?? ""}` || row._id;
    setPdfBusyId(row._id);
    try {
      await openPurchasePdfNative(row._id, label);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo abrir el PDF");
    } finally {
      setPdfBusyId(null);
    }
  };

  const handleUploadPdf = async (row: Purchase) => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const a = res.assets[0];
      setPdfBusyId(row._id);
      const r = await uploadPurchasePdf(row._id, {
        uri: a.uri,
        name: a.name,
        type: a.mimeType || "application/pdf",
      });
      successToast(r.message || "PDF adjuntado");
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo subir el PDF");
    } finally {
      setPdfBusyId(null);
    }
  };

  const handleReclassify = (row: Purchase) => {
    const target = kind === "purchase" ? "expense" : "purchase";
    const label = target === "expense" ? "Gastos" : "Compras";
    Alert.alert("Reclasificar", `¿Mover este documento a ${label}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Mover",
        onPress: async () => {
          try {
            const r = await setPurchaseKind(row._id, target);
            successToast(r.message || "Documento reclasificado");
            setRefreshKey((k) => k + 1);
          } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo reclasificar");
          }
        },
      },
    ]);
  };

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

  return (
    <>
      <DsModuleScreen
        title={meta.title}
        subtitle={meta.subtitle}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setRefreshKey((k) => k + 1);
        }}
        toolbar={
          <>
            <DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar proveedor, NIT, número..." />
            <DsButton
              label=""
              icon="cloud-upload-outline"
              compact
              onPress={() => setImportOpen(true)}
              style={{ minWidth: 44, paddingHorizontal: 0 }}
            />
          </>
        }
      >
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

        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={setPage} />

        {rows.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="archive-outline" size={40} color={colors.textMuted} />
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              No hay {meta.emptyLabel} importados todavía.
            </Text>
            <DsButton label="Importar XML / ZIP" icon="cloud-upload-outline" onPress={() => setImportOpen(true)} />
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
                      {(r.subtotal ?? 0) > 0 ? ` · Sub ${formatPurchaseTotal(r.subtotal, r.currency)}` : ""}
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
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                    onPress={() => void handleViewPdf(r)}
                    disabled={pdfBusyId === r._id}
                  >
                    {pdfBusyId === r._id ? (
                      <ActivityIndicator size="small" color={colors.headerAccent} />
                    ) : (
                      <Ionicons name="document-outline" size={18} color={colors.primaryText} />
                    )}
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                    onPress={() => void handleUploadPdf(r)}
                    disabled={pdfBusyId === r._id}
                  >
                    <Ionicons name="cloud-upload-outline" size={18} color={colors.primaryText} />
                  </Pressable>
                  <Pressable
                    style={[styles.iconBtn, { borderColor: colors.border }]}
                    onPress={() => handleReclassify(r)}
                  >
                    <Ionicons name="swap-horizontal-outline" size={18} color={colors.primaryText} />
                  </Pressable>
                  <Pressable
                    style={[
                      styles.iconBtn,
                      {
                        borderColor: hasRet ? colors.headerAccent : colors.border,
                        backgroundColor: hasRet ? `${colors.headerAccent}15` : "transparent",
                      },
                    ]}
                    onPress={() => setRetencionOf(r)}
                  >
                    <Ionicons name="calculator-outline" size={18} color={hasRet ? colors.headerAccent : colors.primaryText} />
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
      </DsModuleScreen>

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
    </>
  );
}

const styles = StyleSheet.create({
  summary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    marginBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  emptyWrap: { alignItems: "center", paddingVertical: 40, gap: 12 },
  empty: { textAlign: "center", fontSize: 14 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10, gap: 10 },
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

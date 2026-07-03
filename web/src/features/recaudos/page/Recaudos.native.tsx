import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSearchParams } from "react-router-dom";
import BatchPaymentModalNative from "../../../components/native/recaudos/BatchPaymentModal.native";
import PaymentModalNative from "../../../components/native/recaudos/PaymentModal.native";
import ReceiptsModalNative from "../../../components/native/recaudos/ReceiptsModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { getReceivables, getReceivablesSummary } from "../../../services/recaudos.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import { formatCOP, formatDateCO } from "../../../utils/format";
import {
  RECEIVABLE_STATUS_LABELS,
  type ReceivableInvoice,
  type ReceivablesSummary,
} from "../../../types";
import {
  RECEIVABLE_STATUS_STYLE,
  STATUS_FILTER_OPTIONS,
  clientKey,
  isInvoiceSelectable,
} from "../recaudos.shared";

const PAGE_SIZE = 20;

export default function RecaudosNative() {
  const colors = useThemeColors();
  const [searchParams, setSearchParams] = useSearchParams();
  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);

  const [invoices, setInvoices] = useState<ReceivableInvoice[]>([]);
  const [summary, setSummary] = useState<ReceivablesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(pageFromUrl);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const [payInvoice, setPayInvoice] = useState<ReceivableInvoice | null>(null);
  const [receiptsInvoice, setReceiptsInvoice] = useState<ReceivableInvoice | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchTerm]);

  useEffect(() => {
    if (page !== pageFromUrl) setPage(pageFromUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageFromUrl]);

  const loadInvoices = useCallback(async () => {
    if (hasLoadedOnce) setFetching(true);
    else setLoading(true);
    try {
      const response = await getReceivables(page, PAGE_SIZE, {
        status: statusFilter || undefined,
        cliente: debouncedSearch.trim() || undefined,
      });
      if (response) {
        setInvoices(response.invoices);
        setTotalPages(response.pagination.totalPages || 1);
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudieron cargar las facturas por cobrar");
    } finally {
      setLoading(false);
      setFetching(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [page, debouncedSearch, statusFilter, hasLoadedOnce]);

  useEffect(() => {
    void loadInvoices();
  }, [page, debouncedSearch, statusFilter, refreshKey]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const s = await getReceivablesSummary();
        if (!ignore && s) setSummary(s);
      } catch {
        /* resumen opcional */
      }
    })();
    return () => {
      ignore = true;
    };
  }, [refreshKey]);

  const selectedInvoices = useMemo(
    () => invoices.filter((i) => selectedIds.has(i._id)),
    [invoices, selectedIds]
  );

  const lockedClient = selectedInvoices.length > 0 ? clientKey(selectedInvoices[0]!) : null;

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (next.size === 0) setSearchTerm("");
      } else {
        next.add(id);
        if (prev.size === 0) {
          const inv = invoices.find((i) => i._id === id);
          const term = inv?.client_doc || inv?.client_name;
          if (term && searchTerm.trim() !== term) setSearchTerm(term);
        }
      }
      return next;
    });
  };

  const selectableInvoices = invoices.filter((i) =>
    isInvoiceSelectable(i, lockedClient, selectedIds)
  );
  const allSelected =
    selectableInvoices.length > 0 && selectableInvoices.every((i) => selectedIds.has(i._id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(selectableInvoices.map((i) => i._id)));
  };

  const handlePageChange = (next: number) => {
    const safe = Math.max(1, Math.min(totalPages, next));
    setPage(safe);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("page", String(safe));
      return p;
    });
  };

  const handlePaymentSuccess = () => {
    setSelectedIds(new Set());
    setSearchTerm("");
    setRefreshKey((k) => k + 1);
  };

  return (
    <>
      <DsModuleScreen
        title="Recaudos"
        subtitle="Carga los pagos de tus facturas y envía el comprobante de ingreso al cliente"
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          setRefreshKey((k) => k + 1);
        }}
        toolbar={<DsSearchField value={searchTerm} onChangeText={setSearchTerm} placeholder="Buscar por cliente o factura..." />}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 12 }}
          contentContainerStyle={styles.filterContent}
        >
          {STATUS_FILTER_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value || "all"}
              style={[
                styles.filterChip,
                statusFilter === opt.value ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border, borderWidth: 1 },
              ]}
              onPress={() => {
                setStatusFilter(opt.value);
                setPage(1);
                setSearchParams(new URLSearchParams());
              }}
            >
              <Text style={{ color: statusFilter === opt.value ? "#fff" : colors.primaryText, fontSize: 12 }}>
                {opt.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.kpiRow}>
        <View style={[styles.kpi, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>TOTAL POR COBRAR</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {summary ? formatCOP(summary.total_por_cobrar) : "—"}
          </Text>
        </View>
        <View style={[styles.kpi, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>VENCIDO</Text>
          <Text style={[styles.kpiValue, { color: "#dc2626" }]}>
            {summary ? formatCOP(summary.total_vencido) : "—"}
          </Text>
        </View>
        <View style={[styles.kpi, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.kpiLabel, { color: colors.textMuted }]}>FACTURAS</Text>
          <Text style={[styles.kpiValue, { color: colors.primary }]}>
            {summary ? summary.cantidad_facturas : "—"}
          </Text>
        </View>
      </View>

      {selectedIds.size > 0 ? (
        <View style={[styles.selBar, { backgroundColor: colors.bgSubtle, borderBottomColor: colors.border }]}>
          <Text style={[styles.selText, { color: colors.primaryText }]} numberOfLines={2}>
            {selectedIds.size} factura(s) · {selectedInvoices[0]?.client_name} ·{" "}
            {formatCOP(selectedInvoices.reduce((s, i) => s + i.balance, 0))}
          </Text>
          <View style={styles.selActions}>
            <Pressable
              onPress={() => {
                setSelectedIds(new Set());
                setSearchTerm("");
              }}
            >
              <Text style={[styles.selLink, { color: colors.headerAccent }]}>Limpiar</Text>
            </Pressable>
            <Pressable style={[styles.batchBtn, { backgroundColor: colors.headerAccent }]} onPress={() => setBatchOpen(true)}>
              <Ionicons name="cash-outline" size={16} color="#fff" />
              <Text style={styles.batchBtnText}>Recaudar</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

        {selectableInvoices.length > 0 ? (
          <Pressable style={styles.selectAllRow} onPress={toggleSelectAll}>
            <Ionicons
              name={allSelected ? "checkbox" : "square-outline"}
              size={20}
              color={colors.headerAccent}
            />
            <Text style={[styles.selectAllText, { color: colors.headerAccent }]}>
              {allSelected ? "Deseleccionar todas" : "Seleccionar todas visibles"}
            </Text>
          </Pressable>
        ) : null}

        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={handlePageChange} />

        {fetching && invoices.length === 0 ? (
          <ActivityIndicator color={colors.headerAccent} style={{ marginTop: 24 }} />
        ) : invoices.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay facturas por cobrar</Text>
        ) : (
          invoices.map((inv) => {
            const statusStyle = RECEIVABLE_STATUS_STYLE[inv.status];
            const selected = selectedIds.has(inv._id);
            const selectable = isInvoiceSelectable(inv, lockedClient, selectedIds);
            return (
              <View
                key={inv._id}
                style={[
                  styles.card,
                  getSoftCardShadow(colors),
                  {
                    backgroundColor: selected ? `${colors.headerAccent}11` : colors.cardBg,
                    borderColor: selected ? colors.headerAccent : colors.border,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <Pressable
                    onPress={() => toggleSelect(inv._id)}
                    disabled={!selectable && !selected}
                    style={{ opacity: !selectable && !selected ? 0.35 : 1 }}
                  >
                    <Ionicons
                      name={selected ? "checkbox" : "square-outline"}
                      size={22}
                      color={colors.headerAccent}
                    />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.invNumber, { color: colors.primary }]}>{inv.number}</Text>
                    <Text style={[styles.clientName, { color: colors.primaryText }]}>
                      {inv.client_name || "—"}
                    </Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: statusStyle.bg }]}>
                    <Text style={[styles.statusText, { color: statusStyle.color }]}>
                      {RECEIVABLE_STATUS_LABELS[inv.status] ?? inv.status}
                    </Text>
                  </View>
                </View>

                <View style={styles.metaGrid}>
                  <MetaItem label="Emisión" value={formatDateCO(inv.issued_at)} colors={colors} />
                  <MetaItem label="Vence" value={formatDateCO(inv.due_date)} colors={colors} />
                  <MetaItem label="Total" value={formatCOP(inv.total)} colors={colors} />
                  <MetaItem label="Abonado" value={formatCOP(inv.paid)} colors={colors} />
                </View>

                <View style={styles.balanceRow}>
                  <Text style={[styles.balanceLabel, { color: colors.textMuted }]}>Saldo</Text>
                  <Text style={[styles.balanceValue, { color: colors.primary }]}>{formatCOP(inv.balance)}</Text>
                  {(inv.nota_credito ?? 0) > 0 ? (
                    <Text style={[styles.ncHint, { color: colors.textMuted }]}>
                      NC −{formatCOP(inv.nota_credito)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.actions}>
                  {inv.balance > 0 ? (
                    <DsButton label="Recaudar" icon="cash-outline" compact onPress={() => setPayInvoice(inv)} />
                  ) : null}
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    onPress={() => setReceiptsInvoice(inv)}
                  >
                    <Ionicons name="receipt-outline" size={16} color={colors.headerAccent} />
                    <Text style={[styles.actionBtnText, { color: colors.headerAccent }]}>Comprobantes</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={handlePageChange} />
      </DsModuleScreen>

      <PaymentModalNative
        visible={!!payInvoice}
        invoice={payInvoice}
        onClose={() => setPayInvoice(null)}
        onSuccess={handlePaymentSuccess}
      />
      <ReceiptsModalNative
        visible={!!receiptsInvoice}
        invoice={receiptsInvoice}
        onClose={() => setReceiptsInvoice(null)}
      />
      <BatchPaymentModalNative
        visible={batchOpen}
        invoices={selectedInvoices}
        onClose={() => setBatchOpen(false)}
        onSuccess={handlePaymentSuccess}
      />
    </>
  );
}

function MetaItem({
  label,
  value,
  colors,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
}) {
  return (
    <View style={styles.metaItem}>
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.metaValue, { color: colors.primaryText }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filterContent: { gap: 8, alignItems: "center" },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  kpiRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  kpi: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    alignItems: "center",
  },
  kpiLabel: { fontSize: 9, fontWeight: "700", letterSpacing: 0.3, marginBottom: 4 },
  kpiValue: { fontSize: 15, fontWeight: "800" },
  selBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  selText: { flex: 1, fontSize: 13 },
  selActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  selLink: { fontSize: 13, fontWeight: "600" },
  batchBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
  },
  batchBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },
  selectAllRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  selectAllText: { fontSize: 13, fontWeight: "600" },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
    marginBottom: 12,
    gap: 10,
  },
  cardTop: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  invNumber: { fontSize: 16, fontWeight: "700" },
  clientName: { fontSize: 13, marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 10, fontWeight: "700" },
  metaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metaItem: { width: "47%" },
  metaLabel: { fontSize: 11 },
  metaValue: { fontSize: 13, fontWeight: "600" },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  balanceLabel: { fontSize: 13 },
  balanceValue: { fontSize: 17, fontWeight: "800" },
  ncHint: { fontSize: 11 },
  actions: { flexDirection: "row", gap: 8 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    borderColor: "transparent",
  },
  actionBtnTextPrimary: { color: "#fff", fontWeight: "700", fontSize: 13 },
  actionBtnText: { fontWeight: "600", fontSize: 13 },
});

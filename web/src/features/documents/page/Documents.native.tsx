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
import { useNavigate, useSearchParams } from "react-router-dom";
import NativeExportInvoicesModal from "../../../components/native/list/NativeExportInvoicesModal.native";
import TemplateRecurrenceModalNative from "../../../components/native/documents/TemplateRecurrenceModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { PATHS } from "../../../router/paths.contants";
import { getAllInvoices } from "../../../services/invoices.service";
import { createRemision } from "../../../services/remisiones.service";
import { setInvoiceTemplate } from "../../../services/plantillas.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { TipoDocElectronico, type Factura, type RecurrenceType } from "../../../types";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import {
  formatDocumentClient,
  formatDocumentDate,
  formatDocumentNumber,
  formatDocumentPrice,
  getDocumentStatus,
  getDocumentTipoInfo,
} from "../documents.shared";

const STATUS_OPTIONS = [
  { value: "APPROVED", label: "Aprobada" },
  { value: "REJECTED", label: "Rechazada" },
  { value: "SENT", label: "Enviada" },
];

const TIPO_OPTIONS = [
  { value: TipoDocElectronico.FACTURA, label: "Factura Electrónica" },
  { value: TipoDocElectronico.NOTA_DEBITO, label: "Nota Débito" },
  { value: TipoDocElectronico.NOTA_CREDITO, label: "Nota Crédito" },
  { value: TipoDocElectronico.DOCUMENTO_SOPORTE, label: "Documento Soporte" },
];

export default function DocumentsNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
  const [page, setPage] = useState(pageFromUrl);
  const [totalPages, setTotalPages] = useState(1);
  const [facturas, setFacturas] = useState<Factura[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filterTipo, setFilterTipo] = useState(searchParams.get("tipo_documento") ?? "");
  const [filterPrefijo, setFilterPrefijo] = useState(searchParams.get("prefijo") ?? "");
  const [filterCliente, setFilterCliente] = useState(searchParams.get("cliente") ?? "");
  const [filterTotal, setFilterTotal] = useState(searchParams.get("total") ?? "");
  const [filterEstado, setFilterEstado] = useState(searchParams.get("status") ?? "");
  const [committedPrefijo, setCommittedPrefijo] = useState(filterPrefijo);
  const [committedCliente, setCommittedCliente] = useState(filterCliente);
  const [committedTotal, setCommittedTotal] = useState(filterTotal);

  const [exportOpen, setExportOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [templateOf, setTemplateOf] = useState<Factura | null>(null);
  const [sortKey, setSortKey] = useState<"fecha" | "total" | "cliente">("fecha");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const hasActiveFilters = useMemo(
    () => [filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado].some((v) => v.trim()),
    [filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado]
  );

  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const loadInvoices = useCallback(async () => {
    if (hasLoadedOnce) setFetching(true);
    else setLoading(true);
    try {
      const response = await getAllInvoices(page, 20, {
        tipo_documento: filterTipo,
        prefijo: committedPrefijo,
        cliente: committedCliente,
        total: committedTotal,
        status: filterEstado,
      });
      if (response) {
        setFacturas(response.facturas);
        setTotalPages(response.pagination.totalPages);
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar facturas");
    } finally {
      setLoading(false);
      setFetching(false);
      setRefreshing(false);
      setHasLoadedOnce(true);
    }
  }, [page, filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado, hasLoadedOnce]);

  useEffect(() => {
    void loadInvoices();
  }, [page, filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado]);

  useRealtime(RealtimeEvents.INVOICE_CHANGED, () => {
    if (page === 1) void loadInvoices();
  });

  const sortedFacturas = useMemo(() => {
    const list = [...facturas];
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fecha") {
        cmp = String(a.fecha_emision ?? "").localeCompare(String(b.fecha_emision ?? ""));
      } else if (sortKey === "total") {
        cmp = (a.total ?? 0) - (b.total ?? 0);
      } else {
        cmp = formatDocumentClient(a).localeCompare(formatDocumentClient(b));
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [facturas, sortKey, sortDir]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setCommittedPrefijo(filterPrefijo), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterPrefijo]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedCliente(filterCliente), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterCliente]);

  useEffect(() => {
    const t = setTimeout(() => setCommittedTotal(filterTotal), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [filterTotal]);

  const handlePageChange = (next: number) => {
    const safe = Math.max(1, Math.min(totalPages, next));
    setPage(safe);
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("page", String(safe));
      return p;
    });
  };

  const updateFilter = (key: string, value: string) => {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.set("page", "1");
      const v = value.trim();
      if (!v) p.delete(key);
      else p.set(key, key === "status" ? v.toUpperCase() : v);
      return p;
    });
    setPage(1);
  };

  const clearFilters = () => {
    setFilterTipo("");
    setFilterPrefijo("");
    setFilterCliente("");
    setFilterTotal("");
    setFilterEstado("");
    setCommittedPrefijo("");
    setCommittedCliente("");
    setCommittedTotal("");
    setSearchParams(new URLSearchParams());
    setPage(1);
  };

  const handleSaveTemplate = async (recurrence: RecurrenceType) => {
    if (!templateOf) return;
    setBusyId(templateOf._id);
    try {
      await setInvoiceTemplate(templateOf._id, { is_template: true, recurrence });
      successToast("Factura guardada como plantilla");
      setTemplateOf(null);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo guardar la plantilla");
    } finally {
      setBusyId(null);
    }
  };

  const handleRemision = async (id: string) => {
    setBusyId(id);
    try {
      const res = await createRemision({ source: "invoice", source_id: id, send_email: true });
      successToast(res?.message || "Remisión generada y enviada al cliente");
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo generar la remisión");
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <DsModuleScreen
        title="Facturas"
        subtitle="Gestiona facturas, notas crédito y débito"
        loading
      />
    );
  }

  return (
    <>
      <DsModuleScreen
        title="Facturas"
        subtitle="Gestiona facturas, notas crédito y débito"
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void loadInvoices();
        }}
        noScroll
        toolbar={
          <>
            <DsButton
              label="Filtros"
              variant="secondary"
              icon="filter-outline"
              compact
              onPress={() => setFiltersOpen((o) => !o)}
              style={hasActiveFilters ? { borderColor: colors.headerAccent } : undefined}
            />
            <DsButton
              label="Excel"
              variant="secondary"
              icon="document-outline"
              compact
              onPress={() => setExportOpen(true)}
            />
            <DsButton label="Nueva" icon="add" compact onPress={() => navigate(PATHS.DOCUMENT_CREATE)} />
          </>
        }
      >

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, maxHeight: 40 }}>
        {(["fecha", "cliente", "total"] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => toggleSort(k)}
            style={[styles.chip, sortKey === k ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border, borderWidth: 1, marginRight: 8 }]}
          >
            <Text style={{ color: sortKey === k ? "#fff" : colors.primaryText, fontSize: 12 }}>
              {k === "fecha" ? "Fecha" : k === "cliente" ? "Cliente" : "Total"} {sortKey === k ? (sortDir === "asc" ? "↑" : "↓") : ""}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {filtersOpen ? (
        <View style={[styles.filters, { backgroundColor: colors.bgSubtle, borderBottomColor: colors.border }]}>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Tipo documento</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <Pressable
              style={[styles.chip, !filterTipo ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border }]}
              onPress={() => { setFilterTipo(""); updateFilter("tipo_documento", ""); }}
            >
              <Text style={{ color: !filterTipo ? "#fff" : colors.primaryText, fontSize: 12 }}>Todos</Text>
            </Pressable>
            {TIPO_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={[styles.chip, filterTipo === o.value ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border }]}
                onPress={() => { setFilterTipo(o.value); updateFilter("tipo_documento", o.value); }}
              >
                <Text style={{ color: filterTipo === o.value ? "#fff" : colors.primaryText, fontSize: 12 }}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {[
            { label: "Prefijo / Consecutivo", value: filterPrefijo, set: setFilterPrefijo, key: "prefijo" },
            { label: "Cliente", value: filterCliente, set: setFilterCliente, key: "cliente" },
            { label: "Total", value: filterTotal, set: setFilterTotal, key: "total" },
          ].map((f) => (
            <View key={f.key}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>{f.label}</Text>
              <TextInput
                style={[styles.filterInput, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
                value={f.value}
                onChangeText={f.set}
                placeholderTextColor={colors.textMuted}
              />
            </View>
          ))}

          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>Estado</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            <Pressable
              style={[styles.chip, !filterEstado ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border }]}
              onPress={() => { setFilterEstado(""); updateFilter("status", ""); }}
            >
              <Text style={{ color: !filterEstado ? "#fff" : colors.primaryText, fontSize: 12 }}>Todos</Text>
            </Pressable>
            {STATUS_OPTIONS.map((o) => (
              <Pressable
                key={o.value}
                style={[styles.chip, filterEstado === o.value ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border }]}
                onPress={() => { setFilterEstado(o.value); updateFilter("status", o.value); }}
              >
                <Text style={{ color: filterEstado === o.value ? "#fff" : colors.primaryText, fontSize: 12 }}>{o.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {hasActiveFilters ? (
            <Pressable onPress={clearFilters}>
              <Text style={[styles.clearLink, { color: colors.headerAccent }]}>Limpiar filtros</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void loadInvoices();
            }}
            tintColor={colors.headerAccent}
          />
        }
      >
        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={handlePageChange} />

        {fetching && facturas.length === 0 ? (
          <ActivityIndicator color={colors.headerAccent} style={{ marginTop: 24 }} />
        ) : facturas.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay facturas para mostrar</Text>
        ) : (
          sortedFacturas.map((factura) => {
            const tipo = getDocumentTipoInfo(factura);
            const status = getDocumentStatus(factura);
            const isBusy = busyId === factura._id;
            return (
              <View
                key={factura._id}
                style={[
                  styles.card,
                  getSoftCardShadow(colors),
                  { backgroundColor: colors.cardBg, borderColor: colors.border },
                ]}
              >
                <View style={styles.cardTop}>
                  <View style={[styles.typeBadge, { backgroundColor: `${tipo.color}22` }]}>
                    <Text style={[styles.typeText, { color: tipo.color }]}>{tipo.label}</Text>
                  </View>
                  <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
                    <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
                  </View>
                </View>

                <Text style={[styles.number, { color: colors.primary }]}>{formatDocumentNumber(factura)}</Text>
                <Text style={[styles.client, { color: colors.primaryText }]}>{formatDocumentClient(factura)}</Text>
                <View style={styles.metaRow}>
                  <Text style={[styles.meta, { color: colors.textMuted }]}>
                    {formatDocumentDate(factura.Encabezado.FechaYHoraDocumento || factura.Encabezado.FechaYHoraEmision || "")}
                  </Text>
                  <Text style={[styles.total, { color: colors.primary }]}>
                    {formatDocumentPrice(
                      factura.Totales.TotalMonetario.ValorAPagar.Value,
                      factura.Totales.TotalMonetario.ValorAPagar.IdMoneda
                    )}
                  </Text>
                </View>

                <View style={styles.actions}>
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.border }]}
                    onPress={() => navigate(`/documentos/${factura._id}`)}
                  >
                    <Ionicons name="eye-outline" size={16} color={colors.headerAccent} />
                    <Text style={[styles.actionText, { color: colors.headerAccent }]}>Ver</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }]}
                    disabled={isBusy}
                    onPress={() => setTemplateOf(factura)}
                  >
                    <Ionicons name="bookmark-outline" size={16} color={colors.headerAccent} />
                    <Text style={[styles.actionText, { color: colors.headerAccent }]}>Plantilla</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionBtn, { borderColor: colors.border, opacity: isBusy ? 0.6 : 1 }]}
                    disabled={isBusy}
                    onPress={() => void handleRemision(factura._id)}
                  >
                    {isBusy ? (
                      <ActivityIndicator size="small" color={colors.headerAccent} />
                    ) : (
                      <Ionicons name="car-outline" size={16} color={colors.headerAccent} />
                    )}
                    <Text style={[styles.actionText, { color: colors.headerAccent }]}>Remisión</Text>
                  </Pressable>
                </View>
              </View>
            );
          })
        )}

        <NativePagination page={page} totalPages={totalPages} loading={fetching} onChange={handlePageChange} />
      </ScrollView>
      </DsModuleScreen>

      <NativeExportInvoicesModal
        visible={exportOpen}
        onClose={() => setExportOpen(false)}
        defaultCliente={committedCliente}
        defaultStatus={filterEstado}
      />
      <TemplateRecurrenceModalNative
        visible={!!templateOf}
        onClose={() => setTemplateOf(null)}
        onConfirm={(r) => void handleSaveTemplate(r)}
        loading={!!templateOf && busyId === templateOf._id}
      />
    </>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 14, marginTop: 4 },
  toolbar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toolBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  toolText: { fontSize: 13, fontWeight: "600" },
  dot: { width: 8, height: 8, borderRadius: 4, marginLeft: 2 },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    marginLeft: "auto",
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  filters: { padding: 16, gap: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  filterLabel: { fontSize: 12, fontWeight: "600" },
  filterInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 4,
  },
  chipsRow: { marginBottom: 6 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  clearLink: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  typeText: { fontSize: 11, fontWeight: "700" },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: "700" },
  number: { fontSize: 17, fontWeight: "700" },
  client: { fontSize: 14, fontWeight: "500" },
  metaRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  meta: { fontSize: 13 },
  total: { fontSize: 15, fontWeight: "700" },
  actions: { flexDirection: "row", gap: 8, marginTop: 4 },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  actionText: { fontSize: 12, fontWeight: "600" },
});

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import LoadingScreen from "../../../router/LoadingScreen";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  listSyncJobs,
  runReconcile,
  getSummary,
  listReconciliations,
  importFaltante,
  type ReconItem,
  type ReconStatus,
  type ReconSummary,
} from "../reconcile.service";
import {
  runReconcileSales,
  getSalesSummary,
  listSalesReconciliations,
  importSalesFaltante,
  type SalesReconItem,
} from "../sales-reconcile.service";
import { formatCOP, fmtDate, STATUS_META, STATUS_META_SALES, syncJobLabel, type SyncJobOption } from "../reconcileUi";

type Kind = "purchases" | "sales";
type Item = ReconItem | SalesReconItem;

const statusMeta = (kind: Kind) => (kind === "sales" ? STATUS_META_SALES : STATUS_META);

export default function DianReconcileScreenNative({ kind }: { kind: Kind }) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const title = kind === "sales" ? "Conciliación DIAN emitidas" : "Conciliación DIAN recibidas";

  const [jobs, setJobs] = useState<SyncJobOption[]>([]);
  const [selectedJob, setSelectedJob] = useState("");
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [statusFilter, setStatusFilter] = useState<ReconStatus | "">("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [running, setRunning] = useState(false);
  const [importingId, setImportingId] = useState("");

  useEffect(() => {
    listSyncJobs()
      .then((r) => {
        setJobs(r.jobs);
        if (r.jobs[0]) setSelectedJob(r.jobs[0]._id);
      })
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error al cargar sync jobs"));
  }, []);

  const load = useCallback(async () => {
    if (!selectedJob) return;
    setLoading(true);
    try {
      const nit = debounced.trim() || undefined;
      if (kind === "sales") {
        const [sum, list] = await Promise.all([
          getSalesSummary(selectedJob),
          listSalesReconciliations({ syncJobId: selectedJob, status: statusFilter || undefined, nit, page, pageSize: 20 }),
        ]);
        setSummary(sum.summary);
        setItems(list.items);
        setTotal(list.total);
        setPageCount(list.pageCount);
      } else {
        const [sum, list] = await Promise.all([
          getSummary(selectedJob),
          listReconciliations({ syncJobId: selectedJob, status: statusFilter || undefined, nit, page, pageSize: 20 }),
        ]);
        setSummary(sum.summary);
        setItems(list.items);
        setTotal(list.total);
        setPageCount(list.pageCount);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar conciliación");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedJob, kind, statusFilter, debounced, page]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [selectedJob, statusFilter, debounced]);

  const onRun = async () => {
    if (!selectedJob) return;
    setRunning(true);
    try {
      const r = kind === "sales" ? await runReconcileSales(selectedJob) : await runReconcile(selectedJob);
      successToast(`OK: ${r.matchOk} · Revisar: ${r.mismatch} · Solo DIAN: ${r.dianOnly} · Solo local: ${r.localOnly}`);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al conciliar");
    } finally {
      setRunning(false);
    }
  };

  const onImport = (item: Item) => {
    if (item.status !== "dian_only") return;
    Alert.alert("Importar faltante", "¿Registrar este documento en el software?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Importar",
        onPress: async () => {
          setImportingId(item._id);
          try {
            if (kind === "sales") {
              await importSalesFaltante(item._id);
            } else {
              await importFaltante(item._id, "purchase");
            }
            successToast("Documento importado");
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo importar");
          } finally {
            setImportingId(null);
          }
        },
      },
    ]);
  };

  const meta = statusMeta(kind);

  if (!selectedJob && loading) return <LoadingScreen />;

  const summaryLine = summary
    ? `OK ${summary.match_ok} · Revisar ${summary.mismatch} · DIAN ${summary.dian_only} · Local ${summary.local_only}`
    : undefined;

  return (
    <DsModuleScreen
      title={title}
      subtitle={summaryLine}
      loading={loading && items.length === 0 && !!selectedJob}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
      noScroll
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 8 }}>
        {jobs.map((j) => (
          <Pressable
            key={j._id}
            onPress={() => setSelectedJob(j._id)}
            style={[
              styles.chip,
              selectedJob === j._id
                ? { borderColor: colors.headerAccent, backgroundColor: colors.headerAccent }
                : { borderColor: colors.border },
            ]}
          >
            <Text style={{ color: selectedJob === j._id ? "#fff" : colors.primaryText, fontSize: 12 }}>
              {syncJobLabel(j)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={{ paddingHorizontal: 16, gap: 8, paddingTop: 8 }}>
        <DsButton
          label={running ? "Conciliando…" : "Ejecutar conciliación"}
          onPress={onRun}
          disabled={running || !selectedJob}
          loading={running}
        />
        <DsSearchField value={search} onChangeText={setSearch} placeholder="Filtrar por NIT/emisor…" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {(["", "match_ok", "mismatch", "dian_only", "local_only"] as const).map((s) => (
            <Pressable
              key={s || "all"}
              onPress={() => setStatusFilter(s)}
              style={[
                styles.chip,
                statusFilter === s
                  ? { borderColor: colors.headerAccent, backgroundColor: colors.headerAccent }
                  : { borderColor: colors.border },
              ]}
            >
              <Text style={{ color: statusFilter === s ? "#fff" : colors.textMuted, fontSize: 12 }}>
                {s ? meta[s].label : "Todos"}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}
      >
        {loading && items.length === 0 ? (
          <ActivityIndicator color={colors.headerAccent} />
        ) : items.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sin resultados ({total})</Text>
        ) : (
          items.map((it) => (
            <View
              key={it._id}
              style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}
            >
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>
                  {(it.prefijo || "")}{it.folio ? `-${it.folio}` : ""}
                </Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{meta[it.status].label}</Text>
              </View>
              <Text style={{ color: colors.textMuted, marginTop: 4 }}>{it.nombre_emisor || it.nit_emisor || "—"}</Text>
              <Text style={{ color: colors.primary, marginTop: 4 }}>{formatCOP(it.total)} · {fmtDate(it.fecha_emision)}</Text>
              {it.status === "dian_only" ? (
                <DsButton
                  label={importingId === it._id ? "Importando…" : "Importar"}
                  onPress={() => onImport(it)}
                  disabled={importingId === it._id}
                  loading={importingId === it._id}
                  style={{ marginTop: 10 }}
                />
              ) : null}
            </View>
          ))
        )}

        {pageCount > 1 ? (
          <View style={styles.pager}>
            <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
              <Text style={{ color: colors.primary }}>Anterior</Text>
            </Pressable>
            <Text style={{ color: colors.textMuted }}>{page}/{pageCount}</Text>
            <Pressable disabled={page >= pageCount} onPress={() => setPage((p) => p + 1)}>
              <Text style={{ color: colors.primary }}>Siguiente</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
  pager: { flexDirection: "row", justifyContent: "space-between", marginTop: 12 },
});

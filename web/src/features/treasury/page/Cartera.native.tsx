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
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import { DsModuleScreen, DsSearchField, DsSideModal } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  carteraDetalleCliente,
  carteraPorCliente,
  recaudarCliente,
  type ClienteCartera,
  type FacturaCartera,
} from "../conciliacion.service";
import { formatCOP, formatDate } from "../treasury.shared";

export default function CarteraNative() {
  const colors = useThemeColors();
  const [clientes, setClientes] = useState<ClienteCartera[]>([]);
  const [totales, setTotales] = useState({ clientes: 0, facturado: 0, pagado: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [soloPendientes, setSoloPendientes] = useState(true);

  const [abierto, setAbierto] = useState<ClienteCartera | null>(null);
  const [detalle, setDetalle] = useState<FacturaCartera[]>([]);
  const [detLoading, setDetLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [recaudando, setRecaudando] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await carteraPorCliente({ search: debounced.trim() || undefined, soloPendientes });
      setClientes(r.clientes);
      setTotales(r.totales);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar cartera");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced, soloPendientes]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const abrirCliente = async (c: ClienteCartera) => {
    setAbierto(c);
    setDetLoading(true);
    setSel(new Set());
    try {
      const r = await carteraDetalleCliente(c.nit, soloPendientes);
      setDetalle(r.documentos);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar detalle");
      setAbierto(null);
    } finally {
      setDetLoading(false);
    }
  };

  const toggleSel = (id: string) => {
    setSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRecaudar = () => {
    if (!abierto) return;
    const ids = sel.size ? Array.from(sel) : undefined;
    Alert.alert(
      "Recaudar cliente",
      ids ? `¿Marcar ${ids.length} factura(s) como recaudadas?` : "¿Recaudar todas las facturas pendientes?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Recaudar",
          onPress: async () => {
            setRecaudando(true);
            try {
              const r = await recaudarCliente(abierto.nit, ids);
              successToast(r.message || "Recaudo registrado");
              setAbierto(null);
              setRefreshing(true);
              await load();
            } catch (e) {
              errorToast(e instanceof Error ? e.message : "Error al recaudar");
            } finally {
              setRecaudando(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <DsModuleScreen
        title="Cartera"
        subtitle="Saldos por cobrar agrupados por cliente"
        loading={loading && !refreshing}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar cliente o NIT…" />}
      >
        <View style={styles.kpiRow}>
          <AnalyticsKpiNative label="Saldo cartera" value={formatCOP(totales.saldo)} icon="arrow-down-outline" accent="#22c55e" />
          <AnalyticsKpiNative label="Facturado" value={formatCOP(totales.facturado)} icon="document-text-outline" accent="#3b82f6" />
        </View>

        <Pressable onPress={() => setSoloPendientes((v) => !v)} style={[styles.toggle, { borderColor: colors.border }]}>
          <Ionicons name={soloPendientes ? "checkbox" : "square-outline"} size={20} color={colors.headerAccent} />
          <Text style={{ color: colors.primaryText }}>Solo con saldo pendiente</Text>
        </Pressable>

        {clientes.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 32 }}>Sin clientes en cartera.</Text>
        ) : (
          clientes.map((c) => (
            <Pressable
              key={c.nit}
              onPress={() => abrirCliente(c)}
              style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={[styles.name, { color: colors.primaryText }]}>{c.nombre}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{c.nit}</Text>
              <View style={styles.row}>
                <Text style={{ color: colors.textMuted }}>{c.nPendientes} pend.</Text>
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatCOP(c.saldo)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </DsModuleScreen>

      <DsSideModal
        visible={!!abierto}
        onClose={() => setAbierto(null)}
        title={abierto?.nombre ?? "Cliente"}
        icon="person-outline"
        closeDisabled={recaudando}
        footer={
          detLoading ? null : (
            <View style={{ flex: 1 }}>
              <LedgerPrimaryBtn
                label={sel.size ? `Recaudar ${sel.size} factura(s)` : "Recaudar todas"}
                icon="cash-outline"
                onPress={handleRecaudar}
                loading={recaudando}
              />
            </View>
          )
        }
      >
        {detLoading ? (
          <ActivityIndicator color={colors.headerAccent} style={{ marginTop: 40 }} />
        ) : (
          detalle.map((f) => (
            <Pressable
              key={f.id}
              onPress={() => toggleSel(f.id)}
              style={[styles.factCard, { borderColor: colors.border, backgroundColor: sel.has(f.id) ? colors.bgSubtle : colors.cardBg }]}
            >
              <View style={styles.factTop}>
                <Ionicons name={sel.has(f.id) ? "checkbox" : "square-outline"} size={20} color={colors.headerAccent} />
                <Text style={{ color: colors.primaryText, fontWeight: "700", flex: 1 }}>{f.numero}</Text>
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatCOP(f.saldo)}</Text>
              </View>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {formatDate(f.fecha ?? undefined)} · Total {formatCOP(f.total)} · Pagado {formatCOP(f.pagado)}
              </Text>
            </Pressable>
          ))
        )}
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  factCard: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginBottom: 8 },
  factTop: { flexDirection: "row", alignItems: "center", gap: 10 },
});

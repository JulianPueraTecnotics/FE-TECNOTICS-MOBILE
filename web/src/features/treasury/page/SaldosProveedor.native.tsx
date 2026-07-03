import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  cxpDetalleProveedor,
  cxpPorProveedor,
  pagarProveedor,
  type CompraCxp,
  type ProveedorCxp,
} from "../conciliacion.service";
import { formatCOP, formatDate } from "../treasury.shared";

export default function SaldosProveedorNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [proveedores, setProveedores] = useState<ProveedorCxp[]>([]);
  const [totales, setTotales] = useState({ proveedores: 0, total: 0, pagado: 0, saldo: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [soloPendientes, setSoloPendientes] = useState(true);

  const [abierto, setAbierto] = useState<ProveedorCxp | null>(null);
  const [detalle, setDetalle] = useState<CompraCxp[]>([]);
  const [detLoading, setDetLoading] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [pagando, setPagando] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await cxpPorProveedor({ search: debounced.trim() || undefined, soloPendientes });
      setProveedores(r.proveedores);
      setTotales(r.totales);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar saldos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced, soloPendientes]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  const abrirProveedor = async (p: ProveedorCxp) => {
    setAbierto(p);
    setDetLoading(true);
    setSel(new Set());
    try {
      const r = await cxpDetalleProveedor(p.doc, soloPendientes);
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

  const handlePagar = () => {
    if (!abierto) return;
    const ids = sel.size ? Array.from(sel) : undefined;
    Alert.alert(
      "Pagar proveedor",
      ids ? `¿Pagar ${ids.length} documento(s) desde la bolsa?` : "¿Pagar toda la cartera pendiente del proveedor?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Pagar",
          onPress: async () => {
            setPagando(true);
            try {
              const r = await pagarProveedor(abierto.doc, ids ? { facturaIds: ids } : {});
              successToast(r.message || "Pago registrado");
              setAbierto(null);
              setRefreshing(true);
              await load();
            } catch (e) {
              errorToast(e instanceof Error ? e.message : "Error al pagar");
            } finally {
              setPagando(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <DsModuleScreen
        title="Saldos por proveedor"
        subtitle="Cuentas por pagar agrupadas por proveedor"
        loading={loading && !refreshing}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar proveedor o NIT…" />}
      >
        <View style={styles.kpiRow}>
          <AnalyticsKpiNative label="Por pagar" value={formatCOP(totales.saldo)} icon="arrow-up-outline" accent="#ef4444" />
          <AnalyticsKpiNative label="Comprado" value={formatCOP(totales.total)} icon="cart-outline" accent="#3b82f6" />
        </View>

        <Pressable onPress={() => setSoloPendientes((v) => !v)} style={styles.toggle}>
          <Ionicons name={soloPendientes ? "checkbox" : "square-outline"} size={20} color={colors.headerAccent} />
          <Text style={{ color: colors.primaryText }}>Solo con saldo pendiente</Text>
        </Pressable>

        {proveedores.map((p) => (
          <Pressable
            key={p.doc}
            onPress={() => abrirProveedor(p)}
            style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <Text style={[styles.name, { color: colors.primaryText }]}>{p.nombre}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{p.doc}</Text>
            <View style={styles.row}>
              <Text style={{ color: colors.textMuted }}>{p.nPendientes} pend.</Text>
              <Text style={{ color: "#dc2626", fontWeight: "700" }}>{formatCOP(p.saldo)}</Text>
            </View>
          </Pressable>
        ))}
      </DsModuleScreen>

      <Modal visible={!!abierto} animationType="slide" onRequestClose={() => setAbierto(null)}>
        <View style={{ flex: 1, backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }}>
          <View style={[styles.modalHead, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setAbierto(null)}>
              <Ionicons name="close" size={26} color={colors.primaryText} />
            </Pressable>
            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 17, flex: 1, textAlign: "center" }} numberOfLines={1}>
              {abierto?.nombre}
            </Text>
            <View style={{ width: 26 }} />
          </View>

          {detLoading ? (
            <ActivityIndicator color={colors.headerAccent} style={{ marginTop: 40 }} />
          ) : (
            <>
              <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
                {detalle.map((f) => (
                  <Pressable
                    key={f.id}
                    onPress={() => toggleSel(f.id)}
                    style={[styles.factCard, { borderColor: colors.border, backgroundColor: sel.has(f.id) ? colors.bgSubtle : colors.cardBg }]}
                  >
                    <View style={styles.factTop}>
                      <Ionicons name={sel.has(f.id) ? "checkbox" : "square-outline"} size={20} color={colors.headerAccent} />
                      <Text style={{ color: colors.primaryText, fontWeight: "700", flex: 1 }}>{f.numero}</Text>
                      <Text style={{ color: "#dc2626", fontWeight: "700" }}>{formatCOP(f.saldo)}</Text>
                    </View>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      {formatDate(f.fecha ?? undefined)} · Total {formatCOP(f.total)}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
              <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.paddingBottom + 8, backgroundColor: colors.cardBg }]}>
                <LedgerPrimaryBtn label={sel.size ? `Pagar ${sel.size} doc(s)` : "Pagar todo"} icon="card-outline" onPress={handlePagar} loading={pagando} />
              </View>
            </>
          )}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  toggle: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 8, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  name: { fontSize: 15, fontWeight: "700" },
  row: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  modalHead: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  factCard: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginBottom: 8 },
  factTop: { flexDirection: "row", alignItems: "center", gap: 10 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
});

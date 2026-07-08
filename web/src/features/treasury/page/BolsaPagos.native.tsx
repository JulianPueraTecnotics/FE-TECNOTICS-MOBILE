import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import { DsField, DsModuleScreen, DsSideModal } from "../../../components/design-system-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { reclasificarBolsa, saldoBolsa, type ConceptoBolsa } from "../conciliacion.service";
import { formatCOP } from "../treasury.shared";

export default function BolsaPagosNative() {
  const colors = useThemeColors();
  const [data, setData] = useState({ metido: 0, asignado: 0, saldoSinAsignar: 0, conceptos: [] as ConceptoBolsa[] });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reclas, setReclas] = useState<ConceptoBolsa | null>(null);
  const [cuentaDestino, setCuentaDestino] = useState("");
  const [aplicando, setAplicando] = useState(false);

  const load = useCallback(async () => {
    try {
      const api = await saldoBolsa();
      setData({
        metido: api.metido,
        asignado: api.asignado,
        saldoSinAsignar: api.saldoSinAsignar,
        conceptos: api.conceptos,
      });
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar bolsa");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleReclasificar = () => {
    if (!reclas || !cuentaDestino.trim()) {
      errorToast("Indica la cuenta destino del PUC");
      return;
    }
    Alert.alert("Reclasificar", `¿Mover "${reclas.concepto}" a la cuenta ${cuentaDestino}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Reclasificar",
        onPress: async () => {
          setAplicando(true);
          try {
            const r = await reclasificarBolsa(cuentaDestino.trim(), { concepto: reclas.concepto });
            successToast(r.message || "Reclasificación aplicada");
            setReclas(null);
            setCuentaDestino("");
            setRefreshing(true);
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al reclasificar");
          } finally {
            setAplicando(false);
          }
        },
      },
    ]);
  };

  return (
    <>
      <DsModuleScreen
        title="Bolsa de pagos"
        subtitle="Egresos del banco aún no aplicados a proveedores (cuenta bolsa 22050501)"
        loading={loading && !refreshing}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
      >
        <View style={styles.kpiRow}>
          <AnalyticsKpiNative label="Sin asignar" value={formatCOP(data.saldoSinAsignar)} icon="wallet-outline" accent="#ef4444" />
          <AnalyticsKpiNative label="Metido" value={formatCOP(data.metido)} icon="arrow-down-outline" accent="#14b8a6" />
          <AnalyticsKpiNative label="Asignado" value={formatCOP(data.asignado)} icon="checkmark-circle-outline" accent="#22c55e" />
        </View>

        {data.conceptos.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>Bolsa vacía o sin conceptos pendientes.</Text>
        ) : (
          data.conceptos.map((c) => (
            <Pressable
              key={c.concepto}
              onPress={() => {
                setReclas(c);
                setCuentaDestino("");
              }}
              style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Text style={[styles.concepto, { color: colors.primaryText }]}>{c.concepto}</Text>
              <View style={styles.row}>
                <Text style={{ color: colors.textMuted }}>{c.n} movimiento(s)</Text>
                <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{formatCOP(c.suma)}</Text>
              </View>
            </Pressable>
          ))
        )}
      </DsModuleScreen>

      <DsSideModal
        visible={!!reclas}
        onClose={() => setReclas(null)}
        title="Reclasificar concepto"
        icon="swap-horizontal-outline"
        closeDisabled={aplicando}
        submitting={aplicando}
        submitLabel="Aplicar"
        onSubmit={() => void handleReclasificar()}
      >
        <Text style={{ color: colors.textMuted }}>{reclas?.concepto} · {formatCOP(reclas?.suma ?? 0)}</Text>
        <DsField
          label="Cuenta destino (PUC)"
          icon="calculator-outline"
          value={cuentaDestino}
          onChangeText={setCuentaDestino}
          placeholder="Ej. 510506"
          keyboardType="number-pad"
        />
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  kpiRow: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  concepto: { fontSize: 14, fontWeight: "700", marginBottom: 6 },
  row: { flexDirection: "row", justifyContent: "space-between" },
});

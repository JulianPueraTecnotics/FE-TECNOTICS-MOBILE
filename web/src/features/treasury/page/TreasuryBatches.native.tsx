import { useCallback, useEffect, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { getBatches, markBatchSent, reconcileBatch, sendComprobantes } from "../treasury.service";
import { downloadBatchFileNative } from "../treasury.service.native";
import type { PaymentBatch } from "../treasury.types";
import { BATCH_STATUS, formatCOP, formatDate } from "../treasury.shared";

export default function TreasuryBatchesNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [batches, setBatches] = useState<PaymentBatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getBatches(1, 50);
      setBatches(res.batches);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar lotes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const onDownload = async (b: PaymentBatch) => {
    setBusyId(b._id);
    try {
      await downloadBatchFileNative(b._id, b.archivo_nombre);
      successToast("Archivo listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setBusyId(null);
    }
  };

  const onSent = async (b: PaymentBatch) => {
    setBusyId(b._id);
    try {
      await markBatchSent(b._id);
      successToast("Lote marcado como enviado");
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const onReconcile = (b: PaymentBatch) => {
    Alert.alert("Conciliar lote", `¿Confirmas que el lote #${b.consecutivo} fue pagado?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Conciliar",
        onPress: async () => {
          setBusyId(b._id);
          try {
            const res = await reconcileBatch(b._id);
            successToast(res.message || "Lote conciliado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  const onComprobantes = async (b: PaymentBatch) => {
    setBusyId(b._id);
    try {
      const res = await sendComprobantes(b._id);
      successToast(`Enviados: ${res.enviados}, sin correo: ${res.sinCorreo}, errores: ${res.errores}`);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Lotes de pago</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Descarga ACH, marca envío y concilia pagos</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
      >
        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : batches.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
            Sin lotes. Genera uno desde Pagos a proveedores.
          </Text>
        ) : (
          batches.map((b) => {
            const st = BATCH_STATUS[b.status] ?? { label: b.status, tone: "neutral" as const };
            const busy = busyId === b._id;
            return (
              <View key={b._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                <LedgerRow
                  cells={[
                    { value: `Lote #${b.consecutivo}`, bold: true },
                    { value: formatCOP(b.total_amount), align: "right", bold: true },
                  ]}
                />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {b.bank?.nombre} · {formatDate(b.generado_en)} · {b.total_registros} registros
                </Text>
                <LedgerStatusBadge label={st.label} tone={st.tone} />
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  <LedgerPrimaryBtn label="Archivo" variant="secondary" onPress={() => onDownload(b)} loading={busy} disabled={!!busyId && !busy} />
                  {b.status === "generated" ? (
                    <LedgerPrimaryBtn label="Enviado" variant="secondary" onPress={() => onSent(b)} loading={busy} disabled={!!busyId && !busy} />
                  ) : null}
                  {b.status !== "reconciled" ? (
                    <LedgerPrimaryBtn label="Conciliar" onPress={() => onReconcile(b)} disabled={!!busyId} />
                  ) : null}
                  {b.status === "reconciled" ? (
                    <LedgerPrimaryBtn label="Comprobantes" variant="secondary" onPress={() => onComprobantes(b)} loading={busy} disabled={!!busyId && !busy} />
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 4 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
});

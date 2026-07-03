import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { deleteRemision, downloadRemision, getRemisiones, sendRemisionEmail } from "../../../services/remisiones.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { IRemision } from "../../../types";
import { REMISION_STATUS_LABELS, type RemisionStatus } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { sharePdfFromResponse } from "../../../utils/sharePdf.native";
import { formatCOP } from "../../quotes/quotes.utils";

const PAGE_SIZE = 20;
const STATUSES: RemisionStatus[] = ["pending", "signed", "rejected"];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

export default function RemisionesNative() {
  const colors = useThemeColors();
  const [remisiones, setRemisiones] = useState<IRemision[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getRemisiones(page, PAGE_SIZE, {
        status: statusFilter || undefined,
        cliente: debounced.trim() || undefined,
      });
      if (res) {
        setRemisiones(res.remisiones);
        setTotalPages(res.pagination.totalPages || 1);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudieron cargar las remisiones");
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter]);

  const statusTone = (s: RemisionStatus) => (s === "signed" ? "ok" : s === "rejected" ? "bad" : "warn");

  const onDelete = (r: IRemision) => {
    Alert.alert("Eliminar", `¿Eliminar remisión ${r.number}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          setBusyId(r._id + "del");
          try {
            await deleteRemision(r._id);
            successToast("Remisión eliminada");
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

  return (
    <DsModuleScreen
      title="Remisiones"
      subtitle="Entregas firmadas por el cliente"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar remisión o cliente..." />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <LedgerChipRow>
          <LedgerChip label="Todas" active={statusFilter === ""} onPress={() => setStatusFilter("")} />
          {STATUSES.map((s) => (
            <LedgerChip
              key={s}
              label={REMISION_STATUS_LABELS[s]}
              active={statusFilter === s}
              onPress={() => setStatusFilter(statusFilter === s ? "" : s)}
            />
          ))}
        </LedgerChipRow>
      </ScrollView>

        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : remisiones.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
            No hay remisiones. Genera una desde una factura o cotización.
          </Text>
        ) : (
          remisiones.map((r) => (
            <View key={r._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Text style={{ fontWeight: "700", color: colors.primaryText }}>{r.number}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                {r.client_name} · {formatDate(r.createdAt)}
              </Text>
              {r.source_number ? (
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>Origen: {r.source_number}</Text>
              ) : null}
              <Text style={{ color: colors.primaryText, marginVertical: 4 }}>{formatCOP(r.total)}</Text>
              <LedgerStatusBadge label={REMISION_STATUS_LABELS[r.status]} tone={statusTone(r.status)} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <LedgerPrimaryBtn
                  label="Reenviar firma"
                  variant="secondary"
                  loading={busyId === r._id + "send"}
                  onPress={async () => {
                    setBusyId(r._id + "send");
                    try {
                      await sendRemisionEmail(r._id);
                      successToast("Link de firma enviado");
                    } catch (e) {
                      errorToast(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                <LedgerPrimaryBtn
                  label="PDF"
                  variant="secondary"
                  loading={busyId === r._id + "pdf"}
                  onPress={async () => {
                    setBusyId(r._id + "pdf");
                    try {
                      const res = await downloadRemision(r._id);
                      if (!res) throw new Error("Sin respuesta");
                      await sharePdfFromResponse(res, `${r.number}.pdf`);
                    } catch (e) {
                      errorToast(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                <LedgerPrimaryBtn label="Eliminar" variant="danger" loading={busyId === r._id + "del"} onPress={() => onDelete(r)} />
              </View>
            </View>
          ))
        )}
        <NativePagination page={page} totalPages={totalPages} loading={loading} onChange={setPage} />
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 10 },
});

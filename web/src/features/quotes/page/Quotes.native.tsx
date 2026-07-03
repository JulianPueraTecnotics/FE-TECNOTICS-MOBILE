import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-dom";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import {
  convertQuoteToInvoice,
  deleteQuote,
  downloadQuoteById,
  getAllQuotes,
  searchQuotes,
  sendQuoteEmail,
} from "../../../services/quotes.service";
import { createRemision } from "../../../services/remisiones.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { IQuote } from "../../../types";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "../../../types";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { sharePdfFromResponse } from "../../../utils/sharePdf.native";
import { formatCOP } from "../quotes.utils";

const PAGE_SIZE = 20;
const STATUSES: (QuoteStatus | "")[] = ["", "draft", "sent", "accepted", "rejected", "invoiced"];

export default function QuotesNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [quotes, setQuotes] = useState<IQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAmount, setTotalAmount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = debounced.trim();
      const res = q
        ? await searchQuotes(q, page, PAGE_SIZE)
        : await getAllQuotes(page, PAGE_SIZE, statusFilter ? { status: statusFilter } : undefined);
      if (res) {
        setQuotes(res.quotes);
        setTotalPages(res.pagination.totalPages);
        setTotalAmount(res.total_amount ?? null);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar cotizaciones");
    } finally {
      setLoading(false);
    }
  }, [page, debounced, statusFilter]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, statusFilter]);

  const onDelete = (q: IQuote) => {
    Alert.alert("Eliminar", `¿Eliminar cotización ${q.number}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteQuote(q._id);
            successToast("Cotización eliminada");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const statusTone = (s: QuoteStatus) =>
    s === "accepted" || s === "invoiced" ? "ok" : s === "rejected" ? "bad" : "warn";

  return (
    <DsModuleScreen
      title="Cotizaciones"
      subtitle="Propuestas comerciales para tus clientes"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar cliente o número..." />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <LedgerChipRow>
          {STATUSES.map((s) => (
            <LedgerChip
              key={s || "all"}
              label={s ? QUOTE_STATUS_LABELS[s as QuoteStatus] : "Todos"}
              active={statusFilter === s}
              onPress={() => setStatusFilter(statusFilter === s ? "" : s)}
            />
          ))}
        </LedgerChipRow>
      </ScrollView>
      <DsButton label="Nueva cotización" icon="add" onPress={() => navigate(PATHS.SALES_COTIZACIONES_NUEVA)} compact />
        {totalAmount != null ? (
          <Text style={{ color: colors.textMuted, marginVertical: 8 }}>Total listado: {formatCOP(totalAmount)}</Text>
        ) : null}

        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : quotes.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin cotizaciones.</Text>
        ) : (
          quotes.map((q) => (
            <View key={q._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <Text style={{ fontWeight: "700", color: colors.primaryText }}>{q.number}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{q.client_name}</Text>
              <Text style={{ color: colors.primaryText, marginVertical: 4 }}>{formatCOP(q.total)}</Text>
              <LedgerStatusBadge label={QUOTE_STATUS_LABELS[q.status]} tone={statusTone(q.status)} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => navigate(PATHS.SALES_COTIZACIONES_EDITAR(q._id))} />
                <LedgerPrimaryBtn
                  label="Enviar"
                  variant="secondary"
                  loading={busyId === q._id + "send"}
                  onPress={async () => {
                    setBusyId(q._id + "send");
                    try {
                      await sendQuoteEmail(q._id);
                      successToast("Enviada por correo");
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
                  loading={busyId === q._id + "pdf"}
                  onPress={async () => {
                    setBusyId(q._id + "pdf");
                    try {
                      const res = await downloadQuoteById(q._id);
                      if (!res) throw new Error("Sin respuesta");
                      await sharePdfFromResponse(res, `${q.number}.pdf`);
                    } catch (e) {
                      errorToast(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                <LedgerPrimaryBtn
                  label="Remisión"
                  variant="secondary"
                  loading={busyId === q._id + "rem"}
                  onPress={async () => {
                    setBusyId(q._id + "rem");
                    try {
                      await createRemision({ source: "quote", source_id: q._id, send_email: true });
                      successToast("Remisión creada");
                    } catch (e) {
                      errorToast(e instanceof Error ? e.message : "Error");
                    } finally {
                      setBusyId(null);
                    }
                  }}
                />
                {q.status !== "invoiced" ? (
                  <LedgerPrimaryBtn
                    label="Facturar"
                    loading={busyId === q._id + "inv"}
                    onPress={async () => {
                      setBusyId(q._id + "inv");
                      try {
                        await convertQuoteToInvoice(q._id);
                        successToast("Convertida a factura");
                        load();
                      } catch (e) {
                        errorToast(e instanceof Error ? e.message : "Error");
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                ) : null}
                <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDelete(q)} />
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

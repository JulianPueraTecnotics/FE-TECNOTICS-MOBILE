import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useParams } from "react-router-dom";
import { DsField, DsSideModal } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { sharePdfFromResponse } from "../../../utils/sharePdf.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import type { IQuote } from "../../../types";
import { QUOTE_STATUS_LABELS, type QuoteStatus } from "../../../types";
import { approvePublicQuote, downloadPublicQuote, getPublicQuote } from "../../../services/quotes.service";
import { formatCOP } from "../quotes.utils";

const formatDate = (iso?: string) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

export default function PublicQuoteNative() {
  const colors = useThemeColors();
  const { slug = "" } = useParams();
  const [quote, setQuote] = useState<IQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [showApprove, setShowApprove] = useState(false);
  const [code, setCode] = useState("");
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicQuote(slug);
      if (res?.quote) setQuote(res.quote);
      else setNotFound(true);
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadPublicQuote(slug);
      if (!res) throw new Error("Sin respuesta");
      await sharePdfFromResponse(res, `${quote?.number || "cotizacion"}.pdf`);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDownloading(false);
    }
  };

  const handleApprove = async () => {
    if (!code.trim()) return errorToast("Ingresa el código de aprobación");
    setApproving(true);
    try {
      await approvePublicQuote(slug, code.trim());
      successToast("Cotización aprobada");
      setShowApprove(false);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Código inválido");
    } finally {
      setApproving(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBg }]}>
        <ActivityIndicator />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Cargando cotización…</Text>
      </View>
    );
  }

  if (notFound || !quote) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBg }]}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>Cotización no encontrada</Text>
        <Text style={{ color: colors.textMuted, marginTop: 8 }}>El enlace no es válido o expiró.</Text>
      </View>
    );
  }

  const status = QUOTE_STATUS_LABELS[quote.status as QuoteStatus] ?? quote.status;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pageBg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
        <Text style={[styles.title, { color: colors.primary }]}>Cotización {quote.number}</Text>
        <Text style={{ color: colors.textMuted }}>{status} · {formatDate(quote.createdAt ?? quote.created_at)}</Text>
        <Text style={{ color: colors.primary, fontSize: 22, fontWeight: "700", marginTop: 12 }}>{formatCOP(quote.totals?.total ?? 0)}</Text>
        {quote.client_name ? <Text style={{ color: colors.textMuted, marginTop: 8 }}>Cliente: {quote.client_name}</Text> : null}
      </View>

      {quote.lines?.map((l, i) => (
        <View key={i} style={[styles.line, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{l.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{l.quantity} × {formatCOP(l.price)}</Text>
        </View>
      ))}

      <View style={styles.actions}>
        <LedgerPrimaryBtn variant="secondary" label={downloading ? "Descargando…" : "Descargar PDF"} onPress={handleDownload} disabled={downloading} />
        {quote.status !== "accepted" && quote.status !== "invoiced" ? (
          <LedgerPrimaryBtn label="Aprobar cotización" onPress={() => setShowApprove(true)} />
        ) : null}
      </View>

      <DsSideModal
        visible={showApprove}
        onClose={() => setShowApprove(false)}
        title="Aprobar cotización"
        icon="checkmark-circle-outline"
        onSubmit={() => void handleApprove()}
        submitLabel="Aprobar"
        submitting={approving}
        closeDisabled={approving}
      >
        <Text style={{ color: colors.textMuted }}>Ingresa el código que recibiste por correo.</Text>
        <DsField
          label="Código de aprobación"
          icon="key-outline"
          placeholder="Código"
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
        />
      </DsSideModal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { borderRadius: SHELL_RADIUS.menuItem, borderWidth: 1, padding: 16, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  actions: { gap: 10, marginTop: 16 },
});

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useParams, useSearchParams } from "react-router-dom";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { sharePdfFromResponse } from "../../../utils/sharePdf.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import type { IRemision } from "../../../types";
import { downloadPublicRemision, getPublicRemision } from "../../../services/remisiones.service";
import { formatCOP } from "../../quotes/quotes.utils";

export default function PublicRemisionNative() {
  const colors = useThemeColors();
  const { slug = "" } = useParams();
  const [params] = useSearchParams();
  const token = params.get("t") ?? "";

  const [remision, setRemision] = useState<IRemision | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getPublicRemision(slug);
      if (res?.remision) setRemision(res.remision);
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
      const res = await downloadPublicRemision(slug);
      if (!res) throw new Error("Sin respuesta");
      await sharePdfFromResponse(res, `${remision?.number || "remision"}.pdf`);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBg }]}>
        <ActivityIndicator />
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>Cargando remisión…</Text>
      </View>
    );
  }

  if (notFound || !remision) {
    return (
      <View style={[styles.center, { backgroundColor: colors.pageBg }]}>
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700" }}>Remisión no encontrada</Text>
      </View>
    );
  }

  const yaFirmada = remision.status === "signed";

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.pageBg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
        <Text style={[styles.title, { color: colors.primary }]}>Remisión {remision.number}</Text>
        <Text style={{ color: yaFirmada ? "#155724" : colors.textMuted, marginTop: 4 }}>
          {yaFirmada ? "Firmada ✓" : "Pendiente de firma"}
        </Text>
        <Text style={{ color: colors.primary, fontWeight: "600", marginTop: 12 }}>{remision.client_name}</Text>
        {remision.client_doc ? <Text style={{ color: colors.textMuted }}>Doc: {remision.client_doc}</Text> : null}
        <Text style={{ color: colors.primary, fontSize: 18, fontWeight: "700", marginTop: 12 }}>{formatCOP(remision.total)}</Text>
      </View>

      {remision.lines.map((l, i) => (
        <View key={i} style={[styles.line, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{l.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>{l.quantity} × {formatCOP(l.price)}</Text>
        </View>
      ))}

      {!yaFirmada && token ? (
        <View style={[styles.hint, { backgroundColor: colors.bgSubtle }]}>
          <Text style={{ color: colors.textMuted, fontSize: 13, lineHeight: 20 }}>
            Para firmar con trazo sobre la pantalla, abre este enlace en el navegador web. Desde la app puedes revisar el detalle y descargar el PDF.
          </Text>
        </View>
      ) : null}

      {yaFirmada ? (
        <Text style={{ color: colors.textMuted, marginTop: 12 }}>
          Firmada por {remision.signed_by || remision.client_name}
          {remision.signed_at ? ` · ${new Date(remision.signed_at).toLocaleString("es-CO")}` : ""}
        </Text>
      ) : null}

      <View style={{ marginTop: 16 }}>
        <LedgerPrimaryBtn variant="secondary" label={downloading ? "Descargando…" : "Descargar PDF"} onPress={handleDownload} disabled={downloading} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  card: { borderRadius: SHELL_RADIUS.menuItem, borderWidth: 1, padding: 16, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "700" },
  line: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  hint: { padding: 14, borderRadius: SHELL_RADIUS.menuItem, marginTop: 12 },
});

import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, Text, View } from "react-native";
import { DsField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { generarPila, getPilaHistorial, previewPila, type PilaHistorialItem, type PilaPlanilla } from "../../../services/nomina.service";
import { downloadPilaNative } from "../../../services/nominaDownload.native";
import { formatCOP } from "../nomina.shared";

const thisPeriodo = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function NominaPilaPanelNative() {
  const colors = useThemeColors();
  const [periodo, setPeriodo] = useState(thisPeriodo());
  const [planilla, setPlanilla] = useState<PilaPlanilla | null>(null);
  const [historial, setHistorial] = useState<PilaHistorialItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [generando, setGenerando] = useState(false);

  const loadHist = useCallback(() => {
    getPilaHistorial().then(setHistorial).catch(() => setHistorial([]));
  }, []);

  useEffect(() => { loadHist(); }, [loadHist]);

  const preview = async () => {
    setLoading(true);
    try {
      setPlanilla(await previewPila(periodo));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al previsualizar");
      setPlanilla(null);
    } finally {
      setLoading(false);
    }
  };

  const generar = async () => {
    setGenerando(true);
    try {
      const r = await generarPila(periodo);
      successToast(r.message || "PILA generada");
      setPlanilla(r.planilla);
      loadHist();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al generar");
    } finally {
      setGenerando(false);
    }
  };

  const descargar = async () => {
    try {
      await downloadPilaNative(periodo);
      successToast("Archivo PILA listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo descargar");
    }
  };

  return (
    <View>
      <View style={{ marginBottom: 12 }}>
        <DsField
          label="Período (YYYY-MM)"
          icon="calendar-outline"
          value={periodo}
          onChangeText={setPeriodo}
          placeholder="2026-06"
        />
      </View>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
        <LedgerPrimaryBtn label={loading ? "…" : "Previsualizar"} onPress={preview} disabled={loading} />
        <LedgerPrimaryBtn label={generando ? "…" : "Generar PILA"} onPress={generar} disabled={generando} />
        <LedgerPrimaryBtn label="Descargar plano" variant="secondary" onPress={descargar} />
      </View>

      {loading ? <ActivityIndicator /> : planilla ? (
        <View style={[{ borderWidth: 1, borderColor: colors.border, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 16 }, getSoftCardShadow()]}>
          <Text style={{ fontWeight: "700", color: colors.primary }}>{planilla.periodo_label}</Text>
          <Text style={{ color: colors.textMuted, marginTop: 4 }}>
            {planilla.totales.trabajadores} cotizantes · Total {formatCOP(planilla.totales.total)}
          </Text>
          {planilla.cotizantes.slice(0, 8).map((c) => (
            <Text key={c.empleado_id} style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>
              {c.nombre} · {formatCOP(c.total)}
            </Text>
          ))}
          {planilla.cotizantes.length > 8 ? (
            <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>+ {planilla.cotizantes.length - 8} más</Text>
          ) : null}
        </View>
      ) : null}

      <Text style={{ fontWeight: "700", color: colors.primary, marginBottom: 8 }}>Historial</Text>
      {historial.length === 0 ? (
        <Text style={{ color: colors.textMuted }}>Sin PILA generadas aún.</Text>
      ) : (
        historial.map((h) => (
          <View key={h.periodo_key} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }}>
            <Text style={{ color: colors.primary }}>{h.periodo_label}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatCOP(h.totales.total)}</Text>
          </View>
        ))
      )}
    </View>
  );
}

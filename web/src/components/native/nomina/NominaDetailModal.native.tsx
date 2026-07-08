import { useEffect, useState } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { DsSideModal } from "../../design-system-native";
import { formatCOP, statusLabel } from "../../../features/nomina/nomina.shared";
import { getNominaById, resyncNominaStatus, type Nomina } from "../../../services/nomina.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";

type Props = {
  visible: boolean;
  nominaId: string | null;
  onClose: () => void;
};

export default function NominaDetailModalNative({ visible, nominaId, onClose }: Props) {
  const colors = useThemeColors();
  const [nomina, setNomina] = useState<Nomina | null>(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (!visible || !nominaId) return;
    setLoading(true);
    (async () => {
      try {
        const res = await getNominaById(nominaId);
        setNomina(res.nomina);
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "Error al cargar nómina");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, nominaId]);

  const resync = async () => {
    if (!nominaId) return;
    setSyncing(true);
    try {
      const res = await resyncNominaStatus(nominaId);
      setNomina(res.nomina);
      successToast("Estado actualizado");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSyncing(false);
    }
  };

  const ne = nomina?.NominaElectronica;
  const trab = ne?.Trabajador;
  const status = nomina?.systemInfo?.nominaStatus || "PENDING";

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title="Detalle nómina"
      icon="document-text-outline"
      cancelLabel="Cerrar"
      submitLabel="Actualizar estado DIAN"
      submitting={syncing}
      submitDisabled={loading || !nomina}
      onSubmit={() => void resync()}
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : !nomina ? null : (
        <>
          <Text style={{ color: colors.primaryText, fontWeight: "700", fontSize: 16 }}>
            {ne?.NumeroSecuenciaXML?.Numero || "—"}
          </Text>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            {[trab?.PrimerNombre, trab?.PrimerApellido].filter(Boolean).join(" ")} · {statusLabel[status] || status}
          </Text>
          <Row label="Devengados" value={formatCOP(Number(ne?.DevengadosTotal || 0))} colors={colors} />
          <Row label="Deducciones" value={formatCOP(Number(ne?.DeduccionesTotal || 0))} colors={colors} />
          <Row label="Neto" value={formatCOP(Number(ne?.ComprobanteTotal || 0))} colors={colors} bold />
          {nomina.systemInfo.cune ? (
            <Text style={{ fontSize: 11, color: colors.textMuted, marginTop: 8 }}>CUNE: {nomina.systemInfo.cune}</Text>
          ) : null}
        </>
      )}
    </DsSideModal>
  );
}

function Row({ label, value, bold, colors }: { label: string; value: string; bold?: boolean; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
      <Text style={{ color: colors.textMuted }}>{label}</Text>
      <Text style={{ color: colors.primaryText, fontWeight: bold ? "700" : "500" }}>{value}</Text>
    </View>
  );
}

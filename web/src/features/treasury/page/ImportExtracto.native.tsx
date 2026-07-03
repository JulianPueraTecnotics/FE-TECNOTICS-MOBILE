import * as DocumentPicker from "expo-document-picker";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { importStatementPdf, postStatements, type BankStatementPdfResult, type UploadFile } from "../reconciliation.service";
import { formatCOP } from "../treasury.shared";

export default function ImportExtractoNative() {
  const colors = useThemeColors();
  const [file, setFile] = useState<UploadFile | null>(null);
  const [result, setResult] = useState<BankStatementPdfResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);

  const pickFile = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv"],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const asset = res.assets[0];
      const picked: UploadFile = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType || "application/pdf",
      };
      setFile(picked);
      setResult(null);
      setLoading(true);
      try {
        const data = await importStatementPdf(picked);
        setResult(data);
        successToast(`${data.movimientos.length} movimientos detectados`);
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "No se pudo importar el extracto");
        setFile(null);
      } finally {
        setLoading(false);
      }
    } catch {
      errorToast("No se pudo seleccionar el archivo");
    }
  };

  const registrarEnLibro = async () => {
    if (!file) return;
    setPosting(true);
    try {
      const r = await postStatements([file]);
      successToast(r.message || `${r.creados} movimiento(s) registrados`);
      setFile(null);
      setResult(null);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al registrar movimientos");
    } finally {
      setPosting(false);
    }
  };

  return (
    <DsModuleScreen
      title="Importar extracto"
      subtitle="Importa el extracto PDF del banco (o Excel/CSV). El sistema cruza pagos de clientes y prepara los movimientos para el libro banco."
    >
      <DsButton
        label={loading ? "Importando…" : "Seleccionar extracto"}
        icon="document-outline"
        onPress={pickFile}
        loading={loading}
      />

      {file ? (
        <View style={[styles.fileCard, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{"name" in file ? file.name : "Extracto"}</Text>
        </View>
      ) : null}

      {result ? (
        <>
          <View style={[styles.summary, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
            {result.empresa ? <Text style={{ color: colors.primaryText, fontWeight: "700" }}>{result.empresa}</Text> : null}
            <Text style={{ color: colors.textMuted, marginTop: 4 }}>
              {result.movimientos.length} movimientos · Abonos {formatCOP(result.total_abonos)} · Cargos {formatCOP(result.total_cargos)}
            </Text>
            {result.pagos_cliente ? (
              <Text style={{ color: colors.headerAccent, marginTop: 4 }}>{result.pagos_cliente} posible(s) pago(s) de cliente</Text>
            ) : null}
          </View>

          {result.movimientos.slice(0, 30).map((m, i) => (
            <View key={`${m.fecha}-${i}`} style={[styles.mov, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primaryText, fontWeight: "600" }} numberOfLines={2}>{m.descripcion}</Text>
              <View style={styles.movRow}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{m.fecha}</Text>
                <Text style={{ color: m.valor >= 0 ? "#16a34a" : "#dc2626", fontWeight: "700" }}>{formatCOP(Math.abs(m.valor))}</Text>
              </View>
            </View>
          ))}

          {result.movimientos.length > 30 ? (
            <Text style={{ color: colors.textMuted, textAlign: "center", marginVertical: 8 }}>
              + {result.movimientos.length - 30} movimientos más
            </Text>
          ) : null}

          <View style={{ marginTop: 12 }}>
            <LedgerPrimaryBtn label="Registrar en libro banco" icon="cloud-upload-outline" onPress={registrarEnLibro} loading={posting} />
          </View>
        </>
      ) : null}
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  fileCard: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginTop: 12 },
  summary: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 16, marginBottom: 8 },
  mov: { borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  movRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 4 },
});

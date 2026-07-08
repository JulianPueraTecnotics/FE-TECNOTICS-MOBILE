import { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { exportInvoicesExcel } from "../../../services/invoices.service";
import { downloadBlobFile } from "../../../utils/downloadBlob";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsField, DsSideModal } from "../../design-system-native";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";

type Props = {
  visible: boolean;
  onClose: () => void;
  defaultCliente?: string;
  defaultStatus?: string;
};

export default function NativeExportInvoicesModal({
  visible,
  onClose,
  defaultCliente = "",
  defaultStatus = "",
}: Props) {
  const colors = useThemeColors();
  const [mode, setMode] = useState<"range" | "month">("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [month, setMonth] = useState("");
  const [cliente, setCliente] = useState(defaultCliente);
  const [status, setStatus] = useState(defaultStatus);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (mode === "range") {
      if (!startDate || !endDate) {
        errorToast("Debes indicar fecha de inicio y fecha final");
        return;
      }
      if (startDate > endDate) {
        errorToast("La fecha de inicio no puede ser mayor que la fecha final");
        return;
      }
    } else if (!month.trim()) {
      errorToast("Debes indicar un mes (YYYY-MM)");
      return;
    }

    setExporting(true);
    try {
      const res = await exportInvoicesExcel({
        start_date: mode === "range" ? startDate : undefined,
        end_date: mode === "range" ? endDate : undefined,
        month: mode === "month" ? month : undefined,
        cliente: cliente.trim() || undefined,
        status: status.trim() || undefined,
      });
      if (!res) throw new Error("No se pudo exportar el Excel");
      await downloadBlobFile(res.blob, res.fileName);
      successToast("Excel listo para guardar o compartir");
      onClose();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al exportar Excel");
    } finally {
      setExporting(false);
    }
  };

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title="Exportar Facturas a Excel"
      icon="document-outline"
      closeDisabled={exporting}
      submitting={exporting}
      submitLabel="Descargar Excel"
      onSubmit={() => void handleExport()}
    >
      <View style={styles.modeRow}>
        <Pressable
          style={[
            styles.modeBtn,
            mode === "range"
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { borderColor: colors.border },
          ]}
          onPress={() => setMode("range")}
        >
          <Text style={{ color: mode === "range" ? "#fff" : colors.primaryText, fontWeight: "600" }}>
            Rango de fechas
          </Text>
        </Pressable>
        <Pressable
          style={[
            styles.modeBtn,
            mode === "month"
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { borderColor: colors.border },
          ]}
          onPress={() => setMode("month")}
        >
          <Text style={{ color: mode === "month" ? "#fff" : colors.primaryText, fontWeight: "600" }}>
            Por mes
          </Text>
        </Pressable>
      </View>

      {mode === "range" ? (
        <>
          <DsField
            label="Fecha inicio (YYYY-MM-DD)"
            icon="calendar-outline"
            value={startDate}
            onChangeText={setStartDate}
            placeholder="2026-01-01"
          />
          <DsField
            label="Fecha final (YYYY-MM-DD)"
            icon="calendar-outline"
            value={endDate}
            onChangeText={setEndDate}
            placeholder="2026-01-31"
          />
        </>
      ) : (
        <DsField
          label="Mes (YYYY-MM)"
          icon="calendar-outline"
          value={month}
          onChangeText={setMonth}
          placeholder="2026-06"
        />
      )}

      <DsField
        label="Cliente (opcional)"
        icon="person-outline"
        value={cliente}
        onChangeText={setCliente}
        placeholder="Nombre o documento"
      />
      <DsField
        label="Estado (opcional)"
        icon="flag-outline"
        value={status}
        onChangeText={setStatus}
        placeholder="APPROVED, REJECTED, SENT"
        autoCapitalize="characters"
      />

      <Text style={[styles.note, { color: colors.textMuted }]}>
        El servidor puede limitar exportaciones muy grandes para mantener el Excel manejable.
      </Text>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: 8 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
  },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 4 },
});

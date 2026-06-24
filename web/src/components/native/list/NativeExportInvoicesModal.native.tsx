import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { exportInvoicesExcel } from "../../../services/invoices.service";
import { downloadBlobFile } from "../../../utils/downloadBlob";
import { useThemeColors } from "../../../theme/useThemeColors";
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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable
          style={[styles.modal, { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.primary }]}>Exportar Facturas a Excel</Text>
            <Pressable onPress={onClose} disabled={exporting}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
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
                <Text style={[styles.label, { color: colors.textMuted }]}>Fecha inicio (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="2026-01-01"
                  placeholderTextColor={colors.textMuted}
                />
                <Text style={[styles.label, { color: colors.textMuted }]}>Fecha final (YYYY-MM-DD)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="2026-01-31"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            ) : (
              <>
                <Text style={[styles.label, { color: colors.textMuted }]}>Mes (YYYY-MM)</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                  value={month}
                  onChangeText={setMonth}
                  placeholder="2026-06"
                  placeholderTextColor={colors.textMuted}
                />
              </>
            )}

            <Text style={[styles.label, { color: colors.textMuted }]}>Cliente (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
              value={cliente}
              onChangeText={setCliente}
              placeholder="Nombre o documento"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.label, { color: colors.textMuted }]}>Estado (opcional)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
              value={status}
              onChangeText={setStatus}
              placeholder="APPROVED, REJECTED, SENT"
              placeholderTextColor={colors.textMuted}
              autoCapitalize="characters"
            />

            <Text style={[styles.note, { color: colors.textMuted }]}>
              El servidor puede limitar exportaciones muy grandes para mantener el Excel manejable.
            </Text>
          </ScrollView>

          <View style={styles.actions}>
            <Pressable style={[styles.cancelBtn, { borderColor: colors.border }]} onPress={onClose} disabled={exporting}>
              <Text style={{ color: colors.primaryText, fontWeight: "600" }}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[styles.exportBtn, { backgroundColor: colors.accent, opacity: exporting ? 0.7 : 1 }]}
              onPress={() => void handleExport()}
              disabled={exporting}
            >
              {exporting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="document-outline" size={18} color="#fff" />
                  <Text style={styles.exportText}>Descargar Excel</Text>
                </>
              )}
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15,23,42,0.5)",
    justifyContent: "center",
    padding: 20,
  },
  modal: {
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 18,
    maxHeight: "88%",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: { fontSize: 18, fontWeight: "700", flex: 1, paddingRight: 8 },
  modeRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  modeBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
  },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 8,
  },
  note: { fontSize: 12, lineHeight: 18, marginTop: 8, marginBottom: 4 },
  actions: { flexDirection: "row", gap: 10, marginTop: 14 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
  },
  exportBtn: {
    flex: 1.4,
    flexDirection: "row",
    gap: 6,
    paddingVertical: 13,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
    justifyContent: "center",
  },
  exportText: { color: "#fff", fontWeight: "700", fontSize: 14 },
});

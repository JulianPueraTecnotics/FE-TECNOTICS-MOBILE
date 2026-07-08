import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  downloadReceipt,
  getInvoiceReceipts,
  sendReceiptEmail,
} from "../../../services/recaudos.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsSideModal } from "../../design-system-native";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";
import { formatCOP, formatDateCO } from "../../../utils/format";
import { saveAndShareBase64 } from "../../../utils/downloadFile.native";
import { PAYMENT_METHOD_LABELS, type ReceiptVoucher, type ReceivableInvoice } from "../../../types";

type Props = {
  visible: boolean;
  invoice: ReceivableInvoice | null;
  onClose: () => void;
};

export default function ReceiptsModalNative({ visible, invoice, onClose }: Props) {
  const colors = useThemeColors();
  const [receipts, setReceipts] = useState<ReceiptVoucher[]>([]);
  const [loading, setLoading] = useState(false);
  const [rowBusy, setRowBusy] = useState<{ id: string; action: string } | null>(null);

  const load = useCallback(async () => {
    if (!invoice) return;
    setLoading(true);
    try {
      const res = await getInvoiceReceipts(invoice._id);
      setReceipts(res?.receipts ?? []);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudieron cargar los comprobantes");
    } finally {
      setLoading(false);
    }
  }, [invoice]);

  useEffect(() => {
    if (visible && invoice) void load();
  }, [visible, invoice, load]);

  const handleDownload = async (r: ReceiptVoucher) => {
    setRowBusy({ id: r._id, action: "download" });
    try {
      const res = await downloadReceipt(r._id);
      const base64 =
        res?.base64_receipt ||
        (res?.data_uri?.includes(",") ? res.data_uri.split(",")[1] : res?.data_uri);
      if (!base64) throw new Error("La respuesta no contiene el PDF");
      await saveAndShareBase64(base64, res?.file_name || `${r.number}.pdf`, res?.mime_type || "application/pdf");
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo descargar el comprobante");
    } finally {
      setRowBusy(null);
    }
  };

  const handleSend = async (r: ReceiptVoucher) => {
    setRowBusy({ id: r._id, action: "send" });
    try {
      await sendReceiptEmail(r._id);
      successToast("Comprobante enviado al cliente");
      await load();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo enviar el comprobante");
    } finally {
      setRowBusy(null);
    }
  };

  const isBusy = (id: string, action: string) => rowBusy?.id === id && rowBusy?.action === action;

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title="Comprobantes de ingreso"
      icon="receipt-outline"
    >
      {invoice ? (
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Factura <Text style={{ fontWeight: "700", color: colors.primaryText }}>{invoice.number}</Text>
          {" · "}
          {invoice.client_name || "Cliente"}
        </Text>
      ) : null}

      {loading ? (
        <ActivityIndicator color={colors.accent} style={{ marginTop: 32 }} />
      ) : receipts.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          Esta factura aún no tiene comprobantes de ingreso.
        </Text>
      ) : (
        receipts.map((r) => (
          <View key={r._id} style={[styles.item, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.number, { color: colors.primary }]}>{r.number}</Text>
              <Text style={[styles.meta, { color: colors.textMuted }]}>
                {formatDateCO(r.issued_at)} · {PAYMENT_METHOD_LABELS[r.method] ?? r.method}
                {r.emailed ? " · Enviado ✓" : ""}
              </Text>
            </View>
            <Text style={[styles.amount, { color: colors.primaryText }]}>{formatCOP(r.amount)}</Text>
            <Pressable
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={() => void handleDownload(r)}
              disabled={!!rowBusy}
            >
              {isBusy(r._id, "download") ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="download-outline" size={18} color={colors.accent} />
              )}
            </Pressable>
            <Pressable
              style={[styles.iconBtn, { borderColor: colors.border }]}
              onPress={() => void handleSend(r)}
              disabled={!!rowBusy}
            >
              {isBusy(r._id, "send") ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="mail-outline" size={18} color={colors.accent} />
              )}
            </Pressable>
          </View>
        ))
      )}
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  sub: { fontSize: 14 },
  empty: { textAlign: "center", marginTop: 32, fontSize: 15 },
  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 12,
  },
  number: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12, marginTop: 2 },
  amount: { fontSize: 14, fontWeight: "600" },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});

import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { createInvoicePayment } from "../../../services/recaudos.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";
import { AuthContext } from "../../../store/auth.context";
import { formatCOP } from "../../../utils/format";
import {
  PAYMENT_METHOD_LABELS,
  type CreatePaymentRequest,
  type PaymentMethod,
  type ReceivableInvoice,
} from "../../../types";
import { todayISO } from "../../../features/recaudos/recaudos.shared";

type Props = {
  visible: boolean;
  invoice: ReceivableInvoice | null;
  onClose: () => void;
  onSuccess: () => void;
};

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export default function PaymentModalNative({ visible, invoice, onClose, onSuccess }: Props) {
  const colors = useThemeColors();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [sendReceipt, setSendReceipt] = useState(true);
  const [esPagoTotal, setEsPagoTotal] = useState(true);

  const balance = invoice?.balance ?? 0;
  const amount = parseFloat(amountText) || 0;

  useEffect(() => {
    if (!visible || !invoice) return;
    setAmountText(String(invoice.balance));
    setMethod("transferencia");
    setPaidAt(todayISO());
    setReference("");
    setNotes("");
    setSendReceipt(true);
    setEsPagoTotal(true);
  }, [visible, invoice]);

  const retencion = useMemo(() => {
    if (!esPagoTotal) return 0;
    return Math.max(0, Math.round((balance - amount) * 100) / 100);
  }, [esPagoTotal, balance, amount]);

  const base = invoice?.base ?? 0;
  const retencionPct = useMemo(() => {
    if (retencion <= 0 || base <= 0) return 0;
    return Math.round((retencion / base) * 1000) / 10;
  }, [retencion, base]);

  const applied = Math.round((amount + retencion) * 100) / 100;
  const newBalance = Math.max(0, Math.round((balance - applied) * 100) / 100);
  const willBePaid = newBalance <= 0.0001 && balance > 0;

  const handleSubmit = async () => {
    if (!invoice) return;
    if (!amount || amount <= 0) {
      errorToast("Ingresa el valor pagado (mayor a 0)");
      return;
    }
    if (amount > balance + 1) {
      errorToast(`El valor pagado no puede superar el saldo (${formatCOP(balance)})`);
      return;
    }
    const payload: CreatePaymentRequest = {
      amount,
      retencion: esPagoTotal && retencion > 0 ? retencion : 0,
      method,
      paid_at: paidAt,
      reference: reference.trim() || undefined,
      notes: notes.trim() || undefined,
      send_receipt: sendReceipt,
      executed_by: user?.razon_social,
    };
    setLoading(true);
    try {
      await createInvoicePayment(invoice._id, payload);
      successToast(
        sendReceipt ? "Pago registrado y comprobante enviado al cliente" : "Pago registrado"
      );
      onSuccess();
      onClose();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  };

  if (!invoice) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: colors.pageBg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={onClose} disabled={loading}>
            <Ionicons name="close" size={24} color={colors.primaryText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Registrar pago</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={[styles.summary, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
            {[
              ["Factura", invoice.number],
              ["Cliente", invoice.client_name || "—"],
              ["Total", formatCOP(invoice.total)],
              ["Abonado", formatCOP(invoice.paid)],
            ].map(([label, value]) => (
              <View key={label} style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>{label}</Text>
                <Text style={[styles.summaryValue, { color: colors.primaryText }]}>{value}</Text>
              </View>
            ))}
            <View style={[styles.summaryRow, styles.balanceRow]}>
              <Text style={[styles.summaryLabel, { color: colors.primary, fontWeight: "700" }]}>Saldo pendiente</Text>
              <Text style={[styles.summaryValue, { color: colors.primary, fontWeight: "700" }]}>
                {formatCOP(balance)}
              </Text>
            </View>
          </View>

          <Text style={[styles.label, { color: colors.textMuted }]}>Valor pagado por el cliente *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
            value={amountText}
            onChangeText={setAmountText}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          <Pressable onPress={() => setAmountText(String(balance))} disabled={loading}>
            <Text style={[styles.link, { color: colors.accent }]}>
              Pagó el saldo completo ({formatCOP(balance)})
            </Text>
          </Pressable>

          <Text style={[styles.label, { color: colors.textMuted }]}>Medio de pago *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {METHODS.map(([value, label]) => (
              <Pressable
                key={value}
                style={[styles.chip, method === value ? { backgroundColor: colors.accent } : { borderColor: colors.border }]}
                onPress={() => setMethod(value)}
              >
                <Text style={{ color: method === value ? "#fff" : colors.primaryText, fontSize: 12 }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <Text style={[styles.label, { color: colors.textMuted }]}>Fecha de pago (AAAA-MM-DD) *</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
            value={paidAt}
            onChangeText={setPaidAt}
            editable={!loading}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Referencia</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
            value={reference}
            onChangeText={setReference}
            placeholder="N° de transacción / consignación"
            placeholderTextColor={colors.textMuted}
            editable={!loading}
          />

          <Text style={[styles.label, { color: colors.textMuted }]}>Observaciones</Text>
          <TextInput
            style={[styles.input, styles.textArea, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
            value={notes}
            onChangeText={setNotes}
            multiline
            editable={!loading}
          />

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.primaryText }]}>
              El cliente aplicó retención
            </Text>
            <Switch value={esPagoTotal} onValueChange={setEsPagoTotal} trackColor={{ true: colors.accent }} />
          </View>

          <View style={[styles.breakdown, { backgroundColor: colors.bgSubtle }]}>
            <BreakdownRow label="Efectivo recibido" value={formatCOP(amount)} colors={colors} />
            {esPagoTotal && retencion > 0 ? (
              <BreakdownRow
                label={`Retención${retencionPct > 0 ? ` (${retencionPct}%)` : ""}`}
                value={formatCOP(retencion)}
                colors={colors}
                highlight
              />
            ) : null}
            <BreakdownRow label="Total aplicado al saldo" value={formatCOP(applied)} colors={colors} bold />
            <BreakdownRow
              label={`Saldo después${willBePaid ? " · PAGADA" : ""}`}
              value={formatCOP(newBalance)}
              colors={colors}
              bold
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={[styles.switchLabel, { color: colors.primaryText, flex: 1 }]}>
              Enviar comprobante al cliente{invoice.client_email ? ` (${invoice.client_email})` : ""}
            </Text>
            <Switch value={sendReceipt} onValueChange={setSendReceipt} trackColor={{ true: colors.accent }} />
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Pressable style={[styles.btnSecondary, { borderColor: colors.border }]} onPress={onClose} disabled={loading}>
            <Text style={{ color: colors.primaryText }}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.accent, opacity: loading ? 0.7 : 1 }]}
            onPress={() => void handleSubmit()}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Registrar pago</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function BreakdownRow({
  label,
  value,
  colors,
  bold,
  highlight,
}: {
  label: string;
  value: string;
  colors: ReturnType<typeof useThemeColors>;
  bold?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, { color: highlight ? "#b45309" : colors.textMuted }]}>{label}</Text>
      <Text style={[styles.breakdownValue, { color: colors.primaryText, fontWeight: bold ? "700" : "600" }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 17, fontWeight: "700" },
  body: { padding: 16, gap: 8, paddingBottom: 24 },
  summary: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 6, marginBottom: 8 },
  summaryRow: { flexDirection: "row", justifyContent: "space-between" },
  balanceRow: { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#e5e7eb" },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: "600" },
  label: { fontSize: 12, fontWeight: "600", marginTop: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 72, textAlignVertical: "top" },
  link: { fontSize: 13, fontWeight: "600", marginBottom: 4 },
  chipsRow: { marginVertical: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8, marginVertical: 8 },
  switchLabel: { fontSize: 14 },
  breakdown: { borderRadius: 10, padding: 12, gap: 6, marginVertical: 8 },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  breakdownLabel: { fontSize: 13 },
  breakdownValue: { fontSize: 13 },
  footer: {
    flexDirection: "row",
    gap: 10,
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnSecondary: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    alignItems: "center",
  },
  btnPrimary: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});

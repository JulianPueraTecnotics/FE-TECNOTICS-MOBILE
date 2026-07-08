import { useContext, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { createBatchPayment } from "../../../services/recaudos.service";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsField, DsSideModal } from "../../design-system-native";
import { AuthContext } from "../../../store/auth.context";
import { formatCOP } from "../../../utils/format";
import {
  PAYMENT_METHOD_LABELS,
  type CreateBatchPaymentRequest,
  type PaymentMethod,
  type ReceivableInvoice,
} from "../../../types";
import { round2, todayISO } from "../../../features/recaudos/recaudos.shared";

type Props = {
  visible: boolean;
  invoices: ReceivableInvoice[];
  onClose: () => void;
  onSuccess: () => void;
};

type RetMode = "individual" | "general" | "ninguna";

interface Row {
  invoice: ReceivableInvoice;
  amount: number;
  conRetencion: boolean;
}

const METHODS = Object.entries(PAYMENT_METHOD_LABELS) as [PaymentMethod, string][];

export default function BatchPaymentModalNative({ visible, invoices, onClose, onSuccess }: Props) {
  const colors = useThemeColors();
  const { user } = useContext(AuthContext);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [method, setMethod] = useState<PaymentMethod>("transferencia");
  const [paidAt, setPaidAt] = useState(todayISO());
  const [reference, setReference] = useState("");
  const [sendReceipt, setSendReceipt] = useState(true);
  const [retMode, setRetMode] = useState<RetMode>("individual");
  const [totalPagadoGlobal, setTotalPagadoGlobal] = useState(0);

  const saldoTotal = useMemo(() => round2(invoices.reduce((s, i) => s + i.balance, 0)), [invoices]);

  useEffect(() => {
    if (!visible) return;
    setRows(invoices.map((inv) => ({ invoice: inv, amount: inv.balance, conRetencion: false })));
    setMethod("transferencia");
    setPaidAt(todayISO());
    setReference("");
    setSendReceipt(true);
    setRetMode("individual");
    setTotalPagadoGlobal(round2(invoices.reduce((s, i) => s + i.balance, 0)));
  }, [visible, invoices]);

  const repartirTotal = (total: number, currentRows: Row[]): Row[] => {
    let restante = round2(total);
    return currentRows.map((r) => {
      const aplica = Math.min(restante, r.invoice.balance);
      restante = round2(restante - Math.max(0, aplica));
      return { ...r, amount: Math.max(0, round2(aplica)) };
    });
  };

  const updateRow = (idx: number, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const onChangeTotalGlobal = (val: number) => {
    setTotalPagadoGlobal(val);
    setRows((prev) => repartirTotal(val, prev));
  };

  const calcRow = (r: Row) => {
    let retencion = 0;
    if (retMode === "individual" && r.conRetencion) {
      retencion = Math.max(0, round2(r.invoice.balance - (r.amount || 0)));
    } else if (retMode === "general") {
      retencion = Math.max(0, round2(r.invoice.balance - (r.amount || 0)));
    }
    const applied = round2((r.amount || 0) + retencion);
    return { retencion, applied };
  };

  const totals = useMemo(() => {
    let efectivo = 0;
    let retencion = 0;
    for (const r of rows) {
      const c = calcRow(r);
      efectivo += r.amount || 0;
      retencion += c.retencion;
    }
    return { efectivo: round2(efectivo), retencion: round2(retencion), aplicado: round2(efectivo + retencion) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, retMode]);

  const usaTotalGlobal = retMode === "general" || retMode === "ninguna";

  const handleSubmit = async () => {
    if (rows.length === 0) {
      errorToast("No hay facturas seleccionadas");
      return;
    }
    if (totals.aplicado > saldoTotal + 1) {
      errorToast(`El total aplicado supera el saldo total (${formatCOP(saldoTotal)})`);
      return;
    }
    if (totals.aplicado <= 0) {
      errorToast("Ingresa el valor pagado");
      return;
    }
    const payload: CreateBatchPaymentRequest = {
      items: rows
        .map((r) => {
          const c = calcRow(r);
          return {
            invoice_id: r.invoice._id,
            amount: round2(r.amount || 0),
            retencion: c.retencion > 0 ? c.retencion : 0,
          };
        })
        .filter((it) => it.amount > 0 || (it.retencion ?? 0) > 0),
      method,
      paid_at: paidAt,
      reference: reference.trim() || undefined,
      send_receipt: sendReceipt,
      executed_by: user?.razon_social,
    };
    if (payload.items.length === 0) {
      errorToast("Ninguna factura tiene valor a aplicar");
      return;
    }
    setLoading(true);
    try {
      const res = await createBatchPayment(payload);
      successToast(res?.message || `Pago registrado para ${payload.items.length} factura(s)`);
      onSuccess();
      onClose();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al registrar el pago");
    } finally {
      setLoading(false);
    }
  };

  const clientName = rows[0]?.invoice.client_name;

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={`Recaudar ${rows.length} facturas`}
      icon="cash-outline"
      closeDisabled={loading}
      submitting={loading}
      submitLabel={`Registrar (${formatCOP(totals.aplicado)})`}
      onSubmit={() => void handleSubmit()}
    >
      {clientName ? (
        <Text style={[styles.clientLine, { color: colors.primaryText }]}>
          Cliente: <Text style={{ fontWeight: "700" }}>{clientName}</Text>
        </Text>
      ) : null}

      <Text style={[styles.label, { color: colors.primaryText }]}>Retención</Text>
      <View style={styles.retModeRow}>
        {(
          [
            ["individual", "Individual"],
            ["general", "General"],
            ["ninguna", "Sin retención"],
          ] as const
        ).map(([mode, label]) => (
          <Pressable
            key={mode}
            style={[styles.chip, retMode === mode ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border }]}
            onPress={() => setRetMode(mode)}
          >
            <Text style={{ color: retMode === mode ? "#fff" : colors.primaryText, fontSize: 11 }}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {usaTotalGlobal ? (
        <>
          <DsField
            label={`Valor total pagado · saldo ${formatCOP(saldoTotal)}`}
            icon="cash-outline"
            value={String(totalPagadoGlobal)}
            onChangeText={(v) => onChangeTotalGlobal(parseFloat(v) || 0)}
            keyboardType="decimal-pad"
            editable={!loading}
          />
          <Pressable onPress={() => onChangeTotalGlobal(saldoTotal)} disabled={loading}>
            <Text style={[styles.link, { color: colors.accent }]}>Pagó el total ({formatCOP(saldoTotal)})</Text>
          </Pressable>
        </>
      ) : null}

      {rows.map((r, idx) => {
        const c = calcRow(r);
        return (
          <View key={r.invoice._id} style={[styles.rowCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.rowTitle, { color: colors.primary }]}>{r.invoice.number}</Text>
            <Text style={[styles.rowMeta, { color: colors.textMuted }]}>Saldo {formatCOP(r.invoice.balance)}</Text>
            <DsField
              icon="cash-outline"
              value={String(r.amount)}
              onChangeText={(v) => updateRow(idx, { amount: parseFloat(v) || 0 })}
              keyboardType="decimal-pad"
              placeholder="Valor pagado"
              editable={!loading}
            />
            {retMode === "individual" ? (
              <View style={styles.switchRow}>
                <Text style={{ color: colors.primaryText, fontSize: 13 }}>Aplicó retención</Text>
                <Switch
                  value={r.conRetencion}
                  onValueChange={(v) => updateRow(idx, { conRetencion: v })}
                  trackColor={{ true: colors.accent }}
                />
              </View>
            ) : null}
            {c.retencion > 0 ? (
              <Text style={[styles.retText, { color: "#b45309" }]}>Retención: {formatCOP(c.retencion)}</Text>
            ) : null}
          </View>
        );
      })}

      <Text style={[styles.label, { color: colors.primaryText }]}>Medio de pago</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {METHODS.map(([value, label]) => (
          <Pressable
            key={value}
            style={[styles.chip, method === value ? { backgroundColor: colors.accent, borderColor: colors.accent } : { borderColor: colors.border }]}
            onPress={() => setMethod(value)}
          >
            <Text style={{ color: method === value ? "#fff" : colors.primaryText, fontSize: 12 }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <DsField
        label="Fecha de pago"
        icon="calendar-outline"
        value={paidAt}
        onChangeText={setPaidAt}
        editable={!loading}
      />
      <DsField
        label="Referencia"
        icon="reader-outline"
        value={reference}
        onChangeText={setReference}
        editable={!loading}
      />

      <View style={[styles.totals, { backgroundColor: colors.cardBg }]}>
        <Text style={{ color: colors.textMuted }}>Efectivo: {formatCOP(totals.efectivo)}</Text>
        {totals.retencion > 0 ? (
          <Text style={{ color: "#b45309" }}>Retención: {formatCOP(totals.retencion)}</Text>
        ) : null}
        <Text style={{ color: colors.primary, fontWeight: "700" }}>Total aplicado: {formatCOP(totals.aplicado)}</Text>
      </View>

      <View style={styles.switchRow}>
        <Text style={{ color: colors.primaryText, flex: 1 }}>Enviar comprobante al cliente</Text>
        <Switch value={sendReceipt} onValueChange={setSendReceipt} trackColor={{ true: colors.accent }} />
      </View>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  clientLine: { fontSize: 14, marginBottom: 4 },
  label: { fontSize: 13, fontWeight: "600", marginTop: 4 },
  retModeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 4 },
  link: { fontSize: 13, fontWeight: "600" },
  rowCard: { borderWidth: 1, borderRadius: 10, padding: 12, gap: 6, marginTop: 4 },
  rowTitle: { fontSize: 15, fontWeight: "700" },
  rowMeta: { fontSize: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  retText: { fontSize: 12, fontWeight: "600" },
  totals: { borderRadius: 10, padding: 12, gap: 4, marginVertical: 8 },
});

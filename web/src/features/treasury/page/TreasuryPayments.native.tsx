import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { generateBatch, getBanks, getPayable } from "../treasury.service";
import type { PayableInvoice, Bank } from "../treasury.types";
import { formatCOP, PAYMENT_STATUS } from "../treasury.shared";

export default function TreasuryPaymentsNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const navigate = useNavigate();
  const [rows, setRows] = useState<PayableInvoice[]>([]);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [bankId, setBankId] = useState("");
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [pay, bk] = await Promise.all([getPayable(debounced.trim()), getBanks()]);
      setRows(pay.purchases);
      setBanks(bk.banks.filter((b) => b.active));
      setBankId((prev) => prev || bk.banks.find((b) => b.active)?._id || "");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const toggle = (inv: PayableInvoice) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[inv._id] !== undefined) delete next[inv._id];
      else next[inv._id] = inv.balance;
      return next;
    });
  };

  const setMonto = (id: string, v: number, max: number) =>
    setSelected((prev) => ({ ...prev, [id]: Math.min(Math.max(0, v), max) }));

  const selectedRows = useMemo(() => rows.filter((r) => selected[r._id] !== undefined), [rows, selected]);
  const totalSelected = useMemo(() => selectedRows.reduce((acc, r) => acc + (selected[r._id] || 0), 0), [selectedRows, selected]);
  const anyMissingBank = selectedRows.some((r) => !r.supplier_bank.complete);
  const totalPending = rows.reduce((acc, r) => acc + r.balance, 0);

  const handleGenerate = async () => {
    if (!bankId) {
      errorToast("Selecciona el banco de origen");
      return;
    }
    if (!selectedRows.length) {
      errorToast("Selecciona al menos una factura");
      return;
    }
    if (anyMissingBank) {
      errorToast("Hay proveedores sin datos bancarios completos");
      return;
    }
    setGenerating(true);
    try {
      const items = selectedRows.map((r) => ({
        purchase_id: r._id,
        monto: selected[r._id],
        referencia: `${r.prefix ?? ""}${r.number ?? ""}`,
      }));
      const res = await generateBatch(bankId, items);
      successToast(res.message || "Lote generado");
      setSelected({});
      navigate(PATHS.TREASURY_LOTES);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo generar el lote");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <DsModuleScreen
      title="Pagos a proveedores"
      subtitle="Selecciona facturas y genera lote bancario"
      loading={loading}
      refreshing={refreshing}
      onRefresh={onRefresh}
      toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar proveedor, NIT, número..." />}
      footer={
        selectedRows.length > 0 ? (
          <View style={[styles.bar, { borderTopColor: colors.border, backgroundColor: colors.cardBg, paddingBottom: insets.paddingBottom }]}>
            <Text style={{ color: colors.primaryText, fontSize: 13 }}>
              {selectedRows.length} factura(s) · {formatCOP(totalSelected)}
            </Text>
            {anyMissingBank ? <Text style={{ color: "#dc2626", fontSize: 12 }}>Proveedores sin banco</Text> : null}
            <LedgerChipRow>
              {banks.map((b) => (
                <LedgerChip key={b._id} label={b.nombre_banco} active={bankId === b._id} onPress={() => setBankId(b._id)} />
              ))}
            </LedgerChipRow>
            <LedgerPrimaryBtn
              label="Generar lote"
              onPress={handleGenerate}
              loading={generating}
              disabled={!bankId || anyMissingBank}
            />
          </View>
        ) : undefined
      }
    >
        {!loading && rows.length > 0 ? (
          <Text style={{ color: colors.textMuted, marginVertical: 8 }}>
            Total por pagar: <Text style={{ fontWeight: "700", color: colors.primaryText }}>{formatCOP(totalPending)}</Text>
          </Text>
        ) : null}

        {banks.length === 0 && !loading ? (
          <Text style={{ color: "#d97706", marginBottom: 8 }}>Configura un banco en Tesorería › Bancos</Text>
        ) : null}

        {rows.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>No hay facturas pendientes. ¡Todo al día!</Text>
        ) : (
          rows.map((r) => {
            const checked = selected[r._id] !== undefined;
            return (
              <Pressable
                key={r._id}
                onPress={() => toggle(r)}
                style={[
                  styles.card,
                  {
                    borderColor: checked ? colors.headerAccent : colors.border,
                    backgroundColor: checked ? colors.bgSubtle : colors.cardBg,
                  },
                ]}
              >
                <LedgerRow
                  cells={[
                    { value: r.supplier_name, bold: true },
                    { value: formatCOP(r.balance, r.currency), align: "right", bold: true },
                  ]}
                />
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {r.supplier_doc} · {`${r.prefix ?? ""}${r.number ?? ""}` || "—"}
                </Text>
                <LedgerStatusBadge
                  label={PAYMENT_STATUS[r.payment_status] || r.payment_status}
                  tone={r.payment_status === "paid" ? "ok" : "warn"}
                />
                {checked ? (
                  <View style={{ marginTop: 8 }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 4 }}>Monto a pagar</Text>
                    <TextInput
                      value={String(selected[r._id])}
                      onChangeText={(v) => setMonto(r._id, Number(v) || 0, r.balance)}
                      keyboardType="numeric"
                      style={[styles.amount, { borderColor: colors.border, color: colors.primaryText }]}
                    />
                  </View>
                ) : null}
                {r.supplier_bank.complete ? (
                  <Text style={{ color: "#166534", fontSize: 12, marginTop: 4 }}>{r.supplier_bank.banco || "Datos bancarios OK"}</Text>
                ) : (
                  <Text style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>Sin datos bancarios</Text>
                )}
              </Pressable>
            );
          })
        )}
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginBottom: 10 },
  amount: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14 },
  bar: { padding: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 8 },
});

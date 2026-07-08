import { useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  View,
} from "react-native";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsField, DsSideModal } from "../../design-system-native";
import type { SupplierItem } from "../../../features/purchases/supplierItems.service";

type Props = {
  visible: boolean;
  item: SupplierItem | null;
  onClose: () => void;
  onSave: (params: {
    cuenta_gasto_costo?: { niif: string; colgaap: string };
    cuenta_por_pagar?: { niif: string; colgaap: string };
    cuenta_iva?: { niif: string; colgaap: string };
    cuenta_retefuente?: { niif: string; colgaap: string };
    retefuente: number;
  }) => Promise<void>;
};

export default function ParametrizeModalNative({ visible, item, onClose, onSave }: Props) {
  const colors = useThemeColors();
  const [form, setForm] = useState({ gasto: "", cxp: "", iva: "", retefuente_cta: "", retefuente: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible || !item) return;
    setForm({
      gasto: item.params?.cuenta_gasto_costo?.niif ?? "",
      cxp: item.params?.cuenta_por_pagar?.niif ?? "",
      iva: item.params?.cuenta_iva?.niif ?? "",
      retefuente_cta: item.params?.cuenta_retefuente?.niif ?? "",
      retefuente: item.params?.retefuente != null ? String(item.params.retefuente) : "",
    });
  }, [visible, item]);

  if (!item) return null;

  const save = async () => {
    setSaving(true);
    try {
      await onSave({
        cuenta_gasto_costo: form.gasto ? { niif: form.gasto, colgaap: form.gasto } : undefined,
        cuenta_por_pagar: form.cxp ? { niif: form.cxp, colgaap: form.cxp } : undefined,
        cuenta_iva: form.iva ? { niif: form.iva, colgaap: form.iva } : undefined,
        cuenta_retefuente: form.retefuente_cta
          ? { niif: form.retefuente_cta, colgaap: form.retefuente_cta }
          : undefined,
        retefuente: Number(form.retefuente) || 0,
      });
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={`Parametrizar — ${item.codigo}`}
      icon="options-outline"
      closeDisabled={saving}
      submitting={saving}
      onSubmit={() => void save()}
    >
      <Text style={[styles.desc, { color: colors.textMuted }]}>{item.descripcion}</Text>

      {item.ai_suggestion ? (
        <View style={[styles.aiBox, { backgroundColor: colors.cardBg }]}>
          <Text style={{ color: colors.primaryText, fontSize: 13 }}>
            IA sugiere: gasto {item.ai_suggestion.cuenta_gasto_costo?.codigo ?? "—"}, CxP{" "}
            {item.ai_suggestion.cuenta_por_pagar?.codigo ?? "—"}, retef{" "}
            {item.ai_suggestion.retefuente_porcentaje ?? 0}%
          </Text>
        </View>
      ) : null}

      <DsField label="Cuenta gasto/costo *" icon="wallet-outline" value={form.gasto} onChangeText={(v) => setForm((f) => ({ ...f, gasto: v }))} placeholder="513595" />
      <DsField label="Cuenta por pagar *" icon="card-outline" value={form.cxp} onChangeText={(v) => setForm((f) => ({ ...f, cxp: v }))} placeholder="220505" />
      <DsField label="Cuenta IVA" icon="calculator-outline" value={form.iva} onChangeText={(v) => setForm((f) => ({ ...f, iva: v }))} placeholder="240810" />
      <DsField label="Cuenta retefuente" icon="cut-outline" value={form.retefuente_cta} onChangeText={(v) => setForm((f) => ({ ...f, retefuente_cta: v }))} placeholder="236540" />
      <DsField label="Retefuente (%)" icon="pricetag-outline" value={form.retefuente} onChangeText={(v) => setForm((f) => ({ ...f, retefuente: v }))} keyboardType="decimal-pad" />
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        El estado pasa a Listo cuando tiene cuenta de gasto y de por pagar.
      </Text>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  desc: { fontSize: 14, lineHeight: 20 },
  aiBox: { borderRadius: 10, padding: 12 },
  hint: { fontSize: 12, lineHeight: 18 },
});

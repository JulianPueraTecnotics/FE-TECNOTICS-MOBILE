import { useEffect, useState } from "react";
import {
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { getRetentions } from "../../../features/accounting/accounting.service";
import type { RetentionConcept } from "../../../features/accounting/accounting.types";
import { applyRetention, previewRetention } from "../../../features/purchases/purchases.service";
import type { Purchase } from "../../../features/purchases/purchases.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsSideModal } from "../../design-system-native";
import { getSoftCardShadow } from "../../../components/mobile/shellStyles.native";

type Props = {
  visible: boolean;
  purchase: Purchase | null;
  onClose: () => void;
  onApplied: () => void;
};

const money = (n: number) => (n || 0).toLocaleString("es-CO", { minimumFractionDigits: 0 });

export default function RetentionModalNative({ visible, purchase, onClose, onApplied }: Props) {
  const colors = useThemeColors();
  const [concepts, setConcepts] = useState<RetentionConcept[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<Awaited<ReturnType<typeof previewRetention>>["lines"]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setSelected(new Set());
    setPreview([]);
    void (async () => {
      try {
        const res = await getRetentions();
        setConcepts(res.concepts.filter((c) => c.active && c.cuenta));
      } catch (error) {
        errorToast(error instanceof Error ? error.message : "Error al cargar conceptos");
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible || !purchase || selected.size === 0) {
      setPreview([]);
      return;
    }
    let ignore = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await previewRetention(purchase._id, [...selected]);
        if (!ignore) setPreview(res.lines);
      } catch (error) {
        if (!ignore) errorToast(error instanceof Error ? error.message : "Error al calcular");
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [selected, visible, purchase]);

  if (!purchase) return null;

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const totalRet = preview.reduce((s, l) => s + l.valor, 0);

  const apply = async () => {
    if (!selected.size) {
      errorToast("Selecciona al menos un concepto");
      return;
    }
    setApplying(true);
    try {
      const res = await applyRetention(purchase._id, [...selected]);
      successToast(res.message);
      onApplied();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo aplicar");
    } finally {
      setApplying(false);
    }
  };

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={`Retenciones — ${purchase.prefix}${purchase.number}`}
      icon="cut-outline"
      closeDisabled={applying}
      submitting={applying}
      submitDisabled={totalRet <= 0}
      submitLabel="Aplicar y contabilizar"
      onSubmit={() => void apply()}
    >
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        Proveedor: {purchase.supplier_name} · Base: {money(purchase.subtotal)}. Se aplica si la base supera el
        mínimo en UVT.
      </Text>

      {concepts.length === 0 ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          No hay conceptos de retención con cuenta configurada. Créalos en Configuración › Impuestos.
        </Text>
      ) : (
        concepts.map((c) => {
          const line = preview.find((l) => l.concepto_id === c._id);
          const isOn = selected.has(c._id);
          return (
            <View
              key={c._id}
              style={[styles.row, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
            >
              <Switch value={isOn} onValueChange={() => toggle(c._id)} trackColor={{ true: colors.accent }} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.conceptTitle, { color: colors.primaryText }]}>
                  {c.descripcion || c.codigo}
                </Text>
                <Text style={[styles.conceptMeta, { color: colors.textMuted }]}>
                  {c.tipo} · {c.tarifa}%
                </Text>
                <Text style={[styles.retValue, { color: colors.primary }]}>
                  {!isOn
                    ? "—"
                    : loading
                      ? "Calculando,…"
                      : line?.aplica
                        ? money(line.valor)
                        : "Bajo mínimo"}
                </Text>
              </View>
            </View>
          );
        })
      )}

      <View style={[styles.totalBox, { backgroundColor: colors.cardBg }]}>
        <Text style={{ color: colors.primaryText }}>
          Total a retener: <Text style={{ fontWeight: "700" }}>{money(totalRet)}</Text>
        </Text>
        <Text style={{ color: colors.textMuted, marginTop: 4 }}>
          CxP neta: {money(purchase.total - totalRet)}
        </Text>
      </View>
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
  },
  conceptTitle: { fontSize: 14, fontWeight: "600" },
  conceptMeta: { fontSize: 12, marginTop: 2 },
  retValue: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  totalBox: { borderRadius: 10, padding: 12, marginTop: 8 },
});

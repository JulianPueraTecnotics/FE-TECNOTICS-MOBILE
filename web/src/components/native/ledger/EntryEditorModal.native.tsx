import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { getCoa } from "../../../features/accounting/accounting.service";
import type { CoaAccount } from "../../../features/accounting/accounting.types";
import { createEntry, getEntry, updateEntry } from "../../../features/ledger/ledger.service";
import { JOURNAL_TYPE_LABELS, type JournalType, type ManualLineInput } from "../../../features/ledger/ledger.types";
import { moneyPlain, round2, today } from "../../../features/ledger/ledger.shared";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { SHELL_RADIUS } from "../../mobile/shellStyles.native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { DsSideModal } from "../../design-system-native";
import { LedgerField } from "./LedgerUi.native";

interface EditLine extends ManualLineInput {
  _k: number;
}

const TYPES: JournalType[] = ["NC", "CC", "CE", "RC", "FV", "DEP"];
let counter = 1;
const blankLine = (): EditLine => ({ _k: counter++, cuenta: "", debito: 0, credito: 0, descripcion: "" });

type Props = {
  visible: boolean;
  entryId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EntryEditorModalNative({ visible, entryId, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const [tipo, setTipo] = useState<JournalType>("NC");
  const [fecha, setFecha] = useState(today());
  const [descripcion, setDescripcion] = useState("");
  const [lines, setLines] = useState<EditLine[]>([blankLine(), blankLine()]);
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!visible) return;
    (async () => {
      try {
        const res = await getCoa(1, 200, "");
        setAccounts(res.accounts);
      } catch {
        /* opcional */
      }
    })();
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (!entryId) {
      setTipo("NC");
      setFecha(today());
      setDescripcion("");
      setLines([blankLine(), blankLine()]);
      return;
    }
    setLoading(true);
    (async () => {
      try {
        const { entry } = await getEntry(entryId);
        setTipo(entry.tipo);
        setFecha(new Date(entry.fecha).toISOString().slice(0, 10));
        setDescripcion(entry.descripcion);
        setLines(
          (entry.lineas ?? []).map((l) => ({
            _k: counter++,
            cuenta: l.cuenta,
            debito: l.debito,
            credito: l.credito,
            descripcion: l.descripcion,
          }))
        );
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "No se pudo cargar el comprobante");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, entryId]);

  const totals = useMemo(() => {
    const d = round2(lines.reduce((a, l) => a + (Number(l.debito) || 0), 0));
    const c = round2(lines.reduce((a, l) => a + (Number(l.credito) || 0), 0));
    return { d, c, diff: round2(d - c) };
  }, [lines]);

  const balanced = totals.diff === 0 && totals.d > 0;
  const accName = (codigo: string) => accounts.find((a) => a.codigo === codigo)?.nombre ?? "";

  const setLine = (k: number, patch: Partial<EditLine>) =>
    setLines((prev) => prev.map((l) => (l._k === k ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (k: number) => setLines((prev) => (prev.length > 2 ? prev.filter((l) => l._k !== k) : prev));

  const save = async () => {
    if (!balanced) {
      errorToast("El comprobante debe cuadrar (débitos = créditos) y ser mayor a cero");
      return;
    }
    const payload = {
      tipo,
      fecha,
      descripcion,
      lineas: lines
        .filter((l) => l.cuenta.trim() && ((Number(l.debito) || 0) > 0 || (Number(l.credito) || 0) > 0))
        .map((l) => ({
          cuenta: l.cuenta.trim(),
          debito: Number(l.debito) || 0,
          credito: Number(l.credito) || 0,
          descripcion: l.descripcion,
        })),
    };
    if (payload.lineas.length < 2) {
      errorToast("Agrega al menos dos líneas con cuenta y valor");
      return;
    }
    setSaving(true);
    try {
      if (entryId) await updateEntry(entryId, payload);
      else await createEntry(payload);
      successToast(entryId ? "Comprobante actualizado" : "Comprobante creado");
      onSaved();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={entryId ? "Editar comprobante" : "Nuevo comprobante"}
      icon="book-outline"
      closeDisabled={saving}
      submitting={saving}
      submitDisabled={!balanced}
      submitLabel="Guardar comprobante"
      onSubmit={() => void save()}
    >
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : (
        <>
          <Text style={[styles.label, { color: colors.primaryText }]}>Tipo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            {TYPES.map((t) => (
              <Pressable
                key={t}
                onPress={() => setTipo(t)}
                style={[
                  styles.typeChip,
                  {
                    borderColor: tipo === t ? colors.accent : colors.border,
                    backgroundColor: tipo === t ? colors.bgSubtle : colors.cardBg,
                  },
                ]}
              >
                <Text style={{ color: colors.primaryText, fontSize: 12 }}>{JOURNAL_TYPE_LABELS[t]}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <LedgerField label="Fecha (YYYY-MM-DD)" value={fecha} onChangeText={setFecha} icon="calendar-outline" />
          <LedgerField label="Descripción" value={descripcion} onChangeText={setDescripcion} multiline icon="document-text-outline" />

          <Text style={[styles.label, { color: colors.primaryText, marginTop: 12 }]}>Líneas</Text>
          {lines.map((l) => (
            <View
              key={l._k}
              style={[styles.lineCard, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
            >
              <LedgerField label="Cuenta PUC" value={l.cuenta} onChangeText={(v) => setLine(l._k, { cuenta: v })} icon="calculator-outline" />
              {l.cuenta ? (
                <Text style={[styles.accHint, { color: colors.textMuted }]}>{accName(l.cuenta) || "—"}</Text>
              ) : null}
              <View style={styles.lineRow}>
                <LedgerField
                  label="Débito"
                  value={String(l.debito || "")}
                  onChangeText={(v) => setLine(l._k, { debito: Number(v) || 0 })}
                  keyboardType="numeric"
                />
                <LedgerField
                  label="Crédito"
                  value={String(l.credito || "")}
                  onChangeText={(v) => setLine(l._k, { credito: Number(v) || 0 })}
                  keyboardType="numeric"
                />
              </View>
              <LedgerField
                label="Detalle línea"
                value={l.descripcion || ""}
                onChangeText={(v) => setLine(l._k, { descripcion: v })}
                icon="create-outline"
              />
              <Pressable onPress={() => removeLine(l._k)}>
                <Text style={{ color: "#dc2626", fontSize: 13 }}>Quitar línea</Text>
              </Pressable>
            </View>
          ))}

          <Pressable onPress={addLine} style={{ marginVertical: 8 }}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>+ Agregar línea</Text>
          </Pressable>

          <View style={[styles.totals, { backgroundColor: colors.cardBg }]}>
            <Text style={{ color: colors.primaryText }}>
              Débitos: {moneyPlain(totals.d)} · Créditos: {moneyPlain(totals.c)}
            </Text>
            <Text style={{ color: balanced ? "#166534" : "#dc2626", fontWeight: "700" }}>
              {balanced ? "Cuadrado ✓" : `Diferencia: ${moneyPlain(totals.diff)}`}
            </Text>
          </View>
        </>
      )}
    </DsSideModal>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  typeChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    marginRight: 8,
  },
  lineCard: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 10,
    marginBottom: 10,
  },
  lineRow: { flexDirection: "row", gap: 8 },
  accHint: { fontSize: 12, marginBottom: 8, marginTop: -4 },
  totals: { padding: 12, borderRadius: SHELL_RADIUS.card, marginBottom: 16, gap: 4 },
});

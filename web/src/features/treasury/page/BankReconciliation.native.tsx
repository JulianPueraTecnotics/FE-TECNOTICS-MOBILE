import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { DateRangeBar, LedgerField, LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { readSpreadsheetFromUri, type ColumnDef } from "../../accounting/import.utils";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { moneyPlain } from "../../ledger/ledger.shared";
import {
  buildReconciliation,
  closeReconciliation,
  getReconciliation,
  getReconciliations,
  getReconSummary,
  postAdjustment,
  toggleMatch,
  type Reconciliation,
  type ReconSummary,
} from "../reconciliation.service";

const COLS: ColumnDef[] = [
  { key: "fecha", header: "fecha", sample: "2026-06-01" },
  { key: "descripcion", header: "descripcion", sample: "Consignación cliente" },
  { key: "referencia", header: "referencia", sample: "REF123" },
  { key: "valor", header: "valor", sample: "500000" },
];

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};
const today = () => new Date().toISOString().slice(0, 10);
const fdate = (d?: string) =>
  d ? new Date(d).toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

export default function BankReconciliationNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [recons, setRecons] = useState<Reconciliation[]>([]);
  const [current, setCurrent] = useState<Reconciliation | null>(null);
  const [summary, setSummary] = useState<ReconSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [saldoBanco, setSaldoBanco] = useState("");
  const [statement, setStatement] = useState<{ fecha?: string; descripcion: string; referencia?: string; valor: number }[]>([]);
  const [adjDesc, setAdjDesc] = useState("");
  const [adjValor, setAdjValor] = useState("");
  const [adjCuenta, setAdjCuenta] = useState("");

  const loadList = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getReconciliations();
      setRecons(res.recons);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openRecon = async (id: string) => {
    try {
      const [r, s] = await Promise.all([getReconciliation(id), getReconSummary(id)]);
      setCurrent(r.recon);
      setSummary(s.resumen);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    }
  };

  const refreshCurrent = async (id: string) => {
    const [r, s] = await Promise.all([getReconciliation(id), getReconSummary(id)]);
    setCurrent(r.recon);
    setSummary(s.resumen);
  };

  const pickExtract = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "application/vnd.ms-excel",
          "text/csv",
        ],
        copyToCacheDirectory: true,
      });
      if (res.canceled || !res.assets[0]) return;
      const rows = await readSpreadsheetFromUri(res.assets[0].uri, COLS);
      const valid = rows
        .filter((r) => (r.descripcion || r.valor) && r.descripcion !== "Consignación cliente")
        .map((r) => ({
          fecha: r.fecha || undefined,
          descripcion: r.descripcion || "",
          referencia: r.referencia || undefined,
          valor: Number(r.valor) || 0,
        }))
        .filter((r) => r.valor !== 0);
      if (!valid.length) {
        errorToast("No se encontraron movimientos válidos en el extracto");
        return;
      }
      setStatement(valid);
      successToast(`${valid.length} movimientos cargados`);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al leer extracto");
    }
  };

  const create = async () => {
    if (!statement.length) {
      errorToast("Importa el extracto primero");
      return;
    }
    setCreating(true);
    try {
      const res = await buildReconciliation({ desde, hasta, saldo_banco: Number(saldoBanco) || 0, statement });
      successToast("Conciliación creada");
      setStatement([]);
      setSaldoBanco("");
      await loadList();
      openRecon(res.recon._id);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al crear");
    } finally {
      setCreating(false);
    }
  };

  const matchLine = (extractoIdx: number) => {
    if (!current) return;
    const pendientes = current.books
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.estado === "pendiente");
    if (!pendientes.length) {
      errorToast("No hay movimientos pendientes en libros");
      return;
    }
    Alert.alert(
      "Emparejar movimiento",
      current.statement[extractoIdx]?.descripcion || "",
      [
        { text: "Cancelar", style: "cancel" },
        ...pendientes.slice(0, 8).map(({ b, i }) => ({
          text: `${b.tipo}-${b.consecutivo} · ${moneyPlain(b.valor)}`,
          onPress: async () => {
            try {
              await toggleMatch(current._id, extractoIdx, i);
              await refreshCurrent(current._id);
            } catch (e) {
              errorToast(e instanceof Error ? e.message : "Error");
            }
          },
        })),
      ]
    );
  };

  const unmatch = async (extractoIdx: number) => {
    if (!current) return;
    try {
      await toggleMatch(current._id, extractoIdx, null);
      await refreshCurrent(current._id);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    }
  };

  const addAdjustment = async () => {
    if (!current) return;
    if (!adjDesc || !adjValor || !adjCuenta) {
      errorToast("Completa descripción, valor y cuenta");
      return;
    }
    try {
      await postAdjustment(current._id, adjDesc, Number(adjValor), adjCuenta);
      successToast("Ajuste contabilizado");
      setAdjDesc("");
      setAdjValor("");
      setAdjCuenta("");
      await refreshCurrent(current._id);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    }
  };

  const close = () => {
    if (!current) return;
    Alert.alert("Cerrar conciliación", "¿Cerrar esta conciliación?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar",
        onPress: async () => {
          try {
            await closeReconciliation(current._id);
            successToast("Conciliación cerrada");
            await refreshCurrent(current._id);
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  if (current) {
    return (
      <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>{current.cuenta_nombre || current.cuenta}</Text>
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {fdate(current.desde)} – {fdate(current.hasta)} · {current.estado === "cerrada" ? "Cerrada" : "Borrador"}
          </Text>
          <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
            <LedgerPrimaryBtn label="Volver" variant="secondary" onPress={() => { setCurrent(null); loadList(); }} />
            {current.estado !== "cerrada" ? <LedgerPrimaryBtn label="Cerrar" onPress={close} /> : null}
          </View>
        </View>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}>
          {summary ? (
            <Text style={{ color: colors.textMuted, marginBottom: 12, fontSize: 13 }}>
              Saldo banco: {moneyPlain(current.saldo_banco)} · Libros: {moneyPlain(current.saldo_libros)} · Diferencia:{" "}
              {moneyPlain(summary.diferencia)} {Math.abs(summary.diferencia) < 1 ? "✓" : ""}
            </Text>
          ) : null}

          <Text style={[styles.section, { color: colors.primary }]}>Extracto banco</Text>
          {current.statement.map((s, i) => (
            <View key={i} style={[styles.card, { borderColor: colors.border, backgroundColor: s.estado === "conciliado" ? colors.bgSubtle : colors.cardBg }]}>
              <LedgerRow cells={[{ value: s.descripcion, bold: true }, { value: moneyPlain(s.valor), align: "right" }]} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fdate(s.fecha)}</Text>
              {s.estado === "conciliado" ? (
                <LedgerPrimaryBtn label="Desemparejar" variant="secondary" onPress={() => unmatch(i)} disabled={current.estado === "cerrada"} />
              ) : (
                <LedgerPrimaryBtn label="Emparejar" variant="secondary" onPress={() => matchLine(i)} disabled={current.estado === "cerrada"} />
              )}
            </View>
          ))}

          <Text style={[styles.section, { color: colors.primary, marginTop: 16 }]}>Movimientos libros</Text>
          {current.books.map((b, i) => (
            <View key={i} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <LedgerRow cells={[{ value: `${b.tipo}-${b.consecutivo}`, bold: true }, { value: moneyPlain(b.valor), align: "right" }]} />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>{b.descripcion}</Text>
              <LedgerStatusBadge label={b.estado === "conciliado" ? "Conciliado" : "Pendiente"} tone={b.estado === "conciliado" ? "ok" : "warn"} />
            </View>
          ))}

          {current.estado !== "cerrada" ? (
            <View style={{ marginTop: 16 }}>
              <Text style={[styles.section, { color: colors.primary }]}>Ajuste contable</Text>
              <LedgerField label="Descripción" value={adjDesc} onChangeText={setAdjDesc} />
              <LedgerField label="Valor" value={adjValor} onChangeText={setAdjValor} keyboardType="numeric" />
              <LedgerField label="Cuenta PUC" value={adjCuenta} onChangeText={setAdjCuenta} />
              <LedgerPrimaryBtn label="Contabilizar ajuste" onPress={addAdjustment} />
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Conciliación bancaria</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Extracto vs movimientos contables</Text>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={false} onRefresh={loadList} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Text style={{ fontWeight: "700", color: colors.primary, marginBottom: 8 }}>Nueva conciliación</Text>
          <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
          <LedgerField label="Saldo final banco" value={saldoBanco} onChangeText={setSaldoBanco} keyboardType="numeric" />
          <LedgerPrimaryBtn label="Importar extracto Excel/CSV" variant="secondary" onPress={pickExtract} />
          {statement.length > 0 ? (
            <Text style={{ color: colors.textMuted, marginVertical: 8 }}>{statement.length} movimientos listos</Text>
          ) : null}
          <LedgerPrimaryBtn label="Crear y conciliar" onPress={create} loading={creating} disabled={!statement.length} />
        </View>

        <Text style={[styles.section, { color: colors.primary }]}>Historial</Text>
        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>Cargando...</Text>
        ) : recons.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 16 }}>Sin conciliaciones.</Text>
        ) : (
          recons.map((r) => (
            <Pressable key={r._id} onPress={() => openRecon(r._id)} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
              <LedgerRow
                cells={[
                  { value: r.cuenta_nombre || r.cuenta, bold: true },
                  { value: moneyPlain(r.saldo_banco), align: "right" },
                ]}
              />
              <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                {fdate(r.desde)} – {fdate(r.hasta)}
              </Text>
              <LedgerStatusBadge label={r.estado === "cerrada" ? "Cerrada" : "Borrador"} tone={r.estado === "cerrada" ? "ok" : "warn"} />
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 4 },
  section: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginBottom: 10 },
});

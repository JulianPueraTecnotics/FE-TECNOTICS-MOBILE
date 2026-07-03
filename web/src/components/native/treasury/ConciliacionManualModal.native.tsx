import { Ionicons } from "@expo/vector-icons";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import {
  buscarTerceros,
  confirmarConciliacion,
  crearConciliacionManual,
  documentosTercero,
  registrarAnticipo,
  type DocPendiente,
  type MovimientoConc,
} from "../../../features/treasury/conciliacion.service";
import { nombreDeMovimiento } from "../../../features/treasury/conciliacion.shared";
import { formatCOP } from "../../../features/treasury/treasury.shared";

type Props = {
  visible: boolean;
  onClose: () => void;
  movimientos: MovimientoConc[];
  tipoFactura: "venta" | "compra";
  onDone: () => void;
};

export default function ConciliacionManualModalNative({
  visible,
  onClose,
  movimientos,
  tipoFactura,
  onDone,
}: Props) {
  const colors = useThemeColors();
  const [docNit, setDocNit] = useState("");
  const [terceroNombre, setTerceroNombre] = useState("");
  const [tercerosResult, setTercerosResult] = useState<{ doc: string; nombre: string }[]>([]);
  const [docs, setDocs] = useState<DocPendiente[]>([]);
  const [docSel, setDocSel] = useState<Set<string>>(new Set());
  const [aplicarRetencion, setAplicarRetencion] = useState(false);
  const [applying, setApplying] = useState(false);
  const [loadingDocs, setLoadingDocs] = useState(false);

  const movimientoIds = useMemo(() => movimientos.map((m) => m.asiento_id), [movimientos]);
  const sumaMov = useMemo(
    () => movimientos.reduce((s, m) => s + Math.abs(m.valor), 0),
    [movimientos],
  );
  const sumaDocsSel = useMemo(
    () => docs.filter((d) => docSel.has(d.id)).reduce((s, d) => s + d.saldo, 0),
    [docs, docSel],
  );
  const difManual = sumaDocsSel - sumaMov;
  const retencionManual =
    aplicarRetencion && tipoFactura === "venta" && difManual > 0 ? Math.round(difManual * 100) / 100 : 0;
  const cuadra = Math.abs(sumaMov + retencionManual - sumaDocsSel) <= 100;

  const reset = () => {
    setDocNit("");
    setTerceroNombre("");
    setTercerosResult([]);
    setDocs([]);
    setDocSel(new Set());
    setAplicarRetencion(false);
  };

  const buscarDocs = async (nit: string) => {
    if (!nit.trim()) {
      setDocs([]);
      return;
    }
    setLoadingDocs(true);
    try {
      const r = await documentosTercero(nit.trim(), tipoFactura);
      setDocs(r.documentos);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al buscar documentos");
    } finally {
      setLoadingDocs(false);
    }
  };

  const elegirTercero = (t: { doc: string; nombre: string }) => {
    setDocNit(t.doc);
    setTerceroNombre(t.nombre);
    setTercerosResult([]);
    void buscarDocs(t.doc);
  };

  const inferirTercero = async (m: MovimientoConc) => {
    const nombre = nombreDeMovimiento(m.descripcion);
    if (nombre.length < 3) return;
    try {
      const r = await buscarTerceros(nombre, tipoFactura);
      if (r.terceros.length === 1) elegirTercero(r.terceros[0]);
      else if (r.terceros.length > 1) {
        setDocNit(nombre);
        setTercerosResult(r.terceros);
      }
    } catch {
      /* opcional */
    }
  };

  useEffect(() => {
    if (!visible || movimientos.length === 0) return;
    reset();
    const m = movimientos[0];
    if (m.sugerencia?.nit_tercero) {
      setDocNit(m.sugerencia.nit_tercero);
      setTerceroNombre(m.sugerencia.nombre_tercero ?? "");
      void buscarDocs(m.sugerencia.nit_tercero);
    } else {
      void inferirTercero(m);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, movimientos]);

  const onTerceroInput = async (texto: string) => {
    setDocNit(texto);
    setDocs([]);
    if (texto.trim().length < 2) {
      setTercerosResult([]);
      return;
    }
    if (/^\d{5,}$/.test(texto.trim())) {
      setTercerosResult([]);
      void buscarDocs(texto.trim());
      return;
    }
    try {
      const r = await buscarTerceros(texto.trim(), tipoFactura);
      setTercerosResult(r.terceros);
    } catch {
      /* opcional */
    }
  };

  const toggleDoc = (id: string) => {
    setDocSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const aplicarManual = async () => {
    const facturaIds = [...docSel];
    if (!facturaIds.length) {
      errorToast("Marca al menos una factura");
      return;
    }
    setApplying(true);
    try {
      const r = await crearConciliacionManual(tipoFactura, movimientoIds, facturaIds, retencionManual || undefined);
      await confirmarConciliacion(r.id);
      successToast(
        retencionManual > 0
          ? `Conciliación aplicada (retención ${formatCOP(retencionManual)})`
          : "Conciliación aplicada",
      );
      onDone();
      onClose();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo conciliar");
    } finally {
      setApplying(false);
    }
  };

  const aplicarAnticipo = async () => {
    if (tipoFactura !== "venta") {
      errorToast("El anticipo solo aplica a ingresos de cliente");
      return;
    }
    if (!docNit.trim()) {
      errorToast("Elige el cliente del anticipo");
      return;
    }
    setApplying(true);
    try {
      const r = await registrarAnticipo(movimientoIds, docNit.trim(), terceroNombre || undefined);
      successToast(r.message);
      onDone();
      onClose();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo registrar el anticipo");
    } finally {
      setApplying(false);
    }
  };

  const close = () => {
    if (applying) return;
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Pressable onPress={close} disabled={applying}>
            <Ionicons name="close" size={24} color={colors.primaryText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: colors.primary }]}>
            Conciliar manual ({movimientos.length} mov.)
          </Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[styles.hint, { color: colors.textMuted }]}>
            Pago: {formatCOP(sumaMov)} · Seleccionado: {formatCOP(sumaDocsSel)}
            {retencionManual > 0 ? ` · Retención ${formatCOP(retencionManual)}` : ""}
          </Text>
          <Text style={{ color: cuadra ? "#059669" : "#dc2626", fontWeight: "600", marginBottom: 8 }}>
            {cuadra ? "✓ Cuadra" : `Diferencia ${formatCOP(Math.abs(sumaMov + retencionManual - sumaDocsSel))}`}
          </Text>

          <Text style={[styles.label, { color: colors.textMuted }]}>Tercero (NIT o nombre)</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
            value={docNit}
            onChangeText={(t) => void onTerceroInput(t)}
            placeholder="Buscar cliente o proveedor"
            placeholderTextColor={colors.textMuted}
          />

          {tercerosResult.length ? (
            <View style={[styles.list, { borderColor: colors.border }]}>
              {tercerosResult.map((t) => (
                <Pressable key={t.doc} style={styles.listRow} onPress={() => elegirTercero(t)}>
                  <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{t.nombre}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{t.doc}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {loadingDocs ? <ActivityIndicator color={colors.headerAccent} style={{ marginVertical: 12 }} /> : null}

          {docs.map((d) => {
            const sel = docSel.has(d.id);
            return (
              <Pressable
                key={d.id}
                onPress={() => toggleDoc(d.id)}
                style={[
                  styles.docCard,
                  getSoftCardShadow(),
                  {
                    backgroundColor: sel ? `${colors.headerAccent}12` : colors.cardBg,
                    borderColor: sel ? colors.headerAccent : colors.border,
                  },
                ]}
              >
                <View style={styles.docTop}>
                  <Ionicons
                    name={sel ? "checkbox" : "square-outline"}
                    size={20}
                    color={sel ? colors.headerAccent : colors.textMuted}
                  />
                  <Text style={{ color: colors.primaryText, fontWeight: "600", flex: 1 }}>{d.numero}</Text>
                  <Text style={{ color: colors.primary, fontWeight: "700" }}>{formatCOP(d.saldo)}</Text>
                </View>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginLeft: 28 }}>Total doc. {formatCOP(d.total)}</Text>
              </Pressable>
            );
          })}

          {tipoFactura === "venta" && difManual > 0 ? (
            <View style={[styles.retRow, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primaryText, flex: 1 }}>Llevar diferencia a retención</Text>
              <Switch value={aplicarRetencion} onValueChange={setAplicarRetencion} />
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          {tipoFactura === "venta" ? (
            <Pressable
              style={[styles.btnGhost, { borderColor: colors.border }]}
              onPress={() => void aplicarAnticipo()}
              disabled={applying}
            >
              <Text style={{ color: colors.primaryText }}>Anticipo</Text>
            </Pressable>
          ) : null}
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.headerAccent, opacity: applying || !cuadra ? 0.6 : 1 }]}
            onPress={() => void aplicarManual()}
            disabled={applying || !cuadra}
          >
            {applying ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.btnPrimaryText}>Conciliar</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerTitle: { fontSize: 16, fontWeight: "700", flex: 1, textAlign: "center" },
  body: { padding: 16, paddingBottom: 24 },
  hint: { fontSize: 13, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  list: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, marginTop: 8, overflow: "hidden" },
  listRow: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  docCard: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginTop: 8 },
  docTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  retRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footer: { flexDirection: "row", gap: 10, padding: 16, borderTopWidth: StyleSheet.hairlineWidth },
  btnGhost: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});

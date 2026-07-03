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
import { getCoa } from "../../../features/accounting/accounting.service";
import { enviarACuenta, sugerirCuentaIA, type MovimientoConc } from "../../../features/treasury/conciliacion.service";
import { formatCOP } from "../../../features/treasury/treasury.shared";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";

type Props = {
  visible: boolean;
  onClose: () => void;
  movimientos: MovimientoConc[];
  signo: "ingreso" | "egreso";
  concepto?: string | null;
  onDone: () => void;
};

export default function ConciliacionCuentaModalNative({
  visible,
  onClose,
  movimientos,
  signo,
  concepto,
  onDone,
}: Props) {
  const colors = useThemeColors();
  const [cuentaSearch, setCuentaSearch] = useState("");
  const [cuentaResultados, setCuentaResultados] = useState<{ codigo: string; nombre: string }[]>([]);
  const [cuentaSel, setCuentaSel] = useState<{ codigo: string; nombre: string } | null>(null);
  const [iaSugiriendo, setIaSugiriendo] = useState(false);
  const [applying, setApplying] = useState(false);

  const suma = movimientos.reduce((s, m) => s + Math.abs(m.valor), 0);

  const buscarCuentas = async (q: string) => {
    setCuentaSel(null);
    if (q.trim().length < 2) {
      setCuentaResultados([]);
      return;
    }
    try {
      const r = await getCoa(1, 30, q.trim());
      const cuentas = r.accounts
        .filter((a) => a.es_movimiento !== false)
        .map((a) => ({ codigo: a.codigo, nombre: a.nombre }));
      setCuentaResultados(cuentas);
      const exacta = cuentas.find((c) => c.codigo === q.trim());
      if (exacta) setCuentaSel(exacta);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al buscar cuentas");
    }
  };

  const sugerirIA = async () => {
    if (!movimientos.length) return;
    setIaSugiriendo(true);
    try {
      const mov = movimientos[0];
      const r = await sugerirCuentaIA(mov.descripcion, { signo, valor: mov.valor });
      if (r.cuenta) {
        setCuentaSearch(r.cuenta.codigo);
        await buscarCuentas(r.cuenta.codigo);
        setCuentaSel({ codigo: r.cuenta.codigo, nombre: r.cuenta.nombre });
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo obtener sugerencia IA");
    } finally {
      setIaSugiriendo(false);
    }
  };

  const aplicar = async () => {
    if (!cuentaSel) {
      errorToast("Elige la cuenta contable destino");
      return;
    }
    setApplying(true);
    try {
      const cuantos = movimientos.length;
      const enAsync = cuantos > 20;
      const titulo = `Llevar ${cuantos} mov. a ${cuentaSel.codigo}`;
      const r = concepto
        ? await enviarACuenta(cuentaSel.codigo, { signo, concepto, async: enAsync, titulo })
        : await enviarACuenta(cuentaSel.codigo, {
            asientoIds: movimientos.map((m) => m.asiento_id),
            async: enAsync,
            titulo,
          });
      successToast(r.message);
      onDone();
      onClose();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo llevar a la cuenta");
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
          <Text style={[styles.headerTitle, { color: colors.primary }]}>Enviar a cuenta</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <Text style={{ color: colors.textMuted, marginBottom: 12 }}>
            {movimientos.length} movimiento(s) · Total {formatCOP(suma)}
          </Text>

          <Pressable
            style={[styles.iaBtn, { borderColor: colors.headerAccent }]}
            onPress={() => void sugerirIA()}
            disabled={iaSugiriendo}
          >
            {iaSugiriendo ? (
              <ActivityIndicator color={colors.headerAccent} />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color={colors.headerAccent} />
                <Text style={{ color: colors.headerAccent, fontWeight: "600" }}>Sugerir cuenta (IA)</Text>
              </>
            )}
          </Pressable>

          <Text style={[styles.label, { color: colors.textMuted }]}>Código o nombre PUC</Text>
          <TextInput
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
            value={cuentaSearch}
            onChangeText={(t) => {
              setCuentaSearch(t);
              void buscarCuentas(t);
            }}
            placeholder="Ej. 510505"
            placeholderTextColor={colors.textMuted}
          />

          {cuentaResultados.map((c) => (
            <Pressable
              key={c.codigo}
              onPress={() => setCuentaSel(c)}
              style={[
                styles.cuentaRow,
                {
                  borderColor: cuentaSel?.codigo === c.codigo ? colors.headerAccent : colors.border,
                  backgroundColor: cuentaSel?.codigo === c.codigo ? `${colors.headerAccent}12` : colors.cardBg,
                },
              ]}
            >
              <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{c.codigo}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.nombre}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Pressable style={[styles.btnGhost, { borderColor: colors.border }]} onPress={close} disabled={applying}>
            <Text style={{ color: colors.primaryText }}>Cancelar</Text>
          </Pressable>
          <Pressable
            style={[styles.btnPrimary, { backgroundColor: colors.headerAccent, opacity: applying ? 0.6 : 1 }]}
            onPress={() => void aplicar()}
            disabled={applying}
          >
            {applying ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Aplicar</Text>}
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
  body: { padding: 16 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6, marginTop: 8 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  iaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.button,
    marginBottom: 12,
  },
  cuentaRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, padding: 12, marginTop: 8, gap: 2 },
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
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
  },
  btnPrimaryText: { color: "#fff", fontWeight: "700" },
});

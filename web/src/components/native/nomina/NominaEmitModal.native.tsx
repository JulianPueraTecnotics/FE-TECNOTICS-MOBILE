import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LedgerField, LedgerPrimaryBtn } from "../ledger/LedgerUi.native";
import {
  createNominaLote,
  getNominaPrefixes,
  type CreateNominaPayload,
  type PlantillaLote,
} from "../../../services/nomina.service";
import { getAllEmpleados, type Empleado } from "../../../services/empleados.service";
import { empleadoNombre } from "../../../features/nomina/nomina.shared";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";

type Props = {
  visible: boolean;
  plantilla?: PlantillaLote | null;
  onClose: () => void;
  onSaved: () => void;
};

const monthBounds = () => {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  return { start, end };
};

function buildPayload(emp: Empleado, prefijo: string, inicio: string, fin: string, fechaPago: string): CreateNominaPayload {
  const sueldo = emp.sueldo;
  return {
    empleadoId: emp._id,
    prefijo,
    periodo: {
      fecha_liquidacion_inicio: inicio,
      fecha_liquidacion_fin: fin,
      periodo_nomina: "5",
      fechas_pago: [fechaPago],
    },
    devengados: {
      dias_trabajados: 30,
      sueldo_trabajado: sueldo,
    },
    deducciones: {
      salud: { porcentaje: 4, deduccion: Math.round(sueldo * 0.04) },
      fondo_pension: { porcentaje: 4, deduccion: Math.round(sueldo * 0.04) },
    },
  };
}

export default function NominaEmitModalNative({ visible, plantilla, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const bounds = monthBounds();
  const [prefijo, setPrefijo] = useState("");
  const [inicio, setInicio] = useState(bounds.start);
  const [fin, setFin] = useState(bounds.end);
  const [fechaPago, setFechaPago] = useState(bounds.end);
  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [emitting, setEmitting] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    (async () => {
      try {
        const [prefRes, empRes] = await Promise.all([getNominaPrefixes(), getAllEmpleados(1, 100)]);
        const p = prefRes.find((x) => x.default)?.prefix || prefRes[0]?.prefix || "";
        setPrefijo(plantilla ? plantilla.items[0]?.prefijo || p : p);
        if (plantilla) {
          setInicio(plantilla.items[0]?.periodo.fecha_liquidacion_inicio || bounds.start);
          setFin(plantilla.items[0]?.periodo.fecha_liquidacion_fin || bounds.end);
          setFechaPago(plantilla.items[0]?.periodo.fechas_pago?.[0] || bounds.end);
          setSelected(new Set(plantilla.items.map((i) => i.empleadoId)));
        } else {
          setSelected(new Set(empRes.items.filter((e) => e.active).map((e) => e._id)));
        }
        setEmpleados(empRes.items.filter((e) => e.active));
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "Error al cargar datos");
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, plantilla]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const emit = async () => {
    if (!prefijo.trim()) {
      errorToast("Configura un prefijo de nómina en la empresa");
      return;
    }
    const ids = [...selected];
    if (!ids.length) {
      errorToast("Selecciona al menos un empleado");
      return;
    }
    setEmitting(true);
    try {
      const items: CreateNominaPayload[] = plantilla
        ? plantilla.items.filter((i) => selected.has(i.empleadoId))
        : empleados.filter((e) => selected.has(e._id)).map((e) => buildPayload(e, prefijo, inicio, fin, fechaPago));

      const periodoKey = fin.slice(0, 7);
      const res = await createNominaLote({
        periodo_key: plantilla?.periodo_key || periodoKey,
        periodo_label: plantilla?.periodo_label || `Nómina ${periodoKey}`,
        items,
      });
      successToast(res.message || "Lote emitido");
      onSaved();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al emitir");
    } finally {
      setEmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>Emitir nómina</Text>
          <Pressable onPress={onClose}>
            <Text style={{ color: colors.accent, fontWeight: "600" }}>Cerrar</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <LedgerField label="Prefijo" value={prefijo} onChangeText={setPrefijo} />
          <LedgerField label="Inicio periodo" value={inicio} onChangeText={setInicio} />
          <LedgerField label="Fin periodo" value={fin} onChangeText={setFin} />
          <LedgerField label="Fecha pago" value={fechaPago} onChangeText={setFechaPago} />
          <Text style={[styles.sub, { color: colors.textMuted }]}>
            {loading ? "Cargando..." : `${selected.size} empleado(s) seleccionados`}
          </Text>
          {!loading
            ? empleados.map((e) => (
                <Pressable key={e._id} onPress={() => toggle(e._id)} style={[styles.row, { borderColor: colors.border, backgroundColor: selected.has(e._id) ? colors.bgSubtle : colors.cardBg }]}>
                  <Text style={{ color: colors.primaryText, fontWeight: "600" }}>{empleadoNombre(e)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>{selected.has(e._id) ? "✓" : "—"}</Text>
                </Pressable>
              ))
            : null}
          <LedgerPrimaryBtn label="Emitir lote" onPress={emit} loading={emitting} disabled={loading} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 48 },
  head: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  sub: { fontSize: 13, marginVertical: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", padding: 12, borderWidth: 1, borderRadius: 8, marginBottom: 6 },
});

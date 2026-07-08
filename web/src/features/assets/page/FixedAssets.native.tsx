import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LedgerField, LedgerPrimaryBtn, LedgerRow, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { DsButton, DsModuleScreen, DsSearchField, DsSideModal } from "../../../components/design-system-native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { fdate, moneyPlain } from "../../ledger/ledger.shared";
import {
  createAsset,
  deleteAsset,
  depreciate,
  disposeAsset,
  getAssets,
  updateAsset,
  type FixedAsset,
} from "../assets.service";

const ESTADO_LABEL: Record<string, string> = { activo: "Activo", dado_de_baja: "Dado de baja", vendido: "Vendido" };
const estadoTone = (s: string) => (s === "activo" ? "ok" : s === "vendido" ? "warn" : "bad");

const emptyForm = {
  codigo: "",
  nombre: "",
  categoria: "",
  fecha_adquisicion: "",
  costo: "",
  valor_residual: "0",
  vida_util_meses: "",
  cuenta_activo: "",
  cuenta_depreciacion_acumulada: "",
  cuenta_gasto_depreciacion: "",
};

export default function FixedAssetsNative() {
  const colors = useThemeColors();
  const [assets, setAssets] = useState<FixedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [estado, setEstado] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [depreciating, setDepreciating] = useState(false);
  const [modal, setModal] = useState<FixedAsset | null | "new">(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [disposeOf, setDisposeOf] = useState<FixedAsset | null>(null);
  const [disp, setDisp] = useState({
    tipo: "venta" as "venta" | "baja",
    fecha: "",
    motivo: "",
    ventaValor: "",
    cuentaContrapartida: "",
    cuentaResultado: "",
  });
  const [disposing, setDisposing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAssets({ estado, search: debounced.trim() });
      setAssets(res.assets);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [estado, debounced]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const openNew = () => {
    setForm(emptyForm);
    setModal("new");
  };

  const openEdit = (a: FixedAsset) => {
    setForm({
      codigo: a.codigo,
      nombre: a.nombre,
      categoria: a.categoria ?? "",
      fecha_adquisicion: a.fecha_adquisicion ? new Date(a.fecha_adquisicion).toISOString().slice(0, 10) : "",
      costo: String(a.costo),
      valor_residual: String(a.valor_residual),
      vida_util_meses: String(a.vida_util_meses),
      cuenta_activo: a.cuenta_activo,
      cuenta_depreciacion_acumulada: a.cuenta_depreciacion_acumulada,
      cuenta_gasto_depreciacion: a.cuenta_gasto_depreciacion,
    });
    setModal(a);
  };

  const save = async () => {
    if (!form.codigo || !form.nombre || !form.costo || !form.vida_util_meses || !form.fecha_adquisicion) {
      errorToast("Código, nombre, costo, vida útil y fecha son obligatorios");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        codigo: form.codigo.trim(),
        nombre: form.nombre.trim(),
        categoria: form.categoria.trim() || undefined,
        fecha_adquisicion: form.fecha_adquisicion,
        costo: Number(form.costo) || 0,
        valor_residual: Number(form.valor_residual) || 0,
        vida_util_meses: Number(form.vida_util_meses) || 0,
        cuenta_activo: form.cuenta_activo.trim(),
        cuenta_depreciacion_acumulada: form.cuenta_depreciacion_acumulada.trim(),
        cuenta_gasto_depreciacion: form.cuenta_gasto_depreciacion.trim(),
      };
      if (modal && modal !== "new") await updateAsset(modal._id, payload);
      else await createAsset(payload);
      successToast(modal === "new" ? "Activo creado" : "Activo actualizado");
      setModal(null);
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (a: FixedAsset) => {
    Alert.alert("Eliminar activo", `¿Eliminar ${a.codigo}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteAsset(a._id);
            successToast("Activo eliminado");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const runDepreciation = () => {
    Alert.alert("Depreciación", `¿Contabilizar depreciación de ${periodo}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Contabilizar",
        onPress: async () => {
          setDepreciating(true);
          try {
            const res = await depreciate(periodo);
            successToast(res.message);
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          } finally {
            setDepreciating(false);
          }
        },
      },
    ]);
  };

  const submitDispose = async () => {
    if (!disposeOf) return;
    if (!disp.cuentaResultado.trim()) {
      errorToast("Cuenta de resultado es obligatoria");
      return;
    }
    setDisposing(true);
    try {
      const res = await disposeAsset(disposeOf._id, {
        tipo: disp.tipo,
        fecha: disp.fecha || undefined,
        motivo: disp.motivo || undefined,
        ventaValor: disp.tipo === "venta" ? Number(disp.ventaValor) || 0 : undefined,
        cuentaContrapartida: disp.cuentaContrapartida.trim() || undefined,
        cuentaResultado: disp.cuentaResultado.trim(),
      });
      successToast(res.message);
      setDisposeOf(null);
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setDisposing(false);
    }
  };

  const setF = (key: keyof typeof emptyForm, value: string) => setForm((p) => ({ ...p, [key]: value }));

  return (
    <>
      <DsModuleScreen
        title="Activos fijos"
        subtitle="Registro, depreciación y baja/venta"
        loading={loading}
        refreshing={refreshing}
        onRefresh={onRefresh}
        toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar..." />}
        headerActions={<DsButton label="Nuevo" icon="add" compact onPress={openNew} />}
      >
        <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 8 }}>
            {["", "activo", "dado_de_baja", "vendido"].map((s) => (
              <Pressable
                key={s || "all"}
                onPress={() => setEstado(s)}
                style={[
                  styles.chip,
                  {
                    borderColor: estado === s ? colors.headerAccent : colors.border,
                    backgroundColor: estado === s ? colors.bgSubtle : colors.pageBg,
                  },
                ]}
              >
                <Text style={{ color: colors.primaryText, fontSize: 12 }}>{s ? ESTADO_LABEL[s] : "Todos"}</Text>
              </Pressable>
            ))}
          </View>
          <LedgerField label="Período depreciación (YYYY-MM)" value={periodo} onChangeText={setPeriodo} />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            <LedgerPrimaryBtn label="Depreciar mes" variant="secondary" onPress={runDepreciation} loading={depreciating} />
          </View>
        </View>

        {assets.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin activos.</Text>
        ) : (
          assets.map((a) => (
            <View key={a._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <LedgerRow
                cells={[
                  { value: `${a.codigo} — ${a.nombre}`, bold: true },
                  { value: moneyPlain(a.costo), align: "right" },
                ]}
              />
              <LedgerStatusBadge label={ESTADO_LABEL[a.estado] || a.estado} tone={estadoTone(a.estado)} />
              <Text style={{ fontSize: 12, color: colors.textMuted, marginVertical: 4 }}>
                Adq. {fdate(a.fecha_adquisicion)} · Dep. acum. {moneyPlain(a.depreciacion_acumulada)} · Libros{" "}
                {moneyPlain(a.valor_libros ?? a.costo - a.depreciacion_acumulada)}
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => openEdit(a)} />
                {a.estado === "activo" ? (
                  <>
                    <LedgerPrimaryBtn
                      label="Baja/Venta"
                      variant="secondary"
                      onPress={() => {
                        setDisposeOf(a);
                        setDisp({
                          tipo: "venta",
                          fecha: new Date().toISOString().slice(0, 10),
                          motivo: "",
                          ventaValor: "",
                          cuentaContrapartida: "",
                          cuentaResultado: "",
                        });
                      }}
                    />
                    <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => onDelete(a)} />
                  </>
                ) : null}
              </View>
            </View>
          ))
        )}
      </DsModuleScreen>

      <DsSideModal
        visible={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "new" ? "Nuevo activo" : "Editar activo"}
        icon="cube-outline"
        onSubmit={() => void save()}
        submitLabel="Guardar"
        submitting={saving}
        closeDisabled={saving}
      >
        <LedgerField label="Código" icon="barcode-outline" value={form.codigo} onChangeText={(v) => setF("codigo", v)} />
        <LedgerField label="Nombre" icon="cube-outline" value={form.nombre} onChangeText={(v) => setF("nombre", v)} />
        <LedgerField label="Categoría" icon="pricetags-outline" value={form.categoria} onChangeText={(v) => setF("categoria", v)} />
        <LedgerField label="Fecha adquisición" icon="calendar-outline" value={form.fecha_adquisicion} onChangeText={(v) => setF("fecha_adquisicion", v)} />
        <LedgerField label="Costo" icon="cash-outline" value={form.costo} onChangeText={(v) => setF("costo", v)} keyboardType="numeric" />
        <LedgerField label="Valor residual" icon="cash-outline" value={form.valor_residual} onChangeText={(v) => setF("valor_residual", v)} keyboardType="numeric" />
        <LedgerField label="Vida útil (meses)" icon="time-outline" value={form.vida_util_meses} onChangeText={(v) => setF("vida_util_meses", v)} keyboardType="numeric" />
        <LedgerField label="Cuenta activo" icon="folder-outline" value={form.cuenta_activo} onChangeText={(v) => setF("cuenta_activo", v)} />
        <LedgerField label="Cuenta dep. acumulada" icon="folder-outline" value={form.cuenta_depreciacion_acumulada} onChangeText={(v) => setF("cuenta_depreciacion_acumulada", v)} />
        <LedgerField label="Cuenta gasto depreciación" icon="folder-outline" value={form.cuenta_gasto_depreciacion} onChangeText={(v) => setF("cuenta_gasto_depreciacion", v)} />
      </DsSideModal>

      <DsSideModal
        visible={!!disposeOf}
        onClose={() => setDisposeOf(null)}
        title={`Baja o venta — ${disposeOf?.codigo ?? ""}`}
        icon="remove-circle-outline"
        onSubmit={() => void submitDispose()}
        submitLabel="Confirmar"
        submitting={disposing}
        closeDisabled={disposing}
      >
        <View style={{ flexDirection: "row", gap: 8 }}>
          {(["venta", "baja"] as const).map((t) => (
            <Pressable
              key={t}
              onPress={() => setDisp((p) => ({ ...p, tipo: t }))}
              style={[styles.chip, { borderColor: disp.tipo === t ? colors.headerAccent : colors.border, backgroundColor: disp.tipo === t ? colors.bgSubtle : colors.cardBg }]}
            >
              <Text style={{ color: colors.primaryText }}>{t === "venta" ? "Venta" : "Baja"}</Text>
            </Pressable>
          ))}
        </View>
        <LedgerField label="Fecha" icon="calendar-outline" value={disp.fecha} onChangeText={(v) => setDisp((p) => ({ ...p, fecha: v }))} />
        {disp.tipo === "venta" ? (
          <LedgerField label="Valor venta" icon="cash-outline" value={disp.ventaValor} onChangeText={(v) => setDisp((p) => ({ ...p, ventaValor: v }))} keyboardType="numeric" />
        ) : (
          <LedgerField label="Motivo" icon="document-text-outline" value={disp.motivo} onChangeText={(v) => setDisp((p) => ({ ...p, motivo: v }))} />
        )}
        <LedgerField label="Cuenta contrapartida" icon="folder-outline" value={disp.cuentaContrapartida} onChangeText={(v) => setDisp((p) => ({ ...p, cuentaContrapartida: v }))} />
        <LedgerField label="Cuenta resultado" icon="folder-outline" value={disp.cuentaResultado} onChangeText={(v) => setDisp((p) => ({ ...p, cuentaResultado: v }))} />
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 12 },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import EmpleadoModalNative from "../../../components/native/nomina/EmpleadoModal.native";
import NominaDetailModalNative from "../../../components/native/nomina/NominaDetailModal.native";
import NominaEmitModalNative from "../../../components/native/nomina/NominaEmitModal.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { deleteEmpleado, getAllEmpleados, type Empleado } from "../../../services/empleados.service";
import {
  getEmpleadosConNomina,
  getNominaLotes,
  getNominaPlantilla,
  getNominasByPeriodo,
  type LoteResumen,
  type Nomina,
  type PlantillaLote,
} from "../../../services/nomina.service";
import { downloadForm220Native } from "../../../services/nomina.service.native";
import { TIPO_CONTRATO_OPTIONS, TIPO_TRABAJADOR_OPTIONS } from "../nomina.constants";
import {
  NOMINA_TABS,
  empleadoNombre,
  formatCOP,
  labelFromCatalog,
  statusLabel,
  type NominaTab,
} from "../nomina.shared";

const PAGE_SIZE = 20;
const thisYear = new Date().getFullYear();

export default function NominaEmpleadosNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [tab, setTab] = useState<NominaTab>("empleados");
  const [refreshing, setRefreshing] = useState(false);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empPage, setEmpPage] = useState(1);
  const [empTotal, setEmpTotal] = useState(0);
  const [empLoading, setEmpLoading] = useState(true);
  const [empModal, setEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Empleado | null>(null);
  const [empRefresh, setEmpRefresh] = useState(0);

  const [lotes, setLotes] = useState<LoteResumen[]>([]);
  const [nomLoading, setNomLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [periodoNominas, setPeriodoNominas] = useState<Record<string, Nomina[]>>({});
  const [loadingPeriodo, setLoadingPeriodo] = useState<string | null>(null);
  const [nomRefresh, setNomRefresh] = useState(0);
  const [emitOpen, setEmitOpen] = useState(false);
  const [plantilla, setPlantilla] = useState<PlantillaLote | null>(null);
  const [loadingPlantilla, setLoadingPlantilla] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const [certAnio, setCertAnio] = useState(thisYear);
  const [certEmps, setCertEmps] = useState<{ _id: string; nombre: string; numero_documento: string }[]>([]);
  const [certLoading, setCertLoading] = useState(true);
  const [certBusy, setCertBusy] = useState<string | null>(null);

  const empTotalPages = Math.max(1, Math.ceil(empTotal / PAGE_SIZE));

  const loadEmpleados = useCallback(async () => {
    setEmpLoading(true);
    try {
      const res = await getAllEmpleados(empPage, PAGE_SIZE);
      setEmpleados(res.items);
      setEmpTotal(res.total);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar empleados");
    } finally {
      setEmpLoading(false);
    }
  }, [empPage, empRefresh]);

  const loadLotes = useCallback(async () => {
    setNomLoading(true);
    try {
      const res = await getNominaLotes();
      setLotes(res.lotes);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar nóminas");
    } finally {
      setNomLoading(false);
    }
  }, [nomRefresh]);

  const loadCert = useCallback(async () => {
    setCertLoading(true);
    try {
      const res = await getEmpleadosConNomina(certAnio);
      setCertEmps(res.empleados);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar certificados");
    } finally {
      setCertLoading(false);
    }
  }, [certAnio]);

  useEffect(() => {
    if (tab === "empleados") loadEmpleados();
    if (tab === "nomina") loadLotes();
    if (tab === "certificados") loadCert();
  }, [tab, loadEmpleados, loadLotes, loadCert]);

  const onRefresh = async () => {
    setRefreshing(true);
    if (tab === "empleados") await loadEmpleados();
    if (tab === "nomina") await loadLotes();
    if (tab === "certificados") await loadCert();
    setRefreshing(false);
  };

  const togglePeriodo = async (key: string) => {
    if (expanded === key) {
      setExpanded(null);
      return;
    }
    setExpanded(key);
    if (!periodoNominas[key]) {
      setLoadingPeriodo(key);
      try {
        const res = await getNominasByPeriodo(key);
        setPeriodoNominas((p) => ({ ...p, [key]: res.items }));
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "Error");
      } finally {
        setLoadingPeriodo(null);
      }
    }
  };

  const generarMesSiguiente = async () => {
    setLoadingPlantilla(true);
    try {
      const tpl = await getNominaPlantilla();
      if (!tpl.items.length) {
        errorToast("No hay lote anterior para usar como plantilla");
        return;
      }
      setPlantilla(tpl);
      setEmitOpen(true);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoadingPlantilla(false);
    }
  };

  const deleteEmp = (emp: Empleado) => {
    Alert.alert("Eliminar empleado", `¿Eliminar a ${empleadoNombre(emp)}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteEmpleado(emp._id);
            successToast("Empleado eliminado");
            setEmpRefresh((k) => k + 1);
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const downloadCert = async (emp: { _id: string; nombre: string }) => {
    setCertBusy(emp._id);
    try {
      await downloadForm220Native(certAnio, emp._id, emp.nombre);
      successToast("Certificado listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setCertBusy(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Nómina y empleados</Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>Empleados, nómina electrónica y certificados</Text>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {NOMINA_TABS.map((t) => (
          <Pressable
            key={t.key}
            onPress={() => setTab(t.key)}
            style={[styles.tab, tab === t.key ? { borderColor: colors.accent, backgroundColor: colors.bgSubtle } : { borderColor: "transparent" }]}
          >
            <Text style={{ color: tab === t.key ? colors.primary : colors.textMuted, fontWeight: "600" }}>{t.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
      >
        {tab === "empleados" ? (
          <>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              <LedgerPrimaryBtn label="Nuevo empleado" onPress={() => { setEditEmp(null); setEmpModal(true); }} />
            </View>
            {empLoading ? (
              <ActivityIndicator />
            ) : empleados.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin empleados.</Text>
            ) : (
              empleados.map((emp) => (
                <View key={emp._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                  <Text style={{ fontWeight: "700", color: colors.primaryText }}>{empleadoNombre(emp)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{emp.numero_documento}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    {labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, emp.tipo_trabajador)} · {labelFromCatalog(TIPO_CONTRATO_OPTIONS, emp.tipo_contrato)}
                  </Text>
                  <Text style={{ color: colors.primaryText, marginVertical: 4 }}>{formatCOP(emp.sueldo)}</Text>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <LedgerPrimaryBtn label="Editar" variant="secondary" onPress={() => { setEditEmp(emp); setEmpModal(true); }} />
                    <LedgerPrimaryBtn label="Eliminar" variant="danger" onPress={() => deleteEmp(emp)} />
                  </View>
                </View>
              ))
            )}
            <NativePagination page={empPage} totalPages={empTotalPages} loading={empLoading} onChange={setEmpPage} />
          </>
        ) : null}

        {tab === "nomina" ? (
          <>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
              <LedgerPrimaryBtn label="Emitir nómina" onPress={() => { setPlantilla(null); setEmitOpen(true); }} />
              <LedgerPrimaryBtn label="Mes siguiente" variant="secondary" onPress={generarMesSiguiente} loading={loadingPlantilla} disabled={!lotes.length} />
            </View>
            {nomLoading ? (
              <ActivityIndicator />
            ) : lotes.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin nóminas emitidas.</Text>
            ) : (
              lotes.map((l) => (
                <View key={l.periodo_key} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                  <Pressable onPress={() => togglePeriodo(l.periodo_key)}>
                    <Text style={{ fontWeight: "700", color: colors.primaryText }}>{l.periodo_label}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      {l.trabajadores} trabajadores · {formatCOP(l.total)} · {l.aprobadas} aprobadas
                    </Text>
                  </Pressable>
                  {expanded === l.periodo_key ? (
                    loadingPeriodo === l.periodo_key ? (
                      <ActivityIndicator style={{ marginTop: 8 }} />
                    ) : (
                      (periodoNominas[l.periodo_key] ?? []).map((n) => {
                        const st = n.systemInfo?.nominaStatus || "PENDING";
                        const nombre = [n.NominaElectronica?.Trabajador?.PrimerNombre, n.NominaElectronica?.Trabajador?.PrimerApellido].filter(Boolean).join(" ");
                        return (
                          <Pressable key={n._id} onPress={() => setDetailId(n._id)} style={{ paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: 8 }}>
                            <Text style={{ color: colors.primaryText }}>{nombre}</Text>
                            <LedgerStatusBadge label={statusLabel[st] || st} tone={st === "APPROVED" ? "ok" : st === "REJECTED" ? "bad" : "warn"} />
                            <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatCOP(Number(n.NominaElectronica?.ComprobanteTotal || 0))}</Text>
                          </Pressable>
                        );
                      })
                    )
                  ) : null}
                </View>
              ))
            )}
          </>
        ) : null}

        {tab === "certificados" ? (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Año gravable: {certAnio}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[thisYear, thisYear - 1].map((y) => (
                <Pressable key={y} onPress={() => setCertAnio(y)} style={[styles.chip, { borderColor: certAnio === y ? colors.accent : colors.border }]}>
                  <Text style={{ color: colors.primaryText }}>{y}</Text>
                </Pressable>
              ))}
            </View>
            {certLoading ? (
              <ActivityIndicator />
            ) : certEmps.length === 0 ? (
              <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Sin empleados con nómina en {certAnio}.</Text>
            ) : (
              certEmps.map((e) => (
                <View key={e._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                  <Text style={{ fontWeight: "600", color: colors.primaryText }}>{e.nombre}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginBottom: 8 }}>{e.numero_documento}</Text>
                  <LedgerPrimaryBtn label="Formulario 220 PDF" variant="secondary" onPress={() => downloadCert(e)} loading={certBusy === e._id} />
                </View>
              ))
            )}
          </>
        ) : null}
      </ScrollView>

      <EmpleadoModalNative
        visible={empModal}
        empleado={editEmp}
        onClose={() => setEmpModal(false)}
        onSaved={() => { setEmpModal(false); setEmpRefresh((k) => k + 1); }}
      />
      <NominaEmitModalNative
        visible={emitOpen}
        plantilla={plantilla}
        onClose={() => { setEmitOpen(false); setPlantilla(null); }}
        onSaved={() => { setEmitOpen(false); setPlantilla(null); setNomRefresh((k) => k + 1); }}
      />
      <NominaDetailModalNative visible={!!detailId} nominaId={detailId} onClose={() => setDetailId(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 20, fontWeight: "700" },
  sub: { fontSize: 13, marginTop: 4 },
  tabs: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

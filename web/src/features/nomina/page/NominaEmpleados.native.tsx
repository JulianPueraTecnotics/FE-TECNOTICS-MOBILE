import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSearchParams } from "react-router-dom";
import EmpleadoModalNative from "../../../components/native/nomina/EmpleadoModal.native";
import EmpleadoImportModalNative from "../../../components/native/nomina/EmpleadoImportModal.native";
import NominaDetailModalNative from "../../../components/native/nomina/NominaDetailModal.native";
import NominaEmitModalNative from "../../../components/native/nomina/NominaEmitModal.native";
import NominaPilaPanelNative from "../components/NominaPilaPanel.native";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { deleteEmpleado, getAllEmpleados, getAllEmpleadosFull, type Empleado } from "../../../services/empleados.service";
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
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";

const PAGE_SIZE = 20;
const thisYear = new Date().getFullYear();

function parseNominaTab(sec: string | null): NominaTab {
  if (sec === "nomina" || sec === "pila" || sec === "certificados") return sec;
  return "empleados";
}

export default function NominaEmpleadosNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [searchParams, setSearchParams] = useSearchParams();
  const [tab, setTab] = useState<NominaTab>(() => parseNominaTab(searchParams.get("sec")));
  const [refreshing, setRefreshing] = useState(false);

  const [empleados, setEmpleados] = useState<Empleado[]>([]);
  const [empPage, setEmpPage] = useState(1);
  const [empTotal, setEmpTotal] = useState(0);
  const [empLoading, setEmpLoading] = useState(true);
  const [empModal, setEmpModal] = useState(false);
  const [editEmp, setEditEmp] = useState<Empleado | null>(null);
  const [empRefresh, setEmpRefresh] = useState(0);
  const [empSearch, setEmpSearch] = useState("");
  const debouncedEmpSearch = useDebouncedValue(empSearch, FILTER_DEBOUNCE_MS);
  const [empImportOpen, setEmpImportOpen] = useState(false);

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
      const q = debouncedEmpSearch.trim().toLowerCase();
      if (q) {
        const all = await getAllEmpleadosFull();
        const filtered = all.filter(
          (e) =>
            empleadoNombre(e).toLowerCase().includes(q) ||
            String(e.numero_documento).includes(q),
        );
        const start = (empPage - 1) * PAGE_SIZE;
        setEmpleados(filtered.slice(start, start + PAGE_SIZE));
        setEmpTotal(filtered.length);
      } else {
        const res = await getAllEmpleados(empPage, PAGE_SIZE);
        setEmpleados(res.items);
        setEmpTotal(res.total);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar empleados");
    } finally {
      setEmpLoading(false);
    }
  }, [empPage, empRefresh, debouncedEmpSearch]);

  useEffect(() => {
    setEmpPage(1);
  }, [debouncedEmpSearch]);

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
    <>
      <DsModuleScreen
        title="Nómina y empleados"
        subtitle="Empleados, nómina electrónica y certificados"
        noScroll
        refreshing={refreshing}
        onRefresh={onRefresh}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
          {NOMINA_TABS.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => {
                setTab(t.key);
                setSearchParams((prev) => {
                  const p = new URLSearchParams(prev);
                  p.set("sec", t.key);
                  return p;
                });
              }}
              style={[
                styles.tab,
                tab === t.key
                  ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent }
                  : { borderColor: colors.border },
              ]}
            >
              <Text style={{ color: tab === t.key ? "#fff" : colors.textMuted, fontWeight: "600" }}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}
        >
        {tab === "empleados" ? (
          <>
            <DsSearchField value={empSearch} onChangeText={setEmpSearch} placeholder="Buscar nombre o documento…" />
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12, marginTop: 8 }}>
              <LedgerPrimaryBtn label="Nuevo empleado" onPress={() => { setEditEmp(null); setEmpModal(true); }} />
              <LedgerPrimaryBtn label="Importar CSV" variant="secondary" onPress={() => setEmpImportOpen(true)} />
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

        {tab === "pila" ? <NominaPilaPanelNative /> : null}

        {tab === "certificados" ? (
          <>
            <Text style={{ color: colors.textMuted, marginBottom: 8 }}>Año gravable: {certAnio}</Text>
            <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
              {[thisYear, thisYear - 1].map((y) => (
                <Pressable key={y} onPress={() => setCertAnio(y)} style={[styles.chip, { borderColor: certAnio === y ? colors.headerAccent : colors.border }]}>
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
      </DsModuleScreen>

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
      <EmpleadoImportModalNative
        visible={empImportOpen}
        onClose={() => setEmpImportOpen(false)}
        onSuccess={() => {
          setEmpImportOpen(false);
          setEmpRefresh((k) => k + 1);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabs: { paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tab: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1, marginRight: 8 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

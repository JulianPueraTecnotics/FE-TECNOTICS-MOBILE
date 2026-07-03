import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import ConciliacionCuentaModalNative from "../../../components/native/treasury/ConciliacionCuentaModal.native";
import ConciliacionManualModalNative from "../../../components/native/treasury/ConciliacionManualModal.native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  confirmarConciliacion,
  confirmarLote,
  generarSugerencias,
  listarMovimientos,
  rechazarConciliacion,
  type MovimientoConc,
} from "../conciliacion.service";
import { postStatementsNative } from "../reconciliation.service";
import { formatCOP, formatDate } from "../treasury.shared";

const PAGE_SIZES = [20, 30, 50] as const;

export default function ConciliacionBancariaNative() {
  const colors = useThemeColors();
  const [vista, setVista] = useState<"ingreso" | "egreso">("ingreso");
  const [movs, setMovs] = useState<MovimientoConc[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generando, setGenerando] = useState(false);
  const [importando, setImportando] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [soloSugeridos, setSoloSugeridos] = useState(false);
  const [soloAlta, setSoloAlta] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(30);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [conSugerencia, setConSugerencia] = useState(0);
  const [accionId, setAccionId] = useState<string | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [verIguales, setVerIguales] = useState<string | null>(null);
  const [manualMovs, setManualMovs] = useState<MovimientoConc[]>([]);
  const [cuentaOpen, setCuentaOpen] = useState(false);

  const tipoFactura = vista === "ingreso" ? "venta" : "compra";
  const busqueda = verIguales ?? debounced.trim();

  const load = useCallback(async () => {
    try {
      const r = await listarMovimientos({
        signo: vista,
        search: busqueda || undefined,
        soloSugeridos,
        soloAltaConfianza: soloAlta,
        page,
        pageSize,
      });
      setMovs(r.movimientos);
      setTotalPages(r.totalPages);
      setTotal(r.total);
      setConSugerencia(r.con_sugerencia);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar movimientos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vista, busqueda, soloSugeridos, soloAlta, page, pageSize]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
    setSel(new Set());
  }, [vista, debounced, soloSugeridos, soloAlta, verIguales, pageSize]);

  useRealtime(RealtimeEvents.BANK_JOB, (payload) => {
    const job = payload.item as { estado?: string } | undefined;
    if (job && (job.estado === "completado" || job.estado === "parcial" || job.estado === "error")) {
      void load();
    }
  });

  const seleccionados = useMemo(() => movs.filter((m) => sel.has(m.asiento_id)), [movs, sel]);
  const sumaSel = useMemo(() => seleccionados.reduce((s, m) => s + Math.abs(m.valor), 0), [seleccionados]);

  const onGenerar = async () => {
    setGenerando(true);
    try {
      const r = await generarSugerencias({ search: debounced.trim() || undefined });
      successToast(`Sugerencias: ${r.persistidas} (${r.ingresos} ingresos, ${r.egresos} egresos)`);
      setPage(1);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudieron generar sugerencias");
    } finally {
      setGenerando(false);
    }
  };

  const onImportar = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "text/csv", "application/vnd.ms-excel", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (res.canceled) return;
      setImportando(true);
      const files = res.assets.map((a) => ({
        uri: a.uri,
        name: a.name,
        type: a.mimeType || "application/octet-stream",
      }));
      const r = await postStatementsNative(files);
      successToast(r.message);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo importar el extracto");
    } finally {
      setImportando(false);
    }
  };

  const onConfirmar = async (concId: string, asientoId: string) => {
    setAccionId(concId);
    try {
      const r = await confirmarConciliacion(concId);
      successToast(r.message || "Conciliación confirmada");
      setMovs((prev) => prev.filter((m) => m.asiento_id !== asientoId));
      setTotal((t) => Math.max(0, t - 1));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo confirmar");
    } finally {
      setAccionId(null);
    }
  };

  const onRechazar = (concId: string) => {
    Alert.alert("Rechazar sugerencia", "¿Rechazar y buscar otra factura?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Solo rechazar",
        onPress: () => void doRechazar(concId, false),
      },
      {
        text: "Buscar otra",
        onPress: () => void doRechazar(concId, true),
      },
    ]);
  };

  const doRechazar = async (concId: string, buscarNueva: boolean) => {
    setAccionId(concId);
    try {
      const r = await rechazarConciliacion(concId, buscarNueva);
      successToast(r.message || "Sugerencia rechazada");
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo rechazar");
    } finally {
      setAccionId(null);
    }
  };

  const onConfirmarLote = () => {
    Alert.alert("Confirmar lote", `¿Confirmar todas las sugerencias de ${vista === "ingreso" ? "ingresos" : "egresos"}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          setGenerando(true);
          try {
            const enAsync = conSugerencia > 20;
            const r = await confirmarLote({
              signo: vista,
              concepto: verIguales ?? undefined,
              soloAlta: soloAlta || undefined,
              async: enAsync,
            });
            successToast(r.message || `${r.confirmadas ?? 0} confirmadas`);
            setSel(new Set());
            setVerIguales(null);
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error en lote");
          } finally {
            setGenerando(false);
          }
        },
      },
    ]);
  };

  const onConfirmarSeleccionados = async () => {
    const ids = seleccionados.filter((m) => m.sugerencia?.conciliacion_id).map((m) => m.sugerencia!.conciliacion_id);
    if (!ids.length) {
      errorToast("Ninguno seleccionado tiene sugerencia");
      return;
    }
    setGenerando(true);
    try {
      const r = await confirmarLote({ ids });
      successToast(r.message);
      setSel(new Set());
      setVerIguales(null);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudieron confirmar");
    } finally {
      setGenerando(false);
    }
  };

  const toggle = (m: MovimientoConc) => {
    setSel((prev) => {
      const n = new Set(prev);
      if (n.has(m.asiento_id)) {
        n.delete(m.asiento_id);
        if (n.size === 0) setVerIguales(null);
      } else {
        n.add(m.asiento_id);
        if (!verIguales) setVerIguales(m.descripcion);
      }
      return n;
    });
  };

  const toggleAll = () => {
    setSel((prev) => {
      const ids = movs.map((m) => m.asiento_id);
      const all = ids.length > 0 && ids.every((id) => prev.has(id));
      return all ? new Set() : new Set(ids);
    });
  };

  const afterModal = () => {
    setSel(new Set());
    setVerIguales(null);
    void load();
  };

  return (
    <>
      <DsModuleScreen
        title="Conciliación bancaria"
        subtitle={`${total} movimientos · ${conSugerencia} con sugerencia`}
        loading={loading && movs.length === 0}
        refreshing={refreshing}
        onRefresh={() => {
          setRefreshing(true);
          void load();
        }}
        toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar descripción…" />}
      >
        <View style={styles.actions}>
          <LedgerPrimaryBtn label={generando ? "…" : "Sugerencias"} onPress={onGenerar} disabled={generando} />
          <LedgerPrimaryBtn label={importando ? "…" : "Importar"} variant="secondary" onPress={() => void onImportar()} disabled={importando} />
          <LedgerPrimaryBtn variant="secondary" label="Confirmar lote" onPress={onConfirmarLote} disabled={generando} />
        </View>

        {sel.size > 0 ? (
          <View style={[styles.selBar, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
            <Text style={{ color: colors.primaryText, fontWeight: "600", flex: 1 }}>
              {sel.size} sel. · {formatCOP(sumaSel)}
            </Text>
            <Pressable onPress={() => void onConfirmarSeleccionados()} style={[styles.miniBtn, { backgroundColor: colors.headerAccent }]}>
              <Text style={{ color: "#fff", fontSize: 12, fontWeight: "600" }}>Confirmar</Text>
            </Pressable>
            <Pressable
              onPress={() => setManualMovs(seleccionados)}
              style={[styles.miniBtn, { borderColor: colors.border, borderWidth: 1 }]}
            >
              <Text style={{ color: colors.primaryText, fontSize: 12 }}>Manual</Text>
            </Pressable>
            <Pressable onPress={() => setCuentaOpen(true)} style={[styles.miniBtn, { borderColor: colors.border, borderWidth: 1 }]}>
              <Text style={{ color: colors.primaryText, fontSize: 12 }}>Cuenta</Text>
            </Pressable>
            <Pressable onPress={() => { setSel(new Set()); setVerIguales(null); }}>
              <Ionicons name="close-circle" size={22} color={colors.textMuted} />
            </Pressable>
          </View>
        ) : null}

        {verIguales ? (
          <Pressable onPress={() => setVerIguales(null)} style={[styles.verIguales, { backgroundColor: `${colors.headerAccent}18` }]}>
            <Text style={{ color: colors.headerAccent, fontSize: 12 }} numberOfLines={1}>
              Ver iguales: {verIguales.slice(0, 40)}… (tocar para quitar)
            </Text>
          </Pressable>
        ) : null}

        <View style={styles.row}>
          {(["ingreso", "egreso"] as const).map((v) => (
            <Pressable
              key={v}
              onPress={() => setVista(v)}
              style={[
                styles.chip,
                vista === v ? { backgroundColor: colors.headerAccent, borderColor: colors.headerAccent } : { borderColor: colors.border },
              ]}
            >
              <Text style={{ color: vista === v ? "#fff" : colors.textMuted, fontWeight: "600", fontSize: 13 }}>
                {v === "ingreso" ? "Ingresos" : "Egresos"}
              </Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setSoloSugeridos((x) => !x)} style={[styles.chip, soloSugeridos ? { borderColor: colors.headerAccent } : { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Solo sugeridos</Text>
          </Pressable>
          <Pressable onPress={() => setSoloAlta((x) => !x)} style={[styles.chip, soloAlta ? { borderColor: colors.headerAccent } : { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Alta conf.</Text>
          </Pressable>
          <Pressable onPress={toggleAll} style={[styles.chip, { borderColor: colors.border }]}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Sel. página</Text>
          </Pressable>
          {PAGE_SIZES.map((ps) => (
            <Pressable
              key={ps}
              onPress={() => setPageSize(ps)}
              style={[styles.chip, pageSize === ps ? { backgroundColor: colors.bgSubtle, borderColor: colors.headerAccent } : { borderColor: colors.border }]}
            >
              <Text style={{ color: colors.textMuted, fontSize: 11 }}>{ps}</Text>
            </Pressable>
          ))}
        </View>

        {movs.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>Sin movimientos</Text>
        ) : (
          movs.map((m) => {
            const s = m.sugerencia;
            const busy = accionId === s?.conciliacion_id;
            const selected = sel.has(m.asiento_id);
            return (
              <View key={m.asiento_id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: selected ? colors.headerAccent : colors.border }, getSoftCardShadow()]}>
                <View style={styles.cardTop}>
                  <Pressable onPress={() => toggle(m)} hitSlop={8}>
                    <Ionicons name={selected ? "checkbox" : "square-outline"} size={22} color={selected ? colors.headerAccent : colors.textMuted} />
                  </Pressable>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                      <Text style={[styles.fecha, { color: colors.textMuted }]}>{formatDate(m.fecha)}</Text>
                      <Text style={[styles.valor, { color: colors.primary }]}>{formatCOP(m.valor)}</Text>
                    </View>
                    <Text style={[styles.desc, { color: colors.primary }]} numberOfLines={2}>{m.descripcion}</Text>
                  </View>
                </View>
                {s ? (
                  <View style={[styles.sug, { backgroundColor: colors.bgSubtle }]}>
                    <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>
                      {s.nombre_tercero || "Tercero"} · {(s.numeros_factura ?? []).join(", ") || "—"}
                    </Text>
                    <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                      Confianza {Math.round(s.confianza * 100)}% · dif. {formatCOP(s.diferencia)}
                    </Text>
                    {s.estado === "sugerido" ? (
                      <View style={styles.cardActions}>
                        <Pressable onPress={() => onConfirmar(s.conciliacion_id, m.asiento_id)} disabled={busy} style={[styles.btnOk, { backgroundColor: colors.headerAccent }]}>
                          {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnOkText}>Confirmar</Text>}
                        </Pressable>
                        <Pressable onPress={() => onRechazar(s.conciliacion_id)} disabled={busy} style={[styles.btnNo, { borderColor: colors.border }]}>
                          <Text style={{ color: colors.textMuted }}>Rechazar</Text>
                        </Pressable>
                      </View>
                    ) : (
                      <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 6 }}>Estado: {s.estado}</Text>
                    )}
                  </View>
                ) : (
                  <View style={styles.cardActions}>
                    <Text style={{ color: colors.textMuted, fontSize: 12, flex: 1 }}>Sin sugerencia</Text>
                    <Pressable onPress={() => setManualMovs([m])} style={[styles.btnNo, { borderColor: colors.headerAccent }]}>
                      <Text style={{ color: colors.headerAccent, fontWeight: "600" }}>Manual</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            );
          })
        )}

        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)} style={[styles.pageBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primary }}>Anterior</Text>
            </Pressable>
            <Text style={{ color: colors.textMuted }}>{page} / {totalPages}</Text>
            <Pressable disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)} style={[styles.pageBtn, { borderColor: colors.border }]}>
              <Text style={{ color: colors.primary }}>Siguiente</Text>
            </Pressable>
          </View>
        ) : null}
      </DsModuleScreen>

      <ConciliacionManualModalNative
        visible={manualMovs.length > 0}
        onClose={() => setManualMovs([])}
        movimientos={manualMovs}
        tipoFactura={tipoFactura}
        onDone={afterModal}
      />

      <ConciliacionCuentaModalNative
        visible={cuentaOpen}
        onClose={() => setCuentaOpen(false)}
        movimientos={seleccionados}
        signo={vista}
        concepto={verIguales ?? (debounced.trim() || null)}
        onDone={afterModal}
      />
    </>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap", marginBottom: 12 },
  selBar: { flexDirection: "row", alignItems: "center", gap: 8, padding: 10, borderRadius: SHELL_RADIUS.card, borderWidth: 1, marginBottom: 10 },
  miniBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: SHELL_RADIUS.button },
  verIguales: { padding: 8, borderRadius: SHELL_RADIUS.button, marginBottom: 8 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.card, borderWidth: 1 },
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  fecha: { fontSize: 12 },
  valor: { fontSize: 16, fontWeight: "700" },
  desc: { fontSize: 14, marginTop: 4 },
  sug: { marginTop: 10, padding: 10, borderRadius: SHELL_RADIUS.button },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" },
  btnOk: { flex: 1, paddingVertical: 10, borderRadius: SHELL_RADIUS.button, alignItems: "center" },
  btnOkText: { color: "#fff", fontWeight: "600" },
  btnNo: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: SHELL_RADIUS.button, borderWidth: 1, justifyContent: "center" },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

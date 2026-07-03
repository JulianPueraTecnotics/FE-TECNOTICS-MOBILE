import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  aplicarConc,
  aplicarConcLote,
  aplicarConcTodas,
  getConcPendientes,
  type ConcMovimiento,
} from "../reconciliation.service";
import { formatCOP, formatDate } from "../treasury.shared";

export default function BankConciliationAssistNative() {
  const colors = useThemeColors();
  const [movs, setMovs] = useState<ConcMovimiento[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [soloSugeridas, setSoloSugeridas] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [applying, setApplying] = useState(false);
  const [accionId, setAccionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const r = await getConcPendientes({ search: debounced.trim(), page, pageSize: 30, soloSugeridas });
      setMovs(r.movimientos);
      setTotalPages(r.pagination.totalPages);
      setTotal(r.pagination.total);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar movimientos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [debounced, page, soloSugeridas]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [debounced, soloSugeridas]);

  const sugerenciaLabel = (m: ConcMovimiento) => {
    if (m.factura_sugerida) return `Factura ${m.factura_sugerida.numero} · ${m.factura_sugerida.cliente}`;
    if (m.compra_sugerida) return `Compra ${m.compra_sugerida.numero} · ${m.compra_sugerida.proveedor}`;
    if (m.cliente_sugerido) return m.cliente_sugerido.nombre;
    return null;
  };

  const aplicarSugerida = async (m: ConcMovimiento) => {
    const fs = m.factura_sugerida;
    const cs = m.compra_sugerida;
    if (!fs && !cs) return;
    setAccionId(m.asiento_id);
    try {
      if (fs) {
        const ret = fs.retencion ? { valor: fs.retencion.valor, cuenta: fs.retencion.cuenta, pct: fs.retencion.pct } : null;
        await aplicarConc([m.asiento_id], "factura", fs.factura_id, ret);
      } else if (cs) {
        await aplicarConc([m.asiento_id], "compra", cs.compra_id);
      }
      successToast("Movimiento aplicado");
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo aplicar");
    } finally {
      setAccionId(null);
    }
  };

  const onAplicarLote = () => {
    const pares = movs
      .map((m) => {
        if (m.factura_sugerida) return { asiento_id: m.asiento_id, doc_tipo: "factura" as const, doc_id: m.factura_sugerida.factura_id };
        if (m.compra_sugerida) return { asiento_id: m.asiento_id, doc_tipo: "compra" as const, doc_id: m.compra_sugerida.compra_id };
        return null;
      })
      .filter(Boolean) as { asiento_id: string; doc_tipo: "factura" | "compra"; doc_id: string }[];
    if (pares.length === 0) return errorToast("No hay sugerencias en esta página");
    Alert.alert("Aplicar lote", `¿Aplicar ${pares.length} movimiento(s) de esta página?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aplicar",
        onPress: async () => {
          setApplying(true);
          try {
            const r = await aplicarConcLote(pares);
            successToast(r.message || `${r.conciliados} aplicados`);
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error en lote");
          } finally {
            setApplying(false);
          }
        },
      },
    ]);
  };

  const onAplicarTodas = () => {
    Alert.alert("Aplicar todas", "¿Aplicar todas las sugeridas que cumplan el filtro actual?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Aplicar",
        onPress: async () => {
          setApplying(true);
          try {
            const r = await aplicarConcTodas({ search: debounced.trim() || undefined });
            successToast(r.message || `${r.conciliados} aplicados`);
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al aplicar");
          } finally {
            setApplying(false);
          }
        },
      },
    ]);
  };

  return (
    <DsModuleScreen
      title="Conciliación asistida"
      subtitle={`${total} movimiento(s) pendientes`}
      loading={loading && movs.length === 0}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load();
      }}
      toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar…" />}
    >
      <View style={styles.actions}>
        <LedgerPrimaryBtn label={applying ? "Aplicando…" : "Aplicar página"} onPress={onAplicarLote} disabled={applying} />
        <Pressable onPress={onAplicarTodas} disabled={applying} style={[styles.chip, { borderColor: colors.border }]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Aplicar todas</Text>
        </Pressable>
      </View>

      <View style={styles.row}>
        <Pressable
          onPress={() => setSoloSugeridas((x) => !x)}
          style={[styles.chip, soloSugeridas ? { backgroundColor: colors.bgSubtle, borderColor: colors.headerAccent } : { borderColor: colors.border }]}
        >
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Solo con sugerencia</Text>
        </Pressable>
      </View>

        {movs.map((m) => {
          const sug = sugerenciaLabel(m);
          const busy = accionId === m.asiento_id;
          return (
            <View key={m.asiento_id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
              <View style={styles.cardTop}>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{formatDate(m.fecha)}</Text>
                <Text style={{ color: colors.primary, fontWeight: "700" }}>{formatCOP(m.valor)}</Text>
              </View>
              <Text style={{ color: colors.primary, marginTop: 6 }} numberOfLines={2}>{m.descripcion}</Text>
              {sug ? (
                <View style={[styles.sug, { backgroundColor: colors.bgSubtle }]}>
                  <Text style={{ color: colors.primary, fontWeight: "600", fontSize: 13 }}>{sug}</Text>
                  <Pressable
                    onPress={() => aplicarSugerida(m)}
                    disabled={busy || applying}
                    style={[styles.btnOk, { backgroundColor: colors.headerAccent, marginTop: 10 }]}
                  >
                    {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={{ color: "#fff", fontWeight: "600" }}>Aplicar sugerencia</Text>}
                  </Pressable>
                </View>
              ) : (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 8 }}>Sin sugerencia</Text>
              )}
            </View>
          );
        })}

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
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 12 },
  row: { flexDirection: "row", marginBottom: 12 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.card, borderWidth: 1 },
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 12 },
  cardTop: { flexDirection: "row", justifyContent: "space-between" },
  sug: { marginTop: 10, padding: 10, borderRadius: SHELL_RADIUS.button },
  btnOk: { paddingVertical: 10, borderRadius: SHELL_RADIUS.button, alignItems: "center" },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  pageBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
});

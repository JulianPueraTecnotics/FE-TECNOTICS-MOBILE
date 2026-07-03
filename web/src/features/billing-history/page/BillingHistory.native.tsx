import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import AnalyticsSectionNative, { AnalyticsRow } from "../../../components/native/analytics/AnalyticsSection.native";
import { DsModuleScreen } from "../../../components/design-system-native";
import { getCompanyStatistics, type CompanyStatisticsData } from "../../../services/company-statistics.service";
import {
  getCarteraAging,
  getCxpAging,
  getEmbudoCotizaciones,
  getRecaudoFormaPago,
  getTopClientes,
  getTopProveedores,
  getVentasComprasGastos,
  type DateRange,
} from "../../../services/business-reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import {
  DATE_PRESETS,
  ESTADO_FACTURA,
  METHOD_LABELS,
  QUOTE_LABELS,
  money,
  moneyShort,
  monthLabel,
  presetRange,
} from "../../analytics/analytics.shared";

type Tab = "resumen" | "reportes";

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

function DateBar({
  preset,
  range,
  onPreset,
  onRange,
}: {
  preset: string;
  range: DateRange;
  onPreset: (p: string) => void;
  onRange: (r: DateRange) => void;
}) {
  const colors = useThemeColors();
  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8, gap: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {DATE_PRESETS.map((p) => (
          <Pressable
            key={p.key}
            onPress={() => onPreset(p.key)}
            style={[
              styles.chip,
              { borderColor: colors.border, backgroundColor: preset === p.key ? colors.headerAccent : colors.cardBg },
            ]}
          >
            <Text style={{ color: preset === p.key ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>
              {p.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
      {preset === "custom" ? (
        <View style={{ flexDirection: "row", gap: 8 }}>
          <TextInput
            value={range.from ?? ""}
            onChangeText={(v) => onRange({ ...range, from: v })}
            placeholder="Desde (YYYY-MM-DD)"
            placeholderTextColor={colors.textMuted}
            style={[styles.dateInput, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
          />
          <TextInput
            value={range.to ?? ""}
            onChangeText={(v) => onRange({ ...range, to: v })}
            placeholder="Hasta"
            placeholderTextColor={colors.textMuted}
            style={[styles.dateInput, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
          />
        </View>
      ) : null}
    </View>
  );
}

export default function BillingHistoryNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [tab, setTab] = useState<Tab>("resumen");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState<CompanyStatisticsData | null>(null);
  const [preset, setPreset] = useState("anio");
  const [range, setRange] = useState<DateRange>(presetRange("anio"));
  const [cartera, setCartera] = useState<Awaited<ReturnType<typeof getCarteraAging>> | null>(null);
  const [cxp, setCxp] = useState<Awaited<ReturnType<typeof getCxpAging>> | null>(null);
  const [topCli, setTopCli] = useState<Awaited<ReturnType<typeof getTopClientes>>>([]);
  const [topProv, setTopProv] = useState<Awaited<ReturnType<typeof getTopProveedores>>>([]);
  const [comparativo, setComparativo] = useState<Awaited<ReturnType<typeof getVentasComprasGastos>>>([]);
  const [recaudo, setRecaudo] = useState<Awaited<ReturnType<typeof getRecaudoFormaPago>> | null>(null);
  const [embudo, setEmbudo] = useState<Awaited<ReturnType<typeof getEmbudoCotizaciones>> | null>(null);

  const applyPreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const load = useCallback(async () => {
    if (!refreshing) setLoading(true);
    try {
      if (tab === "resumen") {
        const res = await getCompanyStatistics();
        if (res?.ok && res.data) setStats(res.data);
      } else {
        const [c, cp, tc, tp, comp, rec, emb] = await Promise.all([
          getCarteraAging(),
          getCxpAging(),
          getTopClientes(range),
          getTopProveedores(range),
          getVentasComprasGastos(range),
          getRecaudoFormaPago(range),
          getEmbudoCotizaciones(range),
        ]);
        setCartera(c);
        setCxp(cp);
        setTopCli(tc);
        setTopProv(tp);
        setComparativo(comp);
        setRecaudo(rec);
        setEmbudo(emb);
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar datos");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, range, refreshKey, refreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  const facturas = stats?.facturas;

  return (
    <DsModuleScreen
      title="Histórico de facturación"
      subtitle="Estadísticas e informes de gestión"
      loading={loading && !refreshing}
      noScroll
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        setRefreshKey((k) => k + 1);
      }}
    >
      <View style={[styles.tabRow, { borderBottomColor: colors.border }]}>
        {(["resumen", "reportes"] as Tab[]).map((t) => (
          <Pressable
            key={t}
            onPress={() => setTab(t)}
            style={[
              styles.tabBtn,
              tab === t ? { backgroundColor: colors.headerAccent, borderRadius: SHELL_RADIUS.button } : null,
            ]}
          >
            <Text style={{ color: tab === t ? "#fff" : colors.textMuted, fontWeight: tab === t ? "700" : "500" }}>
              {t === "resumen" ? "Resumen" : "Reportes"}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === "reportes" ? <DateBar preset={preset} range={range} onPreset={applyPreset} onRange={setRange} /> : null}

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}
      >
        {loading && refreshing ? <ActivityIndicator color={colors.headerAccent} style={{ marginBottom: 12 }} /> : null}

        {tab === "resumen" && facturas ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Facturas emitidas" value={String(facturas.total)} icon="document-text-outline" />
              <AnalyticsKpiNative label="Total facturado" value={moneyShort(facturas.totalFacturado)} icon="cash-outline" accent="#22c55e" hint="Ventas aprobadas" />
              <AnalyticsKpiNative label="Aprobadas" value={String(facturas.aprobadas)} icon="checkmark-circle-outline" accent="#16a34a" />
              <AnalyticsKpiNative label="Borradores" value={String(facturas.borradores)} icon="create-outline" accent="#94a3b8" />
              <AnalyticsKpiNative label="Clientes" value={String(stats?.clientes.total ?? 0)} icon="people-outline" accent="#0ea5e9" />
              <AnalyticsKpiNative label="Nóminas" value={String(stats?.nomina.total ?? 0)} icon="wallet-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Empleados" value={String(stats?.nomina.empleados ?? 0)} icon="people-circle-outline" accent="#a855f7" />
              <AnalyticsKpiNative label="Ítems catálogo" value={String(stats?.items.total ?? 0)} icon="cube-outline" accent="#6366f1" />
            </KpiGrid>

            {facturas.total === 0 && (stats?.nomina.total ?? 0) === 0 ? (
              <Text style={[styles.empty, { color: colors.textMuted }]}>
                Aún no hay documentos emitidos. Cuando emitas facturas o nómina verás aquí tus indicadores.
              </Text>
            ) : null}

            {facturas.porMes.length ? (
              <AnalyticsSectionNative title="Documentos por mes">
                {[...facturas.porMes].reverse().map((m) => (
                  <AnalyticsRow key={`${m.year}-${m.month}`} left={monthLabel(m.year, m.month)} right={`${m.count} docs · ${money(m.totalValorAPagar)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {facturas.porEstado.length ? (
              <AnalyticsSectionNative title="Por estado">
                {facturas.porEstado.map((e) => (
                  <AnalyticsRow key={e.estado} left={ESTADO_FACTURA[e.estado] ?? e.estado} right={String(e.count)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {facturas.porTipoDocumento.length ? (
              <AnalyticsSectionNative title="Por tipo de documento">
                {facturas.porTipoDocumento.map((t) => (
                  <AnalyticsRow key={t.tipo} left={t.tipo} right={`${t.count} · ${moneyShort(t.totalValorAPagar)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {facturas.porPrefijo.length ? (
              <AnalyticsSectionNative title="Por prefijo">
                {facturas.porPrefijo.map((p) => (
                  <AnalyticsRow key={p.prefijo} left={p.prefijo} right={`${p.count} · ${moneyShort(p.totalValorAPagar)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {(stats?.items.porTipo.length ?? 0) > 0 ? (
              <AnalyticsSectionNative title="Productos vs servicios">
                {stats!.items.porTipo.map((t) => (
                  <AnalyticsRow key={t.kind} left={t.kind} right={String(t.count)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "reportes" ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Por cobrar" value={moneyShort(cartera?.total ?? 0)} hint={`Vencido ${moneyShort(cartera?.totalVencido ?? 0)}`} icon="arrow-down-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Por pagar" value={moneyShort(cxp?.total ?? 0)} hint={`Vencido ${moneyShort(cxp?.totalVencido ?? 0)}`} icon="arrow-up-outline" accent="#ef4444" />
              <AnalyticsKpiNative label="Recaudado" value={moneyShort(recaudo?.total ?? 0)} icon="cash-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Cotiz. facturadas" value={String(embudo?.facturadas ?? 0)} hint={`Conv. ${embudo?.tasaConversion ?? 0}%`} icon="document-outline" />
            </KpiGrid>

            {cartera?.buckets.length ? (
              <AnalyticsSectionNative title="Cartera por antigüedad">
                {cartera.buckets.map((b) => (
                  <AnalyticsRow key={b.label} left={b.label} right={money(b.total)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {cxp?.buckets.length ? (
              <AnalyticsSectionNative title="Cuentas por pagar por antigüedad">
                {cxp.buckets.map((b) => (
                  <AnalyticsRow key={b.label} left={b.label} right={money(b.total)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {comparativo.length ? (
              <AnalyticsSectionNative title="Ventas vs compras vs gastos">
                {comparativo.map((r) => (
                  <AnalyticsRow
                    key={`${r.year}-${r.month}`}
                    left={monthLabel(r.year, r.month)}
                    right={`V ${moneyShort(r.ventas)} · C ${moneyShort(r.compras)} · G ${moneyShort(r.gastos)}`}
                  />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {recaudo?.rows.length ? (
              <AnalyticsSectionNative title="Recaudo por forma de pago">
                {recaudo.rows.map((r) => (
                  <AnalyticsRow key={r.method} left={METHOD_LABELS[r.method] ?? r.method} right={money(r.total)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {embudo?.porEstado.length ? (
              <AnalyticsSectionNative title="Embudo de cotizaciones">
                {embudo.porEstado.map((r) => (
                  <AnalyticsRow key={r.estado} left={QUOTE_LABELS[r.estado] ?? r.estado} right={String(r.count)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {topCli.length ? (
              <AnalyticsSectionNative title="Top clientes">
                {topCli.slice(0, 15).map((c, i) => (
                  <AnalyticsRow key={c.doc + i} left={`${i + 1}. ${c.nombre}`} right={`${money(c.total)} (${c.pct}%)`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {topProv.length ? (
              <AnalyticsSectionNative title="Top proveedores">
                {topProv.slice(0, 15).map((c, i) => (
                  <AnalyticsRow key={c.doc + i} left={`${i + 1}. ${c.nombre}`} right={`${money(c.total)} (${c.pct}%)`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}

            {cartera?.rows.length ? (
              <AnalyticsSectionNative title="Cartera por cliente">
                {cartera.rows.slice(0, 20).map((r, i) => (
                  <AnalyticsRow key={r.doc + i} left={r.nombre} right={money(r.total)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, gap: 8, paddingVertical: 8 },
  tabBtn: { flex: 1, alignItems: "center", paddingVertical: 10 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  dateInput: { flex: 1, borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  empty: { textAlign: "center", marginTop: 24, lineHeight: 20, fontSize: 14 },
});

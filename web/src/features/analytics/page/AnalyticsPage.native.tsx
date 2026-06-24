import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import AnalyticsSectionNative, { AnalyticsRow } from "../../../components/native/analytics/AnalyticsSection.native";
import LoadingScreen from "../../../router/LoadingScreen";
import { getCompanyStatistics, type CompanyStatisticsData } from "../../../services/company-statistics.service";
import {
  getCarteraAging,
  getCxpAging,
  getEmbudoCotizaciones,
  getRecaudoFormaPago,
  getTopClientes,
  getTopProveedores,
  getVentasComprasGastos,
} from "../../../services/business-reports.service";
import { errorToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import {
  getAlerts,
  getAssets,
  getCashflowMonthly,
  getCashflowProjection,
  getDsoDpo,
  getExecutiveSummary,
  getIva,
  getPayroll,
  getPendingDocs,
  getPlMonthly,
  getProjection,
  getRetenciones,
  getScoring,
  getTopProductos,
  type DateRange,
  type ExecutiveSummary,
  type PlMonthlyRow,
} from "../analytics.service";
import {
  ANALYTICS_TABS,
  DATE_PRESETS,
  ESTADO_FACTURA,
  METHOD_LABELS,
  QUOTE_LABELS,
  URGENCY_LABELS,
  money,
  moneyShort,
  monthLabel,
  periodoLabel,
  presetRange,
  tabUsesDateBar,
  type AnalyticsTab,
} from "../analytics.shared";

function KpiGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.kpiGrid}>{children}</View>;
}

export default function AnalyticsPageNative() {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const [tab, setTab] = useState<AnalyticsTab>("resumen");
  const [preset, setPreset] = useState("anio");
  const [range, setRange] = useState<DateRange>(presetRange("anio"));
  const [carteraPreset, setCarteraPreset] = useState("anio");
  const [carteraRange, setCarteraRange] = useState<DateRange>(presetRange("anio"));
  const [scoreTipo, setScoreTipo] = useState<"cliente" | "proveedor">("cliente");
  const [pendTipo, setPendTipo] = useState<"cobrar" | "pagar">("cobrar");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const [exec, setExec] = useState<ExecutiveSummary | null>(null);
  const [pl, setPl] = useState<PlMonthlyRow[]>([]);
  const [alerts, setAlerts] = useState<{ level: string; text: string }[]>([]);
  const [stats, setStats] = useState<CompanyStatisticsData | null>(null);
  const [cartera, setCartera] = useState<Awaited<ReturnType<typeof getCarteraAging>> | null>(null);
  const [cxp, setCxp] = useState<Awaited<ReturnType<typeof getCxpAging>> | null>(null);
  const [topCli, setTopCli] = useState<Awaited<ReturnType<typeof getTopClientes>>>([]);
  const [topProv, setTopProv] = useState<Awaited<ReturnType<typeof getTopProveedores>>>([]);
  const [comparativo, setComparativo] = useState<Awaited<ReturnType<typeof getVentasComprasGastos>>>([]);
  const [recaudo, setRecaudo] = useState<Awaited<ReturnType<typeof getRecaudoFormaPago>> | null>(null);
  const [embudo, setEmbudo] = useState<Awaited<ReturnType<typeof getEmbudoCotizaciones>> | null>(null);
  const [cash, setCash] = useState<Awaited<ReturnType<typeof getCashflowMonthly>> | null>(null);
  const [cashProj, setCashProj] = useState<Awaited<ReturnType<typeof getCashflowProjection>> | null>(null);
  const [dso, setDso] = useState<Awaited<ReturnType<typeof getDsoDpo>> | null>(null);
  const [pendCobrar, setPendCobrar] = useState<Awaited<ReturnType<typeof getPendingDocs>> | null>(null);
  const [pendPagar, setPendPagar] = useState<Awaited<ReturnType<typeof getPendingDocs>> | null>(null);
  const [iva, setIva] = useState<Awaited<ReturnType<typeof getIva>> | null>(null);
  const [retenciones, setRetenciones] = useState<Awaited<ReturnType<typeof getRetenciones>> | null>(null);
  const [productos, setProductos] = useState<Awaited<ReturnType<typeof getTopProductos>>>([]);
  const [payroll, setPayroll] = useState<Awaited<ReturnType<typeof getPayroll>> | null>(null);
  const [assets, setAssets] = useState<Awaited<ReturnType<typeof getAssets>> | null>(null);
  const [scoring, setScoring] = useState<Awaited<ReturnType<typeof getScoring>> | null>(null);
  const [proj, setProj] = useState<Awaited<ReturnType<typeof getProjection>> | null>(null);

  const applyPreset = (p: string) => {
    setPreset(p);
    if (p !== "custom") setRange(presetRange(p));
  };

  const applyCarteraPreset = (p: string) => {
    setCarteraPreset(p);
    if (p !== "custom") setCarteraRange(presetRange(p));
  };

  const load = useCallback(async () => {
    if (!refreshing) setLoading(true);
    try {
      switch (tab) {
        case "resumen": {
          const [e, p, pr, al] = await Promise.all([
            getExecutiveSummary(range),
            getPlMonthly(range),
            getProjection(range),
            getAlerts(range).then((r) => r.alerts).catch(() => []),
          ]);
          setExec(e);
          setPl(p);
          setProj(pr);
          setAlerts(al);
          break;
        }
        case "ventas": {
          const res = await getCompanyStatistics();
          if (res?.ok && res.data) setStats(res.data);
          break;
        }
        case "rentabilidad":
          setPl(await getPlMonthly(range));
          break;
        case "cartera": {
          const [c, cp, tc, tp, comp, rec, emb] = await Promise.all([
            getCarteraAging(),
            getCxpAging(),
            getTopClientes(carteraRange),
            getTopProveedores(carteraRange),
            getVentasComprasGastos(carteraRange),
            getRecaudoFormaPago(carteraRange),
            getEmbudoCotizaciones(carteraRange),
          ]);
          setCartera(c);
          setCxp(cp);
          setTopCli(tc);
          setTopProv(tp);
          setComparativo(comp);
          setRecaudo(rec);
          setEmbudo(emb);
          break;
        }
        case "tesoreria": {
          const [c, cp, d, pc, pp] = await Promise.all([
            getCashflowMonthly(range),
            getCashflowProjection(),
            getDsoDpo(range),
            getPendingDocs("cobrar"),
            getPendingDocs("pagar"),
          ]);
          setCash(c);
          setCashProj(cp);
          setDso(d);
          setPendCobrar(pc);
          setPendPagar(pp);
          break;
        }
        case "tributario": {
          const [i, r, prod] = await Promise.all([
            getIva(range),
            getRetenciones(range),
            getTopProductos(range).catch(() => []),
          ]);
          setIva(i);
          setRetenciones(r);
          setProductos(prod);
          break;
        }
        case "nomina":
          setPayroll(await getPayroll(range));
          break;
        case "activos":
          setAssets(await getAssets());
          break;
        case "scoring":
          setScoring(await getScoring(range, scoreTipo));
          break;
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar estadísticas");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, range, carteraRange, scoreTipo, refreshKey, refreshing]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading && !refreshing) return <LoadingScreen />;

  const showDateBar = tabUsesDateBar(tab);
  const showCarteraDateBar = tab === "cartera";

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Text style={[styles.title, { color: colors.primary }]}>Estadísticas</Text>
        <Text style={[styles.subtitle, { color: colors.textMuted }]}>
          Indicadores financieros y operativos de tu empresa
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ maxHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}
        contentContainerStyle={styles.tabs}
      >
        {ANALYTICS_TABS.map((t) => (
          <Pressable
            key={t.key}
            style={[styles.tabChip, tab === t.key ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => setTab(t.key)}
          >
            <Ionicons name={t.icon} size={14} color={tab === t.key ? "#fff" : colors.primaryText} />
            <Text style={{ color: tab === t.key ? "#fff" : colors.primaryText, fontSize: 12, fontWeight: "600" }}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {showDateBar ? (
        <DateBar preset={preset} range={range} onPreset={applyPreset} onRange={setRange} />
      ) : null}
      {showCarteraDateBar ? (
        <DateBar preset={carteraPreset} range={carteraRange} onPreset={applyCarteraPreset} onRange={setCarteraRange} />
      ) : null}

      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom + 16 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setRefreshKey((k) => k + 1);
            }}
            tintColor={colors.accent}
          />
        }
      >
        {loading && refreshing ? <ActivityIndicator color={colors.accent} style={{ marginBottom: 12 }} /> : null}

        {tab === "resumen" && exec ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Ingresos" value={moneyShort(exec.ingresos)} icon="trending-up-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Utilidad neta" value={moneyShort(exec.utilidadNeta)} icon="stats-chart-outline" accent="#3b82f6" hint={`Margen ${exec.margenNeto}%`} negative={exec.utilidadNeta < 0} />
              <AnalyticsKpiNative label="Caja y bancos" value={moneyShort(exec.caja)} icon="business-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Por cobrar" value={moneyShort(exec.cxc)} icon="arrow-down-outline" accent="#0ea5e9" />
              <AnalyticsKpiNative label="Por pagar" value={moneyShort(exec.cxp)} icon="arrow-up-outline" accent="#ef4444" />
              <AnalyticsKpiNative label="Capital de trabajo" value={moneyShort(exec.capitalTrabajo)} icon="scale-outline" accent="#6366f1" negative={exec.capitalTrabajo < 0} />
            </KpiGrid>
            {alerts.length ? (
              <AnalyticsSectionNative title="Semáforo financiero" subtitle="Alertas del período">
                {alerts.map((a, i) => (
                  <Text key={i} style={{ color: a.level === "bad" ? "#dc2626" : a.level === "warn" ? "#d97706" : colors.primaryText, fontSize: 13, marginBottom: 6 }}>
                    • {a.text}
                  </Text>
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {pl.length ? (
              <AnalyticsSectionNative title="Resultado mensual" subtitle="Ingresos y utilidad por mes">
                {pl.map((r) => (
                  <AnalyticsRow key={r.periodo} left={monthLabel(r.year, r.month)} right={money(r.utilidadNeta)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {proj?.proyeccion?.length ? (
              <AnalyticsSectionNative title="Proyección de ingresos" subtitle="Próximos 3 meses">
                {proj.proyeccion.map((p) => (
                  <AnalyticsRow key={p.periodo} left={periodoLabel(p.periodo)} right={money(p.centro)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "ventas" && stats ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Facturas emitidas" value={String(stats.facturas.total)} icon="document-text-outline" />
              <AnalyticsKpiNative label="Total facturado" value={moneyShort(stats.facturas.totalFacturado)} icon="cash-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Aprobadas" value={String(stats.facturas.aprobadas)} icon="checkmark-circle-outline" accent="#16a34a" />
              <AnalyticsKpiNative label="Clientes" value={String(stats.clientes.total)} icon="people-outline" accent="#0ea5e9" />
              <AnalyticsKpiNative label="Nóminas" value={String(stats.nomina.total)} icon="wallet-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Ítems catálogo" value={String(stats.items.total)} icon="cube-outline" accent="#6366f1" />
            </KpiGrid>
            {stats.facturas.porMes.length ? (
              <AnalyticsSectionNative title="Facturado por mes">
                {[...stats.facturas.porMes].reverse().map((m) => (
                  <AnalyticsRow key={`${m.year}-${m.month}`} left={monthLabel(m.year, m.month)} right={money(m.totalValorAPagar)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {stats.facturas.porEstado.length ? (
              <AnalyticsSectionNative title="Por estado">
                {stats.facturas.porEstado.map((e) => (
                  <AnalyticsRow key={e.estado} left={ESTADO_FACTURA[e.estado] ?? e.estado} right={String(e.count)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "rentabilidad" && pl.length ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Ingresos (rango)" value={moneyShort(pl.reduce((s, r) => s + r.ingresos, 0))} icon="trending-up-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Utilidad neta" value={moneyShort(pl.reduce((s, r) => s + r.utilidadNeta, 0))} icon="stats-chart-outline" accent="#3b82f6" />
            </KpiGrid>
            <AnalyticsSectionNative title="Estado de resultados mensual">
              {pl.map((r) => (
                <AnalyticsRow
                  key={r.periodo}
                  left={`${monthLabel(r.year, r.month)} · Ing ${moneyShort(r.ingresos)}`}
                  right={`${money(r.utilidadNeta)} (${r.margenNeto}%)`}
                />
              ))}
            </AnalyticsSectionNative>
          </>
        ) : null}

        {tab === "cartera" ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Por cobrar" value={moneyShort(cartera?.total ?? 0)} hint={`Vencido ${moneyShort(cartera?.totalVencido ?? 0)}`} icon="arrow-down-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Por pagar" value={moneyShort(cxp?.total ?? 0)} hint={`Vencido ${moneyShort(cxp?.totalVencido ?? 0)}`} icon="arrow-up-outline" accent="#ef4444" />
              <AnalyticsKpiNative label="Recaudado" value={moneyShort(recaudo?.total ?? 0)} icon="cash-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Cotiz. facturadas" value={String(embudo?.facturadas ?? 0)} hint={`Conv. ${embudo?.tasaConversion ?? 0}%`} icon="document-outline" />
            </KpiGrid>
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
            {topCli.length ? (
              <AnalyticsSectionNative title="Top clientes">
                {topCli.slice(0, 10).map((c, i) => (
                  <AnalyticsRow key={c.doc + i} left={`${i + 1}. ${c.nombre}`} right={`${money(c.total)} (${c.pct}%)`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {topProv.length ? (
              <AnalyticsSectionNative title="Top proveedores">
                {topProv.slice(0, 10).map((c, i) => (
                  <AnalyticsRow key={c.doc + i} left={`${i + 1}. ${c.nombre}`} right={`${money(c.total)} (${c.pct}%)`} />
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
          </>
        ) : null}

        {tab === "tesoreria" ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Caja actual" value={moneyShort(cashProj?.cajaActual ?? cash?.saldoFinal ?? 0)} icon="business-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Por cobrar" value={moneyShort(cashProj?.totalPorCobrar ?? 0)} icon="arrow-down-outline" accent="#22c55e" />
              <AnalyticsKpiNative label="Por pagar" value={moneyShort(cashProj?.totalPorPagar ?? 0)} icon="arrow-up-outline" accent="#ef4444" />
              <AnalyticsKpiNative label="DSO" value={`${dso?.dso ?? 0} d`} icon="time-outline" accent="#0ea5e9" />
              <AnalyticsKpiNative label="DPO" value={`${dso?.dpo ?? 0} d`} icon="timer-outline" accent="#a855f7" />
              <AnalyticsKpiNative label="Saldo proyectado" value={moneyShort(cashProj?.saldoProyectadoFinal ?? 0)} negative={(cashProj?.saldoProyectadoFinal ?? 0) < 0} />
            </KpiGrid>
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.toggleBtn,
                  { borderColor: colors.border },
                  pendTipo === "cobrar" && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setPendTipo("cobrar")}
              >
                <Text style={{ color: pendTipo === "cobrar" ? "#fff" : colors.primaryText, fontSize: 12 }}>Por cobrar</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  { borderColor: colors.border },
                  pendTipo === "pagar" && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setPendTipo("pagar")}
              >
                <Text style={{ color: pendTipo === "pagar" ? "#fff" : colors.primaryText, fontSize: 12 }}>Por pagar</Text>
              </Pressable>
            </View>
            {(pendTipo === "cobrar" ? pendCobrar : pendPagar)?.docs.length ? (
              <AnalyticsSectionNative title={`Pendientes de ${pendTipo === "cobrar" ? "cobro" : "pago"}`}>
                {(pendTipo === "cobrar" ? pendCobrar : pendPagar)!.docs.slice(0, 15).map((d, i) => (
                  <AnalyticsRow
                    key={d.numero + i}
                    left={`${d.numero} · ${d.tercero}`}
                    right={`${money(d.saldo)} · ${URGENCY_LABELS[d.urgencia]?.label ?? d.urgencia}`}
                  />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {cash?.meses.length ? (
              <AnalyticsSectionNative title="Flujo de caja histórico">
                {cash.meses.map((m) => (
                  <AnalyticsRow key={`${m.year}-${m.month}`} left={monthLabel(m.year, m.month)} right={`E ${moneyShort(m.entradas)} · S ${moneyShort(m.salidas)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "tributario" && iva ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="IVA generado" value={moneyShort(iva.generado)} accent="#22c55e" />
              <AnalyticsKpiNative label="IVA descontable" value={moneyShort(iva.descontable)} accent="#3b82f6" />
              <AnalyticsKpiNative label="Saldo IVA" value={moneyShort(Math.abs(iva.saldo))} hint={iva.signo === "favor" ? "A favor" : "A pagar"} accent={iva.signo === "favor" ? "#22c55e" : "#ef4444"} />
              <AnalyticsKpiNative label="Ret. practicadas" value={moneyShort(retenciones?.totalPracticadas ?? 0)} accent="#a855f7" />
            </KpiGrid>
            {iva.porPeriodo.length ? (
              <AnalyticsSectionNative title="IVA por período">
                {iva.porPeriodo.map((p) => (
                  <AnalyticsRow key={p.periodo} left={periodoLabel(p.periodo)} right={`G ${moneyShort(p.generado)} · D ${moneyShort(p.descontable)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {retenciones?.practicadas.length ? (
              <AnalyticsSectionNative title="Retenciones practicadas">
                {retenciones.practicadas.map((r) => (
                  <AnalyticsRow key={r.cuenta} left={`${r.nombre} (${r.tipo})`} right={money(r.valor)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
            {productos.length ? (
              <AnalyticsSectionNative title="Top productos vendidos">
                {productos.map((p, i) => (
                  <AnalyticsRow key={p.nombre + i} left={`${i + 1}. ${p.nombre}`} right={`${money(p.total)} (${p.pct}%)`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "nomina" && payroll ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Costo laboral" value={moneyShort(payroll.costoLaboral)} icon="people-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Empleados" value={String(payroll.headcount)} icon="person-outline" accent="#3b82f6" />
              <AnalyticsKpiNative label="Costo promedio" value={moneyShort(payroll.costoPromedio)} icon="star-outline" accent="#a855f7" />
            </KpiGrid>
            {payroll.porPeriodo.length ? (
              <AnalyticsSectionNative title="Costo laboral por mes">
                {payroll.porPeriodo.map((p) => (
                  <AnalyticsRow key={p.periodo} left={periodoLabel(p.periodo)} right={money(p.costo)} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "activos" && assets ? (
          <>
            <KpiGrid>
              <AnalyticsKpiNative label="Valor en libros" value={moneyShort(assets.valorEnLibros)} icon="hardware-chip-outline" accent="#14b8a6" />
              <AnalyticsKpiNative label="Costo histórico" value={moneyShort(assets.costoHistorico)} accent="#3b82f6" />
              <AnalyticsKpiNative label="Dep. acumulada" value={moneyShort(assets.depreciacionAcum)} accent="#f59e0b" />
              <AnalyticsKpiNative label="Activos en uso" value={String(assets.activosCount)} accent="#a855f7" />
            </KpiGrid>
            {assets.porCategoria.length ? (
              <AnalyticsSectionNative title="Por categoría">
                {assets.porCategoria.map((c) => (
                  <AnalyticsRow key={c.categoria} left={c.categoria} right={`${c.count} · ${money(c.neto)}`} />
                ))}
              </AnalyticsSectionNative>
            ) : null}
          </>
        ) : null}

        {tab === "scoring" ? (
          <>
            <View style={styles.toggleRow}>
              <Pressable
                style={[
                  styles.toggleBtn,
                  { borderColor: colors.border },
                  scoreTipo === "cliente" && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setScoreTipo("cliente")}
              >
                <Text style={{ color: scoreTipo === "cliente" ? "#fff" : colors.primaryText, fontSize: 12 }}>Clientes</Text>
              </Pressable>
              <Pressable
                style={[
                  styles.toggleBtn,
                  { borderColor: colors.border },
                  scoreTipo === "proveedor" && { backgroundColor: colors.accent, borderColor: colors.accent },
                ]}
                onPress={() => setScoreTipo("proveedor")}
              >
                <Text style={{ color: scoreTipo === "proveedor" ? "#fff" : colors.primaryText, fontSize: 12 }}>Proveedores</Text>
              </Pressable>
            </View>
            <KpiGrid>
              <AnalyticsKpiNative label="Eficientes" value={String(scoring?.resumen.eficientes ?? 0)} accent="#22c55e" />
              <AnalyticsKpiNative label="Normales" value={String(scoring?.resumen.normales ?? 0)} accent="#f59e0b" />
              <AnalyticsKpiNative label="En riesgo" value={String(scoring?.resumen.riesgo ?? 0)} accent="#ef4444" />
            </KpiGrid>
            {scoring?.terceros.length ? (
              <AnalyticsSectionNative title={`Scoring de ${scoreTipo === "cliente" ? "clientes" : "proveedores"}`}>
                {scoring.terceros.slice(0, 20).map((t, i) => (
                  <AnalyticsRow key={t.doc + i} left={`${t.nombre} · ${t.ejecucion}%`} right={`${money(t.saldo)} · ${t.score}`} />
                ))}
              </AnalyticsSectionNative>
            ) : (
              <Text style={[styles.empty, { color: colors.textMuted }]}>Sin movimientos en el período</Text>
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
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
    <View style={[styles.dateBar, { borderBottomColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingVertical: 8 }}>
        {DATE_PRESETS.map((p) => (
          <Pressable
            key={p.key}
            style={[styles.presetChip, preset === p.key ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 }]}
            onPress={() => onPreset(p.key)}
          >
            <Text style={{ color: preset === p.key ? "#fff" : colors.primaryText, fontSize: 12 }}>{p.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {preset === "custom" ? (
        <View style={styles.customRange}>
          <TextInput
            style={[styles.dateInput, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
            value={range.from ?? ""}
            onChangeText={(v) => onRange({ ...range, from: v })}
            placeholder="Desde AAAA-MM-DD"
            placeholderTextColor={colors.textMuted}
          />
          <TextInput
            style={[styles.dateInput, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
            value={range.to ?? ""}
            onChangeText={(v) => onRange({ ...range, to: v })}
            placeholder="Hasta AAAA-MM-DD"
            placeholderTextColor={colors.textMuted}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 22, fontWeight: "700" },
  subtitle: { fontSize: 13, marginTop: 2 },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, alignItems: "center" },
  tabChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  dateBar: { borderBottomWidth: StyleSheet.hairlineWidth },
  presetChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  customRange: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  dateInput: { flex: 1, borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between" },
  toggleRow: { flexDirection: "row", gap: 8, marginBottom: 12 },
  toggleBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  empty: { textAlign: "center", paddingVertical: 24, fontSize: 14 },
});

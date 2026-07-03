import { Ionicons } from "@expo/vector-icons";
import { useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate } from "react-router-dom";
import AnalyticsKpiNative from "../../../components/native/analytics/AnalyticsKpi.native";
import AnalyticsSectionNative, { AnalyticsRow } from "../../../components/native/analytics/AnalyticsSection.native";
import {
  ChartLegend,
  SimpleGroupedBarChart,
  SimpleStackedBarChart,
} from "../../../components/native/analytics/SimpleMiniChart.native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { AuthContext } from "../../../store/auth.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast } from "../../../components/shared/toast/toasts";
import {
  getExecutiveSummary,
  getIva,
  getPlMonthly,
  getRetenciones,
  PERIOD_LABEL,
  PERIOD_PRESETS,
  presetRange,
  type ExecutiveSummary,
  type IvaReport,
  type PeriodPreset,
  type PlMonthlyRow,
  type RetencionesReport,
} from "../../analytics/analytics.service";
import { money, periodoLabel } from "../../analytics/analytics.shared";
import { getTaxCalendar, type TaxCalendar, type VencimientoProximo } from "../tax.service";

const TEAL = "#5a9fb4";

const ESTADO_COLORS: Record<VencimientoProximo["estado"], string> = {
  vencido: "#dc2626",
  critico: "#ea580c",
  por_vencer: "#0284c7",
  al_dia: "#059669",
};

const ESTADO_LABELS: Record<VencimientoProximo["estado"], string> = {
  vencido: "Vencido",
  critico: "Crítico",
  por_vencer: "Por vencer",
  al_dia: "Al día",
};

const QUICK_LINKS = [
  { label: "Facturas", icon: "document-text-outline" as const, path: PATHS.DOCUMENTS },
  { label: "Clientes", icon: "people-outline" as const, path: PATHS.CLIENTS },
  { label: "Cotizaciones", icon: "create-outline" as const, path: PATHS.SALES_COTIZACIONES },
  { label: "Analítica", icon: "stats-chart-outline" as const, path: PATHS.ANALYTICS },
  { label: "Configuración", icon: "settings-outline" as const, path: PATHS.CONFIGURATION },
];

export default function OwnerDashboardNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [periodo, setPeriodo] = useState<PeriodPreset>("mes");
  const [calendar, setCalendar] = useState<TaxCalendar | null>(null);
  const [resumen, setResumen] = useState<ExecutiveSummary | null>(null);
  const [iva, setIva] = useState<IvaReport | null>(null);
  const [ret, setRet] = useState<RetencionesReport | null>(null);
  const [pl, setPl] = useState<PlMonthlyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const rango = useMemo(() => presetRange(periodo), [periodo]);
  const periodoLabelText = PERIOD_LABEL[periodo];
  const firstName = user?.razon_social?.split(" ")[0];

  const load = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [cal, exec, ivaR, retR, plR] = await Promise.allSettled([
        getTaxCalendar(120),
        getExecutiveSummary(rango),
        getIva(rango),
        getRetenciones(rango),
        getPlMonthly({}),
      ]);
      if (cal.status === "fulfilled") setCalendar(cal.value);
      if (exec.status === "fulfilled") setResumen(exec.value);
      if (ivaR.status === "fulfilled") setIva(ivaR.value);
      if (retR.status === "fulfilled") setRet(retR.value);
      if (plR.status === "fulfilled") setPl(plR.value);
      if (cal.status === "rejected" && exec.status === "rejected") {
        errorToast("No se pudo cargar el panel.");
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [rango]); // eslint-disable-line react-hooks/exhaustive-deps

  const proximos = calendar?.vencimientos ?? [];
  const urgentes = proximos.filter(
    (v) => v.estado === "vencido" || v.estado === "critico" || v.estado === "por_vencer"
  );

  const plUlt = pl.slice(-6);
  const plChartGroups = plUlt.map((p) => ({
    label: periodoLabel(p.year, p.month),
    series: [
      { label: "Ingresos", value: p.ingresos, color: TEAL },
      { label: "Costos+Gastos", value: p.costo + p.gastoOperativo, color: "#ef4444" },
    ],
  }));

  const ivaSerie = (iva?.porPeriodo ?? []).slice(-6);
  const ivaChartGroups = ivaSerie.map((p) => ({
    label: p.periodo,
    series: [
      { label: "Generado", value: p.generado, color: TEAL },
      { label: "Descontable", value: p.descontable, color: "#f59e0b" },
    ],
  }));

  const liq = resumen ?? { caja: 0, cxc: 0, cxp: 0 };

  return (
    <DsModuleScreen
      title={firstName ? `Hola, ${firstName}` : "Panel"}
      subtitle="Este es el estado de tu empresa hoy."
      loading={loading && !resumen}
      refreshing={refreshing}
      onRefresh={() => {
        setRefreshing(true);
        void load(true);
      }}
      headerActions={
        <DsButton label="Nueva factura" icon="add" compact onPress={() => navigate(PATHS.DASHBOARD_BILLING)} />
      }
    >
      <Pressable
        style={[styles.cta, { backgroundColor: colors.headerAccent }]}
        onPress={() => navigate(PATHS.DASHBOARD_BILLING)}
      >
        <Ionicons name="add-circle-outline" size={20} color="#fff" />
        <Text style={styles.ctaText}>Nueva factura</Text>
      </Pressable>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.periodRow}>
        {PERIOD_PRESETS.map((p) => (
          <Pressable
            key={p.k}
            onPress={() => setPeriodo(p.k)}
            style={[
              styles.periodChip,
              {
                borderColor: colors.border,
                backgroundColor: periodo === p.k ? colors.headerAccent : colors.cardBg,
              },
            ]}
          >
            <Text style={{ color: periodo === p.k ? "#fff" : colors.primaryText, fontWeight: "600", fontSize: 13 }}>
              {p.l}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {loading && !resumen ? (
        <ActivityIndicator style={{ marginVertical: 24 }} color={colors.headerAccent} />
      ) : (
        <View style={styles.kpiGrid}>
          <AnalyticsKpiNative label="Caja y bancos" value={money(resumen?.caja ?? 0)} icon="wallet-outline" accent={TEAL} />
          <AnalyticsKpiNative label="Por cobrar" value={money(resumen?.cxc ?? 0)} icon="arrow-down-circle-outline" accent="#16a34a" />
          <AnalyticsKpiNative label="Por pagar" value={money(resumen?.cxp ?? 0)} icon="arrow-up-circle-outline" accent="#ea580c" />
          <AnalyticsKpiNative
            label={iva?.signo === "favor" ? "IVA a favor" : "IVA por pagar"}
            value={money(Math.abs(iva?.saldo ?? 0))}
            icon="pie-chart-outline"
            accent={iva?.signo === "favor" ? TEAL : "#dc2626"}
          />
          <AnalyticsKpiNative
            label={`Utilidad neta (${periodoLabelText})`}
            value={money(resumen?.utilidadNeta ?? 0)}
            icon="trending-up-outline"
            accent={(resumen?.utilidadNeta ?? 0) >= 0 ? TEAL : "#dc2626"}
            negative={(resumen?.utilidadNeta ?? 0) < 0}
          />
        </View>
      )}

      <View style={styles.sectionHead}>
        <Ionicons name="calendar-outline" size={18} color={colors.headerAccent} />
        <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Próximos vencimientos DIAN</Text>
      </View>
      {calendar ? (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          IVA {calendar.periodicidad_iva} · NIT termina en {calendar.digito_nit}
          {calendar.meta.autodetectado ? " (autodetectado)" : ""}
        </Text>
      ) : null}

      {proximos.length === 0 ? (
        <Text style={[styles.empty, { color: colors.textMuted }]}>
          No hay obligaciones próximas. Configura tu perfil tributario en Configuración.
        </Text>
      ) : (
        proximos.slice(0, 5).map((v, i) => {
          const accent = ESTADO_COLORS[v.estado];
          const diasLabel =
            v.dias_restantes < 0
              ? `Hace ${Math.abs(v.dias_restantes)} día(s)`
              : v.dias_restantes === 0
                ? "¡Vence hoy!"
                : `En ${v.dias_restantes} día(s)`;
          const fechaCorta = new Date(`${v.fecha_limite}T00:00:00`).toLocaleDateString("es-CO", {
            day: "numeric",
            month: "short",
          });
          return (
            <View
              key={`${v.obligacion}-${i}`}
              style={[
                styles.deadlineCard,
                getSoftCardShadow(colors),
                { backgroundColor: colors.cardBg, borderColor: colors.border, borderLeftColor: accent, borderLeftWidth: 4 },
              ]}
            >
              <View style={styles.deadlineHead}>
                <Text style={[styles.deadlineTitle, { color: colors.primaryText, flex: 1 }]}>{v.obligacion_label}</Text>
                <Text style={[styles.badge, { color: accent, backgroundColor: `${accent}18` }]}>
                  {ESTADO_LABELS[v.estado]}
                </Text>
              </View>
              <Text style={[styles.deadlineMeta, { color: colors.textMuted }]}>{v.periodo_label}</Text>
              <View style={styles.deadlineFoot}>
                <Text style={{ color: accent, fontWeight: "700", fontSize: 12 }}>{diasLabel}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>{fechaCorta}</Text>
              </View>
            </View>
          );
        })
      )}

      {urgentes.length > 0 ? (
        <View style={[styles.alertBox, { backgroundColor: "#fef3c7", borderColor: "#fcd34d" }]}>
          <Ionicons name="warning-outline" size={18} color="#b45309" />
          <Text style={styles.alertText}>
            Tienes <Text style={{ fontWeight: "700" }}>{urgentes.length}</Text> obligación(es) próxima(s) a vencer.
          </Text>
        </View>
      ) : null}

      <AnalyticsSectionNative title="Ingresos vs. costos y gastos">
        <SimpleGroupedBarChart
          groups={plChartGroups}
          formatValue={(n) => money(n).replace(/\s/g, "")}
          emptyLabel="Sin histórico suficiente todavía."
        />
        <ChartLegend
          items={[
            { label: "Ingresos", color: TEAL },
            { label: "Costos + gastos", color: "#ef4444" },
          ]}
        />
      </AnalyticsSectionNative>

      <AnalyticsSectionNative title="Liquidez">
        <SimpleStackedBarChart
          segments={[
            { label: "Bancos", value: liq.caja, color: TEAL },
            { label: "Por cobrar", value: liq.cxc, color: "#a3d5e0" },
            { label: "Por pagar", value: liq.cxp, color: "#fbbf24" },
          ]}
          formatValue={(n) => money(n).replace(/\s/g, "")}
          emptyLabel="Sin datos de liquidez."
        />
        <Pressable onPress={() => navigate(PATHS.TREASURY_CARTERA)} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: colors.headerAccent }]}>Ver cartera →</Text>
        </Pressable>
      </AnalyticsSectionNative>

      <AnalyticsSectionNative
        title={periodo === "dia" ? "Impuestos de hoy" : `Impuestos del ${periodoLabelText}`}
      >
        <AnalyticsRow left="IVA generado" right={money(iva?.generado ?? 0)} />
        <AnalyticsRow left="IVA descontable" right={money(iva?.descontable ?? 0)} />
        <AnalyticsRow
          left={iva?.signo === "favor" ? "Saldo a favor" : "IVA por pagar"}
          right={money(Math.abs(iva?.saldo ?? 0))}
        />
        <AnalyticsRow left="Retenciones practicadas" right={money(ret?.totalPracticadas ?? 0)} />
        <AnalyticsRow left="Retenciones sufridas" right={money(ret?.totalSufridas ?? 0)} muted />
        <Pressable onPress={() => navigate(PATHS.ANALYTICS)} style={styles.linkBtn}>
          <Text style={[styles.linkText, { color: colors.headerAccent }]}>Ver estadísticas →</Text>
        </Pressable>
      </AnalyticsSectionNative>

      <AnalyticsSectionNative title="IVA generado vs. descontable">
        <SimpleGroupedBarChart
          groups={ivaChartGroups}
          formatValue={(n) => money(n).replace(/\s/g, "")}
          emptyLabel="Sin movimientos de IVA en el periodo."
        />
        <ChartLegend
          items={[
            { label: "IVA generado", color: TEAL },
            { label: "IVA descontable", color: "#f59e0b" },
          ]}
        />
      </AnalyticsSectionNative>

      <Text style={[styles.sectionTitle, { color: colors.primaryText, marginTop: 8 }]}>Accesos rápidos</Text>
      <View style={styles.quickGrid}>
        {QUICK_LINKS.map((link) => (
          <Pressable
            key={link.path}
            onPress={() => navigate(link.path)}
            style={[styles.quickTile, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}
          >
            <Ionicons name={link.icon} size={20} color={colors.headerAccent} />
            <Text style={[styles.quickLabel, { color: colors.primaryText }]}>{link.label}</Text>
          </Pressable>
        ))}
      </View>
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 12,
    paddingVertical: 14,
    borderRadius: SHELL_RADIUS.button,
  },
  ctaText: { color: "#fff", fontWeight: "700", fontSize: 16 },
  periodRow: { paddingVertical: 4, gap: 8, marginBottom: 8 },
  periodChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, borderWidth: 1, marginRight: 8 },
  kpiGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: "700" },
  hint: { fontSize: 12, marginTop: 4, marginBottom: 8 },
  empty: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  deadlineCard: { marginBottom: 8, borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12 },
  deadlineHead: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  deadlineTitle: { fontSize: 14, fontWeight: "700" },
  badge: { fontSize: 10, fontWeight: "700", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12, overflow: "hidden" },
  deadlineMeta: { fontSize: 12, marginTop: 4 },
  deadlineFoot: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  alertBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: SHELL_RADIUS.card,
    borderWidth: 1,
    marginBottom: 12,
  },
  alertText: { flex: 1, fontSize: 13, color: "#92400e", lineHeight: 18 },
  linkBtn: { marginTop: 8, alignSelf: "flex-start" },
  linkText: { fontSize: 13, fontWeight: "600" },
  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  quickTile: {
    width: "47%",
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
    gap: 8,
  },
  quickLabel: { fontWeight: "600", fontSize: 14 },
});

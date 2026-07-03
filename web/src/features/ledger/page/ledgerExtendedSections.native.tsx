import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import {
  DateRangeBar,
  LedgerCard,
  LedgerChip,
  LedgerEmpty,
  LedgerField,
  LedgerLoading,
  LedgerPrimaryBtn,
  LedgerRow,
  LedgerSectionHeader,
  LedgerStatusBadge,
} from "../../../components/native/ledger/LedgerUi.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { getIcaPorMunicipio, type IcaMunicipioResponse } from "../dian.service";
import { amortizeDeferrals, provisionMonthly, exchangeRevaluation } from "../ledger.service";
import { money, today } from "../ledger.shared";
import { getThirdParty, type ThirdPartyRow } from "../reports.service";
import {
  getBudget,
  getBudgetExecution,
  getConciliacionFiscal,
  getNotes,
  seedNotes,
  type BudgetLine,
  type ConciliacionFiscalPartida,
  type FinancialNote,
} from "../budget.service";

const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

export function ThirdPartySectionNative() {
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [rows, setRows] = useState<ThirdPartyRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getThirdParty(desde, hasta);
      setRows(r.rows);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar auxiliar");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Auxiliar por tercero" subtitle="Movimientos agrupados por tercero y cuenta." />
      <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
      <LedgerPrimaryBtn label="Consultar" onPress={load} disabled={loading} loading={loading} />
      {loading ? <LedgerLoading /> : rows.length === 0 ? (
        <LedgerEmpty text="Sin movimientos en el rango." />
      ) : (
        rows.map((r, i) => (
          <LedgerRow
            key={`${r.tercero}-${r.cuenta}-${i}`}
            cells={[
              { label: "Tercero", value: r.tercero },
              { label: "Cuenta", value: r.cuenta },
              { label: "Saldo", value: money(r.saldo), align: "right", bold: true },
            ]}
          />
        ))
      )}
    </ScrollView>
  );
}

export function AdjustmentsSectionNative() {
  const [periodo, setPeriodo] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [busy, setBusy] = useState(false);

  const run = async (kind: "diferidos" | "provisiones" | "cambio") => {
    setBusy(true);
    try {
      if (kind === "diferidos") {
        const r = await amortizeDeferrals({ periodo, items: [] });
        successToast(r.message || "Diferidos procesados");
      } else if (kind === "provisiones") {
        const r = await provisionMonthly({ periodo, items: [] });
        successToast(r.message || "Provisiones procesadas");
      } else {
        const r = await exchangeRevaluation({ periodo, cuenta_ingreso_dif: "421505", cuenta_gasto_dif: "530520", items: [] });
        successToast(r.message || "Revaluación procesada");
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error en ajuste");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Ajustes contables" subtitle="Diferidos, provisiones y diferencia en cambio." />
      <LedgerField label="Período (YYYY-MM)" value={periodo} onChangeText={setPeriodo} placeholder="2026-06" />
      <View style={{ gap: 10, marginTop: 12 }}>
        <LedgerPrimaryBtn label="Amortizar diferidos (vacío)" onPress={() => run("diferidos")} disabled={busy} loading={busy} />
        <LedgerPrimaryBtn label="Provisiones mensuales (vacío)" variant="secondary" onPress={() => run("provisiones")} disabled={busy} />
        <LedgerPrimaryBtn label="Revaluación cambio (vacío)" variant="secondary" onPress={() => run("cambio")} disabled={busy} />
      </View>
      <Text style={{ marginTop: 16, fontSize: 13, opacity: 0.7 }}>
        Para ajustes detallados con líneas personalizadas, usa la versión web en el mismo período.
      </Text>
    </ScrollView>
  );
}

export function IcaSectionNative() {
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [data, setData] = useState<IcaMunicipioResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getIcaPorMunicipio(Number(anio)));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="ReteICA por municipio" subtitle="Retención practicada agrupada por municipio." />
      <LedgerField label="Año" value={anio} onChangeText={setAnio} keyboardType="numeric" />
      <LedgerPrimaryBtn label="Consultar" onPress={load} disabled={loading} loading={loading} />
      {loading ? null : !data?.municipios?.length ? (
        <LedgerEmpty text={`Sin ReteICA en ${anio}.`} />
      ) : (
        data.municipios.map((m) => (
          <LedgerCard key={m.codigo_municipio}>
            <Text style={{ fontWeight: "700" }}>{m.municipio}</Text>
            <Text>{money(m.total)} · {m.terceros} tercero(s)</Text>
          </LedgerCard>
        ))
      )}
    </ScrollView>
  );
}

export function BudgetSectionNative() {
  const [anio, setAnio] = useState(String(new Date().getFullYear()));
  const [lines, setLines] = useState<BudgetLine[]>([]);
  const [loading, setLoading] = useState(false);
  const [execTotal, setExecTotal] = useState<{ presupuestado: number; ejecutado: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const y = Number(anio);
      const [l, ex] = await Promise.all([
        getBudget(y, "base"),
        getBudgetExecution(y, "base").catch(() => null),
      ]);
      setLines(l);
      setExecTotal(ex?.totales ?? null);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar presupuesto");
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => { void load(); }, [load]);

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Presupuesto" subtitle="Líneas por cuenta (escenario base)." />
      <LedgerField label="Año" value={anio} onChangeText={setAnio} keyboardType="numeric" />
      <LedgerPrimaryBtn label="Cargar" onPress={load} disabled={loading} loading={loading} />
      {execTotal ? (
        <LedgerCard>
          <Text>Presupuestado: {money(execTotal.presupuestado)}</Text>
          <Text>Ejecutado: {money(execTotal.ejecutado)}</Text>
        </LedgerCard>
      ) : null}
      {loading ? null : lines.length === 0 ? (
        <LedgerEmpty text="Sin líneas de presupuesto." />
      ) : (
        lines.map((l) => (
          <LedgerRow key={l._id} cells={[{ value: l.cuenta, bold: true }, { value: money(l.meses.reduce((a, b) => a + b, 0)), align: "right" }]} />
        ))
      )}
    </ScrollView>
  );
}

export function NotesSectionNative() {
  const [corte, setCorte] = useState(`${new Date().getFullYear()}-12-31`);
  const [notes, setNotes] = useState<FinancialNote[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setNotes(await getNotes(corte.trim()));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [corte]);

  useEffect(() => { void load(); }, [load]);

  const onSeed = () => {
    Alert.alert("Sembrar notas", "¿Crear plantilla de notas a los EEFF?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Sembrar",
        onPress: async () => {
          try {
            const r = await seedNotes(corte.trim());
            successToast(r.message || "Notas sembradas");
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Notas a los EEFF" subtitle="Notas explicativas al corte." />
      <LedgerField label="Corte (YYYY-MM-DD)" value={corte} onChangeText={setCorte} />
      <View style={{ flexDirection: "row", gap: 8, marginVertical: 10 }}>
        <LedgerPrimaryBtn label="Cargar" onPress={load} disabled={loading} />
        <LedgerPrimaryBtn label="Sembrar plantilla" variant="secondary" onPress={onSeed} />
      </View>
      {loading ? <LedgerLoading /> : notes.length === 0 ? (
        <LedgerEmpty text="Sin notas para este corte." />
      ) : (
        notes.map((n) => (
          <LedgerCard key={n._id}>
            <Text style={{ fontWeight: "700" }}>{n.numero}. {n.titulo}</Text>
            <Text numberOfLines={4}>{n.contenido}</Text>
          </LedgerCard>
        ))
      )}
    </ScrollView>
  );
}

export function FiscalSectionNative() {
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [partidas, setPartidas] = useState<ConciliacionFiscalPartida[]>([]);
  const [nota, setNota] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await getConciliacionFiscal(desde, hasta);
      setPartidas(r.partidas);
      setNota(r.resumen?.nota ?? "");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Conciliación fiscal" subtitle="Partidas fiscales vs contabilidad." />
      <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
      <LedgerPrimaryBtn label="Consultar" onPress={load} disabled={loading} loading={loading} />
      {loading ? <LedgerLoading /> : partidas.length === 0 ? (
        <LedgerEmpty text="Sin partidas en el rango." />
      ) : (
        <>
          {nota ? <Text style={{ marginBottom: 8, fontSize: 13 }}>{nota}</Text> : null}
          {partidas.map((p) => (
            <LedgerRow
              key={p.cuenta}
              cells={[
                { value: `${p.cuenta} · ${p.nombre}`, bold: true },
                { value: money(p.saldo_contable), align: "right" },
              ]}
            />
          ))}
        </>
      )}
    </ScrollView>
  );
}

export function IntegritySectionNative() {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [problemas, setProblemas] = useState(0);
  const [checks, setChecks] = useState<{ label: string; ok: boolean; detalle?: string }[]>([]);

  useEffect(() => {
    import("../reports.service")
      .then(({ getIntegrity }) => getIntegrity())
      .then((d) => {
        setProblemas(d.problemas);
        setChecks(
          d.checks.map((c) => ({
            label: c.label,
            ok: c.sin_asiento === 0,
            detalle: c.sin_asiento > 0 ? `${c.sin_asiento} sin asiento` : undefined,
          })),
        );
      })
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LedgerLoading />;

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <LedgerSectionHeader title="Salud contable" subtitle={`${problemas} problema(s) detectado(s)`} />
      {checks.map((c, i) => (
        <View key={i} style={{ marginBottom: 12 }}>
          <LedgerStatusBadge label={c.label} tone={c.ok ? "ok" : "bad"} />
          {c.detalle ? <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }}>{c.detalle}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

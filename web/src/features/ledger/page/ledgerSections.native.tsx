import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, ScrollView, Text, View } from "react-native";
import EntryEditorModalNative from "../../../components/native/ledger/EntryEditorModal.native";
import {
  DateRangeBar,
  LedgerCard,
  LedgerChip,
  LedgerChipRow,
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
import {
  getRetentionParties,
  getExogena,
  getExogenaValidacion,
  type RetentionParty,
  type ExogenaValidacionRow,
} from "../dian.service";
import { downloadExogenaXmlNative, downloadRetentionCertificateNative } from "../dianDownload.native";
import {
  annulEntry,
  createOpening,
  getClosingStatus,
  closeYear,
  reopenYear,
  getEntries,
  getJournalBook,
  getOpeningStatus,
  getPeriods,
  postEntry,
  setPeriod,
  type OpeningLine,
} from "../ledger.service";
import {
  fdate,
  lastYearEnd,
  money,
  moneyPlain,
  round2,
  thisYear,
  today,
  yStart,
} from "../ledger.shared";
import {
  getAccountDetail,
  getFinancialStatements,
  getGeneralLedger,
  getTrialBalance,
  type AccountDetailRow,
  type FinancialLine,
} from "../reports.service";
import {
  JOURNAL_STATUS_LABELS,
  JOURNAL_TYPE_LABELS,
  type JournalEntry,
  type JournalType,
  type AccountingPeriod,
} from "../ledger.types";

const TYPE_FILTER: JournalType[] = ["NC", "CC", "CE", "RC", "FV", "DEP"];
const monthStart = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

function FinancialBlock({
  title,
  lines,
  total,
  totalLabel,
}: {
  title: string;
  lines: FinancialLine[];
  total: number;
  totalLabel: string;
}) {
  const colors = useThemeColors();
  return (
    <LedgerCard>
      <Text style={{ fontWeight: "700", color: colors.primary, marginBottom: 8 }}>{title}</Text>
      {lines.length === 0 ? (
        <LedgerEmpty text="Sin movimientos" />
      ) : (
        lines.map((l) => (
          <LedgerRow
            key={l.grupo}
            cells={[
              { value: `${l.grupo} — ${l.nombre}`, bold: false },
              { value: money(l.saldo), align: "right", bold: true },
            ]}
          />
        ))
      )}
      <LedgerRow
        cells={[
          { value: totalLabel, bold: true },
          { value: money(total), align: "right", bold: true },
        ]}
      />
    </LedgerCard>
  );
}

export function ComprobantesSectionNative() {
  const colors = useThemeColors();
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tipo, setTipo] = useState("");
  const [estado, setEstado] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getEntries({ tipo, estado, page: 1 });
      setEntries(res.entries);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar comprobantes");
    } finally {
      setLoading(false);
    }
  }, [tipo, estado, refreshKey]);

  useEffect(() => {
    load();
  }, [load]);

  const onPost = async (e: JournalEntry) => {
    setBusyId(e._id);
    try {
      await postEntry(e._id);
      successToast("Comprobante contabilizado");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      errorToast(err instanceof Error ? err.message : "Error");
    } finally {
      setBusyId(null);
    }
  };

  const onAnnul = (e: JournalEntry) => {
    Alert.alert(
      "Anular comprobante",
      `¿Anular ${e.tipo}-${e.consecutivo}? Si está contabilizado se generará un reverso.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Anular",
          style: "destructive",
          onPress: async () => {
            setBusyId(e._id);
            try {
              const res = await annulEntry(e._id);
              successToast(res.message || "Comprobante anulado");
              setRefreshKey((k) => k + 1);
            } catch (err) {
              errorToast(err instanceof Error ? err.message : "Error");
            } finally {
              setBusyId(null);
            }
          },
        },
      ]
    );
  };

  const statusTone = (s: string) =>
    s === "contabilizado" ? "ok" : s === "borrador" ? "warn" : "bad";

  return (
    <>
      <LedgerCard>
        <LedgerSectionHeader
          title="Comprobantes"
          subtitle="Asientos contables. Crea notas manuales y contabilízalas."
          action={
            <LedgerPrimaryBtn
              label="Nuevo"
              icon="add"
              onPress={() => {
                setEditId(null);
                setEditorOpen(true);
              }}
            />
          }
        />
        <LedgerChipRow>
          <LedgerChip label="Todos los tipos" active={!tipo} onPress={() => setTipo("")} />
          {TYPE_FILTER.map((t) => (
            <LedgerChip
              key={t}
              label={JOURNAL_TYPE_LABELS[t]}
              active={tipo === t}
              onPress={() => setTipo(tipo === t ? "" : t)}
            />
          ))}
        </LedgerChipRow>
        <LedgerChipRow>
          {["", "borrador", "contabilizado", "anulado"].map((s) => (
            <LedgerChip
              key={s || "all"}
              label={s ? JOURNAL_STATUS_LABELS[s as keyof typeof JOURNAL_STATUS_LABELS] : "Todos"}
              active={estado === s}
              onPress={() => setEstado(estado === s ? "" : s)}
            />
          ))}
        </LedgerChipRow>
        {loading ? (
          <LedgerLoading />
        ) : entries.length === 0 ? (
          <LedgerEmpty text="No hay comprobantes." />
        ) : (
          entries.map((e) => (
            <View key={e._id} style={{ marginBottom: 14 }}>
              <LedgerRow
                cells={[
                  { label: "Comprobante", value: `${e.tipo}-${e.consecutivo}`, bold: true },
                  { label: "Fecha", value: fdate(e.fecha) },
                  { label: "Valor", value: money(e.total_debito), align: "right" },
                ]}
              />
              <Text style={{ fontSize: 13, marginBottom: 8, color: colors.textMuted }}>{e.descripcion || "—"}</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                <LedgerStatusBadge label={JOURNAL_STATUS_LABELS[e.estado]} tone={statusTone(e.estado)} />
                {e.estado === "borrador" ? (
                  <>
                    <LedgerPrimaryBtn
                      label="Editar"
                      variant="secondary"
                      onPress={() => {
                        setEditId(e._id);
                        setEditorOpen(true);
                      }}
                      disabled={busyId === e._id}
                    />
                    <LedgerPrimaryBtn
                      label="Contabilizar"
                      onPress={() => onPost(e)}
                      loading={busyId === e._id}
                      disabled={busyId === e._id}
                    />
                  </>
                ) : null}
                {e.estado !== "anulado" ? (
                  <LedgerPrimaryBtn
                    label="Anular"
                    variant="danger"
                    onPress={() => onAnnul(e)}
                    disabled={busyId === e._id}
                  />
                ) : null}
              </View>
            </View>
          ))
        )}
      </LedgerCard>
      <EntryEditorModalNative
        visible={editorOpen}
        entryId={editId}
        onClose={() => setEditorOpen(false)}
        onSaved={() => {
          setEditorOpen(false);
          setRefreshKey((k) => k + 1);
        }}
      />
    </>
  );
}

export function DiarioSectionNative() {
  const colors = useThemeColors();
  const [desde, setDesde] = useState(monthStart());
  const [hasta, setHasta] = useState(today());
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [totals, setTotals] = useState({ d: 0, c: 0 });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getJournalBook(desde, hasta);
      setEntries(res.entries);
      setTotals({ d: res.totalDebito, c: res.totalCredito });
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <LedgerCard>
      <LedgerSectionHeader title="Libro diario" subtitle="Comprobantes contabilizados en orden cronológico." />
      <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
      <Text style={{ marginBottom: 8 }}>
        Débitos: {moneyPlain(totals.d)} · Créditos: {moneyPlain(totals.c)}{" "}
        {totals.d === totals.c ? "✓" : "✗"}
      </Text>
      {loading ? (
        <LedgerLoading />
      ) : entries.length === 0 ? (
        <LedgerEmpty text="No hay comprobantes en el rango." />
      ) : (
        entries.map((e) => (
          <View key={e._id} style={{ marginBottom: 14 }}>
            <LedgerRow
              cells={[
                { label: "Comp.", value: `${e.tipo}-${e.consecutivo}`, bold: true },
                { label: "Fecha", value: fdate(e.fecha) },
                { label: "Total", value: money(e.total_debito), align: "right" },
              ]}
            />
            <Text style={{ fontSize: 12, marginBottom: 6, color: colors.textMuted }}>{e.descripcion}</Text>
            {(e.lineas ?? []).map((l, i) => (
              <LedgerRow
                key={i}
                cells={[
                  { value: l.cuenta, bold: true },
                  { value: l.descripcion || "", bold: false },
                  { value: l.debito ? moneyPlain(l.debito) : l.credito ? moneyPlain(l.credito) : "", align: "right" },
                ]}
              />
            ))}
          </View>
        ))
      )}
    </LedgerCard>
  );
}

export function MayorSectionNative() {
  const [desde, setDesde] = useState(yStart());
  const [hasta, setHasta] = useState(today());
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getGeneralLedger>>["rows"]>([]);
  const [detail, setDetail] = useState<{ cuenta: string; rows: AccountDetailRow[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getGeneralLedger(desde, hasta);
      setRows(res.rows);
      setDetail(null);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (cuenta: string) => {
    setDetailLoading(true);
    try {
      const res = await getAccountDetail(cuenta, desde, hasta);
      setDetail({ cuenta, rows: res.rows });
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <ScrollView>
      <LedgerCard>
        <LedgerSectionHeader
          title="Libro mayor y balances"
          subtitle="Saldo inicial, movimientos y saldo final por cuenta."
        />
        <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
        {loading ? (
          <LedgerLoading />
        ) : rows.length === 0 ? (
          <LedgerEmpty text="No hay movimientos en el rango." />
        ) : (
          rows.map((r) => (
            <LedgerRow
              key={r.cuenta}
              onPress={() => openDetail(r.cuenta)}
              cells={[
                { label: "Cuenta", value: `${r.cuenta} — ${r.nombre}`, bold: true },
                { label: "Saldo final", value: moneyPlain(r.saldo_final), align: "right", bold: true },
              ]}
            />
          ))
        )}
      </LedgerCard>
      {detail ? (
        <LedgerCard>
          <LedgerSectionHeader
            title={`Auxiliar — ${detail.cuenta}`}
            action={<LedgerPrimaryBtn label="Cerrar" variant="secondary" onPress={() => setDetail(null)} />}
          />
          {detailLoading ? (
            <LedgerLoading />
          ) : detail.rows.length === 0 ? (
            <LedgerEmpty text="Sin movimientos." />
          ) : (
            detail.rows.map((m, i) => (
              <LedgerRow
                key={i}
                cells={[
                  { label: "Fecha", value: fdate(m.fecha) },
                  { label: "Comp.", value: `${m.tipo}-${m.consecutivo}` },
                  { label: "D/C", value: m.debito ? moneyPlain(m.debito) : moneyPlain(m.credito), align: "right" },
                ]}
              />
            ))
          )}
        </LedgerCard>
      ) : null}
    </ScrollView>
  );
}

export function BalanceSectionNative() {
  const [desde, setDesde] = useState(yStart());
  const [hasta, setHasta] = useState(today());
  const [rows, setRows] = useState<Awaited<ReturnType<typeof getTrialBalance>>["rows"]>([]);
  const [totals, setTotals] = useState({ d: 0, c: 0, cuadra: true });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTrialBalance(desde, hasta);
      setRows(res.rows);
      setTotals({ d: res.totalDebitos, c: res.totalCreditos, cuadra: res.cuadra });
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <LedgerCard>
      <LedgerSectionHeader title="Balance de prueba" subtitle="Débitos, créditos y saldo por cuenta." />
      <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
      <Text style={{ marginBottom: 8 }}>
        Débitos: {moneyPlain(totals.d)} · Créditos: {moneyPlain(totals.c)} ·{" "}
        {totals.cuadra ? "✓ Cuadra" : "✗ Descuadrado"}
      </Text>
      {loading ? (
        <LedgerLoading />
      ) : rows.length === 0 ? (
        <LedgerEmpty text="No hay movimientos en el rango." />
      ) : (
        rows.map((r) => (
          <LedgerRow
            key={r.cuenta}
            cells={[
              { value: `${r.cuenta} — ${r.nombre}`, bold: true },
              { label: "D", value: r.debitos ? moneyPlain(r.debitos) : "—", align: "right" },
              { label: "C", value: r.creditos ? moneyPlain(r.creditos) : "—", align: "right" },
              { label: "Saldo", value: moneyPlain(r.saldo), align: "right", bold: true },
            ]}
          />
        ))
      )}
    </LedgerCard>
  );
}

export function EstadosSectionNative() {
  const [desde, setDesde] = useState(yStart());
  const [hasta, setHasta] = useState(today());
  const [data, setData] = useState<Awaited<ReturnType<typeof getFinancialStatements>> | null>(null);
  const [loading, setLoading] = useState(true);
  const colors = useThemeColors();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await getFinancialStatements(desde, hasta));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [desde, hasta]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <LedgerCard>
        <LedgerLoading />
      </LedgerCard>
    );
  }
  if (!data) return null;

  const bg = data.balance_general;
  const er = data.estado_resultados;

  return (
    <ScrollView>
      <LedgerCard>
        <LedgerSectionHeader title="Estados financieros" subtitle="Balance general y estado de resultados." />
        <DateRangeBar desde={desde} hasta={hasta} onDesde={setDesde} onHasta={setHasta} />
      </LedgerCard>
      <Text style={{ fontWeight: "700", fontSize: 15, marginBottom: 8, color: colors.primary }}>
        Balance general
      </Text>
      <FinancialBlock title="Activos" lines={bg.activos} total={bg.total_activos} totalLabel="Total activos" />
      <FinancialBlock title="Pasivos" lines={bg.pasivos} total={bg.total_pasivos} totalLabel="Total pasivos" />
      <FinancialBlock
        title="Patrimonio"
        lines={bg.patrimonio}
        total={bg.total_patrimonio}
        totalLabel="Total patrimonio"
      />
      <LedgerCard>
        <LedgerRow
          cells={[
            { value: "Resultado del ejercicio", bold: true },
            { value: money(bg.utilidad_ejercicio), align: "right", bold: true },
          ]}
        />
      </LedgerCard>
      <Text style={{ fontWeight: "700", fontSize: 15, marginVertical: 8, color: colors.primary }}>
        Estado de resultados
      </Text>
      <FinancialBlock title="Ingresos" lines={er.ingresos} total={er.total_ingresos} totalLabel="Total ingresos" />
      <FinancialBlock title="Gastos y costos" lines={er.gastos} total={er.total_gastos} totalLabel="Total gastos" />
      <LedgerCard>
        <LedgerRow
          cells={[
            { value: er.utilidad >= 0 ? "Utilidad del ejercicio" : "Pérdida del ejercicio", bold: true },
            { value: money(er.utilidad), align: "right", bold: true },
          ]}
        />
      </LedgerCard>
    </ScrollView>
  );
}

let saldoKey = 1;
interface SaldoRow extends OpeningLine {
  _k: number;
  tercero_nombre?: string;
}
const blankSaldo = (): SaldoRow => ({ _k: saldoKey++, cuenta: "", tercero_nombre: "", referencia: "", debito: 0, credito: 0 });

export function SaldosSectionNative() {
  const [exists, setExists] = useState(false);
  const [loading, setLoading] = useState(true);
  const [fecha, setFecha] = useState(lastYearEnd());
  const [rows, setRows] = useState<SaldoRow[]>([blankSaldo(), blankSaldo()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const st = await getOpeningStatus();
        setExists(st.exists);
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "Error");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const d = round2(rows.reduce((a, r) => a + (Number(r.debito) || 0), 0));
    const c = round2(rows.reduce((a, r) => a + (Number(r.credito) || 0), 0));
    return { d, c, diff: round2(d - c) };
  }, [rows]);
  const balanced = totals.diff === 0 && totals.d > 0;

  const setRow = (key: number, patch: Partial<SaldoRow>) =>
    setRows((p) => p.map((r) => (r._k === key ? { ...r, ...patch } : r)));

  const save = async () => {
    if (!balanced) {
      errorToast("Los saldos deben cuadrar (débitos = créditos)");
      return;
    }
    const lineas: OpeningLine[] = rows
      .filter((r) => r.cuenta.trim() && ((Number(r.debito) || 0) > 0 || (Number(r.credito) || 0) > 0))
      .map((r) => ({
        cuenta: r.cuenta.trim(),
        tercero_nombre: r.tercero_nombre || undefined,
        referencia: r.referencia || undefined,
        debito: Number(r.debito) || 0,
        credito: Number(r.credito) || 0,
      }));
    setSaving(true);
    try {
      const res = await createOpening({ fecha, descripcion: `Saldos iniciales — corte ${fecha}`, lineas });
      successToast(res.message);
      setExists(true);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <LedgerCard>
        <LedgerLoading />
      </LedgerCard>
    );
  }

  return (
    <ScrollView>
      <LedgerCard>
        <LedgerSectionHeader
          title="Saldos iniciales"
          subtitle="Comprobante de apertura con el saldo de corte."
        />
        {exists ? (
          <LedgerStatusBadge label="Ya existe un comprobante de apertura" tone="ok" />
        ) : null}
        <LedgerField label="Fecha corte (YYYY-MM-DD)" value={fecha} onChangeText={setFecha} />
        {rows.map((r) => (
          <View key={r._k} style={{ marginBottom: 10 }}>
            <LedgerField label="Cuenta" value={r.cuenta} onChangeText={(v) => setRow(r._k, { cuenta: v })} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <LedgerField
                label="Débito"
                value={String(r.debito || "")}
                onChangeText={(v) => setRow(r._k, { debito: Number(v) || 0 })}
                keyboardType="numeric"
              />
              <LedgerField
                label="Crédito"
                value={String(r.credito || "")}
                onChangeText={(v) => setRow(r._k, { credito: Number(v) || 0 })}
                keyboardType="numeric"
              />
            </View>
          </View>
        ))}
        <LedgerPrimaryBtn label="+ Fila" variant="secondary" onPress={() => setRows((p) => [...p, blankSaldo()])} />
        <Text style={{ marginVertical: 8 }}>
          Débitos: {moneyPlain(totals.d)} · Créditos: {moneyPlain(totals.c)} ·{" "}
          {balanced ? "✓ Cuadrado" : `Diff ${moneyPlain(totals.diff)}`}
        </Text>
        {!exists ? (
          <LedgerPrimaryBtn label="Guardar apertura" onPress={save} loading={saving} disabled={!balanced} />
        ) : null}
      </LedgerCard>
    </ScrollView>
  );
}

export function CierreSectionNative() {
  const [anio, setAnio] = useState(thisYear() - 1);
  const [status, setStatus] = useState<{ cerrado: boolean; borradores: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await getClosingStatus(anio);
      setStatus({ cerrado: s.cerrado, borradores: s.borradores });
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  const doClose = () => {
    Alert.alert("Cerrar año", `¿Cerrar el año ${anio}? Se sellan los 12 meses.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar",
        onPress: async () => {
          setBusy(true);
          try {
            const res = await closeYear(anio);
            successToast(res.message);
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cerrar");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const doReopen = () => {
    Alert.alert("Reabrir año", `¿Reabrir el año ${anio}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Reabrir",
        onPress: async () => {
          setBusy(true);
          try {
            const res = await reopenYear(anio);
            successToast(res.message);
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al reabrir");
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <LedgerCard>
      <LedgerSectionHeader title="Cierre anual" subtitle="Cancela cuentas de resultado y sella el año." />
      <LedgerField label="Año" value={String(anio)} onChangeText={(v) => setAnio(Number(v) || thisYear() - 1)} keyboardType="numeric" />
      {loading ? (
        <LedgerLoading />
      ) : !status ? null : status.cerrado ? (
        <>
          <LedgerStatusBadge label={`Año ${anio} cerrado`} tone="ok" />
          <View style={{ marginTop: 12 }}>
            <LedgerPrimaryBtn label={`Reabrir ${anio}`} variant="secondary" onPress={doReopen} loading={busy} />
          </View>
        </>
      ) : (
        <>
          {status.borradores > 0 ? (
            <LedgerStatusBadge label={`${status.borradores} borrador(es) pendientes`} tone="bad" />
          ) : (
            <LedgerStatusBadge label="Listo para cerrar" tone="ok" />
          )}
          <View style={{ marginTop: 12 }}>
            <LedgerPrimaryBtn
              label={`Cerrar año ${anio}`}
              onPress={doClose}
              loading={busy}
              disabled={status.borradores > 0}
            />
          </View>
        </>
      )}
    </LedgerCard>
  );
}

const PERIOD_LABEL: Record<string, string> = { abierto: "Abierto", cerrado: "Cerrado", bloqueado: "Bloqueado" };
const periodTone = (s: string) => (s === "abierto" ? "ok" : s === "cerrado" ? "warn" : "bad");

export function PeriodosSectionNative() {
  const [periods, setPeriods] = useState<AccountingPeriod[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState(new Date().toISOString().slice(0, 7));
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await getPeriods();
      setPeriods(res.periods);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const apply = async (p: string, estado: "abierto" | "cerrado" | "bloqueado") => {
    setBusy(true);
    try {
      await setPeriod(p, estado);
      successToast(`Período ${p} ${PERIOD_LABEL[estado].toLowerCase()}`);
      load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <LedgerCard>
      <LedgerSectionHeader title="Períodos contables" subtitle="Abre, cierra o bloquea meses." />
      <LedgerField label="Período (YYYY-MM)" value={periodo} onChangeText={setPeriodo} />
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
        <LedgerPrimaryBtn label="Cerrar" variant="secondary" onPress={() => apply(periodo, "cerrado")} disabled={busy} />
        <LedgerPrimaryBtn label="Abrir" onPress={() => apply(periodo, "abierto")} disabled={busy} />
      </View>
      {loading ? (
        <LedgerLoading />
      ) : periods.length === 0 ? (
        <LedgerEmpty text="Sin períodos registrados (meses abiertos por defecto)." />
      ) : (
        periods.map((p) => (
          <View key={p._id} style={{ marginBottom: 10 }}>
            <LedgerRow cells={[{ value: p.periodo, bold: true }]} />
            <LedgerStatusBadge label={PERIOD_LABEL[p.estado]} tone={periodTone(p.estado)} />
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
              {p.estado !== "abierto" ? (
                <LedgerPrimaryBtn label="Abrir" variant="secondary" onPress={() => apply(p.periodo, "abierto")} disabled={busy} />
              ) : null}
              {p.estado !== "cerrado" ? (
                <LedgerPrimaryBtn label="Cerrar" variant="secondary" onPress={() => apply(p.periodo, "cerrado")} disabled={busy} />
              ) : null}
              {p.estado !== "bloqueado" ? (
                <LedgerPrimaryBtn label="Bloquear" variant="secondary" onPress={() => apply(p.periodo, "bloqueado")} disabled={busy} />
              ) : null}
            </View>
          </View>
        ))
      )}
    </LedgerCard>
  );
}

export function DianExogenaSectionNative() {
  const [tab, setTab] = useState<"certificados" | "exogena">("certificados");
  const [anio, setAnio] = useState(thisYear());
  const [parties, setParties] = useState<RetentionParty[]>([]);
  const [exo, setExo] = useState<Awaited<ReturnType<typeof getExogena>> | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [validaciones, setValidaciones] = useState<ExogenaValidacionRow[] | null>(null);
  const [validando, setValidando] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "certificados") {
        const res = await getRetentionParties(anio);
        setParties(res.parties);
      } else {
        setValidaciones(null);
        setExo(await getExogena(anio));
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [tab, anio]);

  useEffect(() => {
    load();
  }, [load]);

  const onCert = async (tercero: string) => {
    setBusy(tercero);
    try {
      await downloadRetentionCertificateNative(anio, tercero);
      successToast("Certificado listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const exportXml = async (codigo: string) => {
    setBusy(codigo);
    try {
      await downloadExogenaXmlNative(anio, codigo);
      successToast("XML listo para compartir");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al generar XML");
    } finally {
      setBusy(null);
    }
  };

  const validar = async () => {
    setValidando(true);
    try {
      const res = await getExogenaValidacion(anio);
      setValidaciones(res.validaciones);
      const conAlerta = res.validaciones.filter((v) => !v.cuadra).length;
      if (conAlerta === 0) successToast("Todos los formatos cuadran ✓");
      else errorToast(`${conAlerta} formato(s) con alertas`);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al validar");
    } finally {
      setValidando(false);
    }
  };

  return (
    <ScrollView>
      <LedgerCard>
        <LedgerSectionHeader title="DIAN / Exógena" subtitle="Certificados de retención e información exógena." />
        <LedgerField label="Año" value={String(anio)} onChangeText={(v) => setAnio(Number(v) || thisYear())} keyboardType="numeric" />
        <LedgerChipRow>
          <LedgerChip label="Certificados" active={tab === "certificados"} onPress={() => setTab("certificados")} />
          <LedgerChip label="Exógena" active={tab === "exogena"} onPress={() => setTab("exogena")} />
        </LedgerChipRow>
      </LedgerCard>

      {loading ? (
        <LedgerCard>
          <LedgerLoading />
        </LedgerCard>
      ) : tab === "certificados" ? (
        <LedgerCard>
          {parties.length === 0 ? (
            <LedgerEmpty text="Sin retenciones practicadas en el año." />
          ) : (
            parties.map((p) => (
              <View key={p.tercero} style={{ marginBottom: 10 }}>
                <LedgerRow
                  cells={[
                    { value: p.tercero, bold: true },
                    { value: money(p.total_retenido), align: "right", bold: true },
                  ]}
                />
                <LedgerPrimaryBtn
                  label="Certificado PDF"
                  variant="secondary"
                  onPress={() => onCert(p.tercero)}
                  loading={busy === p.tercero}
                  disabled={!!busy}
                />
              </View>
            ))
          )}
        </LedgerCard>
      ) : (
        <>
          <LedgerCard>
            <LedgerPrimaryBtn label="Validar cuadres" onPress={validar} loading={validando} />
          </LedgerCard>
          {validaciones?.map((v) => (
            <LedgerCard key={v.codigo}>
              <LedgerRow
                cells={[
                  { value: `${v.codigo} — ${v.nombre}`, bold: true },
                  { value: v.cuadra ? "✓ Cuadra" : "✗ Alerta", align: "right" },
                ]}
              />
              {!v.cuadra && v.alertas.length ? (
                <Text style={{ fontSize: 12, marginTop: 4 }}>{v.alertas.join(" · ")}</Text>
              ) : null}
            </LedgerCard>
          ))}
          {exo ? (
            Object.entries(exo.formatos).map(([codigo, f]) => (
              <LedgerCard key={codigo}>
                <LedgerSectionHeader
                  title={`Formato ${codigo} — ${f.nombre}`}
                  subtitle={`${f.identificados} identificados · ${f.sin_identificar} sin identificar`}
                />
                {f.rows.slice(0, 5).map((r, i) => (
                  <LedgerRow
                    key={i}
                    cells={[
                      { value: r.tercero, bold: true },
                      { value: money(r.valor), align: "right" },
                    ]}
                  />
                ))}
                {f.rows.length > 5 ? (
                  <Text style={{ fontSize: 12, marginBottom: 8 }}>+ {f.rows.length - 5} filas más</Text>
                ) : null}
                <LedgerPrimaryBtn
                  label="Descargar XML DIAN"
                  onPress={() => exportXml(codigo)}
                  loading={busy === codigo}
                  disabled={!!busy || !f.rows.length}
                />
              </LedgerCard>
            ))
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

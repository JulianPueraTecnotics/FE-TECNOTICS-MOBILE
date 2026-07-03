import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import {
  getProfileService,
  type CompanyProfileResponse,
  type ReceiveBillsReportsPeriod,
} from "../page/services/get_profile";
import { updateCompanyInfoService, type UpdateCompanyInfoBody } from "../page/services/update_company_info";
import {
  fetchSimbaNumberingRange,
  habilitarFeService,
  habilitarNominaService,
  habilitarPosService,
} from "../page/services/simba_activation";

type PeriodKey = keyof ReceiveBillsReportsPeriod;

function buildPeriodPayload(period: PeriodKey): ReceiveBillsReportsPeriod {
  return { daily: period === "daily", weekly: period === "weekly", monthly: period === "monthly" };
}

export default function ProfileBillingExtrasNative({ onChanged }: { onChanged?: () => void }) {
  const colors = useThemeColors();
  const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [simbaSetTestId, setSimbaSetTestId] = useState("");
  const [simbaNominaPrefijo, setSimbaNominaPrefijo] = useState("");
  const [simbaNominaToken, setSimbaNominaToken] = useState("");
  const [simbaLoading, setSimbaLoading] = useState<"fe" | "pos" | "ne" | null>(null);
  const [rangeLoading, setRangeLoading] = useState(false);
  const [rangePayload, setRangePayload] = useState<string>("");

  const [reportsEnabled, setReportsEnabled] = useState(false);
  const [reportsPeriod, setReportsPeriod] = useState<PeriodKey>("daily");
  const [reportEmails, setReportEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState("");
  const [savingReports, setSavingReports] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const p = await getProfileService();
      setProfile(p);
      const cfg = p.company.config?.receive_bills_reports;
      setReportsEnabled(Boolean(cfg?.enabled));
      const pr = cfg?.period;
      setReportsPeriod(pr?.weekly ? "weekly" : pr?.monthly ? "monthly" : "daily");
      setReportEmails(cfg?.emails ?? []);
      const nominaPrefixes = p.company.prefixes?.filter((x) => x.tipo_doc_electronico === "nomina") ?? [];
      const preferred = nominaPrefixes.find((x) => x.default) ?? nominaPrefixes[0];
      if (preferred?.prefix) setSimbaNominaPrefijo(preferred.prefix);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSimba = async (type: "fe" | "pos" | "ne") => {
    if (type !== "ne" && !simbaSetTestId.trim()) {
      errorToast("Indica el SetTestId de Simba.");
      return;
    }
    if (type === "ne" && (!simbaNominaPrefijo.trim() || !simbaNominaToken.trim())) {
      errorToast("Indica prefijo y token de nómina.");
      return;
    }
    setSimbaLoading(type);
    try {
      const response =
        type === "fe"
          ? await habilitarFeService({ setTestId: simbaSetTestId.trim() })
          : type === "pos"
            ? await habilitarPosService({ setTestId: simbaSetTestId.trim() })
            : await habilitarNominaService({ prefijo: simbaNominaPrefijo.trim(), token: simbaNominaToken.trim() });
      if (response.Error) errorToast(response.Msg || "Simba devolvió un error");
      else successToast(response.Msg || "Habilitación exitosa");
      onChanged?.();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error Simba");
    } finally {
      setSimbaLoading(null);
    }
  };

  const fetchRanges = async () => {
    setRangeLoading(true);
    try {
      const data = await fetchSimbaNumberingRange();
      setRangePayload(JSON.stringify(data, null, 2));
    } catch (error) {
      setRangePayload("");
      errorToast(error instanceof Error ? error.message : "Error al consultar rangos");
    } finally {
      setRangeLoading(false);
    }
  };

  const saveReports = async (enabled: boolean, period?: PeriodKey, emails?: string[]) => {
    setSavingReports(true);
    try {
      const body: UpdateCompanyInfoBody = {
        config: {
          receive_bills_reports: enabled
            ? {
                enabled: true,
                emails: emails ?? reportEmails,
                period: buildPeriodPayload(period ?? reportsPeriod),
              }
            : { enabled: false },
        },
      };
      await updateCompanyInfoService(body);
      successToast("Reportes actualizados");
      await load();
      onChanged?.();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar reportes");
    } finally {
      setSavingReports(false);
    }
  };

  if (loading) return <ActivityIndicator style={{ marginVertical: 16 }} color={colors.headerAccent} />;

  return (
    <View style={styles.wrap}>
      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Reportes de facturación por correo</Text>
        <View style={styles.switchRow}>
          <Text style={{ color: colors.primaryText, flex: 1 }}>Recibir reportes</Text>
          <Switch
            value={reportsEnabled}
            disabled={savingReports}
            onValueChange={(v) => {
              setReportsEnabled(v);
              void saveReports(v);
            }}
          />
        </View>
        {(["daily", "weekly", "monthly"] as PeriodKey[]).map((p) => (
          <Pressable
            key={p}
            disabled={!reportsEnabled || savingReports}
            onPress={() => {
              setReportsPeriod(p);
              void saveReports(true, p);
            }}
            style={[
              styles.chip,
              {
                borderColor: colors.border,
                backgroundColor: reportsPeriod === p ? colors.headerAccent : colors.bgSubtle,
                opacity: reportsEnabled ? 1 : 0.5,
              },
            ]}
          >
            <Text style={{ color: reportsPeriod === p ? "#fff" : colors.primaryText, fontWeight: "600" }}>
              {p === "daily" ? "Diario" : p === "weekly" ? "Semanal" : "Mensual"}
            </Text>
          </Pressable>
        ))}
        {reportEmails.map((email) => (
          <Text key={email} style={{ color: colors.textMuted, fontSize: 12 }}>
            · {email}
          </Text>
        ))}
        <View style={styles.emailRow}>
          <TextInput
            style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
            value={newEmail}
            onChangeText={setNewEmail}
            placeholder="Agregar correo"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Pressable
            onPress={() => {
              const e = newEmail.trim().toLowerCase();
              if (!e || reportEmails.includes(e)) return;
              const next = [...reportEmails, e];
              setReportEmails(next);
              setNewEmail("");
              if (reportsEnabled) void saveReports(true, reportsPeriod, next);
            }}
            style={[styles.iconBtn, { borderColor: colors.border }]}
          >
            <Ionicons name="add" size={20} color={colors.headerAccent} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Habilitación Simba</Text>
        <Text style={[styles.desc, { color: colors.textMuted }]}>SetTestId para FE y POS</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
          value={simbaSetTestId}
          onChangeText={setSimbaSetTestId}
          placeholder="SetTestId"
          placeholderTextColor={colors.textMuted}
        />
        <View style={styles.btnRow}>
          {(["fe", "pos"] as const).map((t) => (
            <Pressable
              key={t}
              style={[styles.actionBtn, { backgroundColor: colors.headerAccent, opacity: simbaLoading ? 0.6 : 1 }]}
              disabled={simbaLoading !== null}
              onPress={() => void handleSimba(t)}
            >
              {simbaLoading === t ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.actionText}>{t === "fe" ? "Habilitar FE" : "Habilitar POS"}</Text>
              )}
            </Pressable>
          ))}
        </View>
        <Text style={[styles.desc, { color: colors.textMuted, marginTop: 12 }]}>Nómina electrónica</Text>
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
          value={simbaNominaPrefijo}
          onChangeText={setSimbaNominaPrefijo}
          placeholder="Prefijo nómina"
          placeholderTextColor={colors.textMuted}
        />
        <TextInput
          style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
          value={simbaNominaToken}
          onChangeText={setSimbaNominaToken}
          placeholder="Token Simba nómina"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
        />
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.headerAccent, opacity: simbaLoading ? 0.6 : 1 }]}
          disabled={simbaLoading !== null}
          onPress={() => void handleSimba("ne")}
        >
          {simbaLoading === "ne" ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.actionText}>Habilitar Nómina</Text>
          )}
        </Pressable>
      </View>

      <View style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Rangos de numeración (Simba)</Text>
        <Pressable
          style={[styles.actionBtn, { backgroundColor: colors.headerAccent, opacity: rangeLoading ? 0.6 : 1 }]}
          disabled={rangeLoading}
          onPress={() => void fetchRanges()}
        >
          {rangeLoading ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.actionText}>Consultar rangos</Text>}
        </Pressable>
        {rangePayload ? (
          <ScrollView style={{ maxHeight: 160, marginTop: 8 }}>
            <Text style={{ fontFamily: "monospace", fontSize: 11, color: colors.textMuted }}>{rangePayload}</Text>
          </ScrollView>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  desc: { fontSize: 12 },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  chip: { alignSelf: "flex-start", borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 8, marginRight: 8 },
  emailRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  iconBtn: { width: 40, height: 40, borderWidth: 1, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  btnRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  actionBtn: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: SHELL_RADIUS.button, alignItems: "center", minWidth: 120 },
  actionText: { color: "#fff", fontWeight: "700", fontSize: 13 },
});

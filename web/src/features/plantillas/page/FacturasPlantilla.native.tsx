import { useCallback, useEffect, useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { useNavigate } from "react-router-dom";
import { DsModuleScreen, DsSearchField } from "../../../components/design-system-native";
import { LedgerChip, LedgerChipRow, LedgerPrimaryBtn, LedgerStatusBadge } from "../../../components/native/ledger/LedgerUi.native";
import { SHELL_RADIUS } from "../../../components/mobile/shellStyles.native";
import { PATHS } from "../../../router/paths.contants";
import { getTemplates, markTemplateInvoiced, setInvoiceTemplate } from "../../../services/plantillas.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { InvoiceTemplate } from "../../../types";
import { RECURRENCE_LABELS, type RecurrenceType } from "../../../types";
import { formatCOP } from "../../../utils/format";

const REC_FILTERS = [
  { value: "all", label: "Todas" },
  { value: "recurrent", label: "Recurrentes" },
  ...Object.entries(RECURRENCE_LABELS).map(([value, label]) => ({ value, label })),
];

function formatDate(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
}

export default function FacturasPlantillaNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<InvoiceTemplate[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [recFilter, setRecFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getTemplates({ recurrence: recFilter, cliente: search.trim() || undefined });
      if (res) {
        setTemplates(res.templates);
        setPendingCount(res.pending_count);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudieron cargar las plantillas");
    } finally {
      setLoading(false);
    }
  }, [recFilter, search]);

  useEffect(() => {
    load();
  }, [load]);

  const visible = templates.filter(
    (t) => !search.trim() || `${t.number} ${t.client_name ?? ""} ${t.client_doc ?? ""}`.toLowerCase().includes(search.toLowerCase()),
  );

  const handleRecreate = async (t: InvoiceTemplate) => {
    setBusyId(t._id);
    try {
      try {
        await markTemplateInvoiced(t._id);
      } catch {
        /* continuar aunque falle el marcado */
      }
      navigate(PATHS.DASHBOARD_BILLING, { state: { recreate_factura_id: t._id } });
    } finally {
      setBusyId(null);
    }
  };

  const handleRemove = (t: InvoiceTemplate) => {
    Alert.alert("Quitar de plantillas", `¿Quitar "${t.number}" de plantillas? La factura original no se elimina.`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Quitar",
        style: "destructive",
        onPress: async () => {
          setBusyId(t._id + "rm");
          try {
            await setInvoiceTemplate(t._id, { is_template: false });
            successToast("Quitada de plantillas");
            load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo quitar");
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <DsModuleScreen
      title="Facturas de plantilla"
      subtitle="Reutiliza facturas frecuentes y recurrentes"
      refreshing={refreshing}
      onRefresh={async () => {
        setRefreshing(true);
        await load();
        setRefreshing(false);
      }}
      toolbar={<DsSearchField value={search} onChangeText={setSearch} placeholder="Buscar plantilla..." />}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
        <LedgerChipRow>
          {REC_FILTERS.map((f) => (
            <LedgerChip key={f.value} label={f.label} active={recFilter === f.value} onPress={() => setRecFilter(f.value)} />
          ))}
        </LedgerChipRow>
      </ScrollView>

        {pendingCount > 0 ? (
          <View style={[styles.banner, { backgroundColor: "rgba(234, 179, 8, 0.15)", borderColor: "#ca8a04" }]}>
            <Text style={{ color: colors.primaryText }}>
              Tienes <Text style={{ fontWeight: "700" }}>{pendingCount}</Text> factura(s) recurrente(s) pendiente(s) por facturar.
            </Text>
          </View>
        ) : null}

        {loading ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>Cargando...</Text>
        ) : visible.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center", padding: 24 }}>
            No hay plantillas. Guarda una factura como plantilla desde Facturas.
          </Text>
        ) : (
          visible.map((t) => (
            <View key={t._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }, t.pending && styles.cardPending]}>
              <Text style={{ fontWeight: "700", color: colors.primaryText }}>{t.number}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{t.client_name || "—"}</Text>
              <Text style={{ color: colors.primaryText, marginVertical: 4 }}>{formatCOP(t.total)}</Text>
              <LedgerStatusBadge
                label={RECURRENCE_LABELS[t.recurrence as RecurrenceType] ?? t.recurrence}
                tone={t.recurrence === "none" ? "neutral" : t.pending ? "warn" : "ok"}
              />
              {t.recurrence !== "none" ? (
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Próxima: {formatDate(t.next_due)}{t.pending ? " · pendiente" : ""}
                </Text>
              ) : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                <LedgerPrimaryBtn label="Recrear" loading={busyId === t._id} onPress={() => handleRecreate(t)} />
                <LedgerPrimaryBtn label="Quitar" variant="danger" loading={busyId === t._id + "rm"} onPress={() => handleRemove(t)} />
              </View>
            </View>
          ))
        )}
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  banner: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 12, marginBottom: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 10 },
  cardPending: { borderLeftWidth: 3, borderLeftColor: "#ca8a04" },
});

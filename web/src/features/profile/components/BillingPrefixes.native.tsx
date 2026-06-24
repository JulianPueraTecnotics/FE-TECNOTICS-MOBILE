import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { TipoDocElectronico } from "../../../types";
import { addPrefixService } from "../page/services/add_prefix";
import { addNominaPrefixService } from "../page/services/add_nomina_prefix";
import { deletePrefixService } from "../page/services/delete_prefix";
import {
  getProfileService,
  type CompanyPrefix,
  type CompanyProfileResponse,
} from "../page/services/get_profile";
import { setDefaultPrefixService } from "../page/services/set_default_prefix";
import { setPrefixStatusService } from "../page/services/set_prefix_status";
import { updateCompanyInfoService } from "../page/services/update_company_info";
import {
  TIPO_DOC_ELECTRONICO_OPTIONS,
  defaultTipoFacturaForDoc,
  formatDateShort,
  getTipoDocElectronicoLabel,
  getTipoFacturaLabel,
  getTipoFacturaOptionsForDoc,
  normalizeCompanyPrefix,
  normalizeResolution,
  normalizeTipoDocElectronico,
  parseLockedInput,
  sanitizeLockedInput,
  toIsoFromDate,
  type CompanyPrefixDraft,
  type TipoDeFacturaCode,
  type TipoDocElectronicoCode,
} from "../prefix/prefix.shared";

type Props = {
  embedded?: boolean;
  onPrefixesChanged?: () => void;
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      {children}
    </View>
  );
}

export default function BillingPrefixesNative({ embedded = false, onPrefixesChanged }: Props) {
  const colors = useThemeColors();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
  const [draftPrefixes, setDraftPrefixes] = useState<CompanyPrefixDraft[]>([]);
  const [lockedInputs, setLockedInputs] = useState<Record<string, string>>({});
  const [expandedPrefix, setExpandedPrefix] = useState<string | null>(null);
  const [prefixActionLoading, setPrefixActionLoading] = useState<string | null>(null);
  const [savingPrefixes, setSavingPrefixes] = useState(false);

  const [newPrefixInput, setNewPrefixInput] = useState("");
  const [newPrefixInit, setNewPrefixInit] = useState("");
  const [newPrefixEnd, setNewPrefixEnd] = useState("");
  const [newPrefixLocked, setNewPrefixLocked] = useState("");
  const [newPrefixStartDate, setNewPrefixStartDate] = useState("");
  const [newPrefixEndDate, setNewPrefixEndDate] = useState("");
  const [newPrefixResolutionCode, setNewPrefixResolutionCode] = useState("");
  const [newPrefixTipoDoc, setNewPrefixTipoDoc] = useState<TipoDocElectronicoCode>(TipoDocElectronico.FACTURA);
  const [newPrefixTipoFactura, setNewPrefixTipoFactura] = useState<TipoDeFacturaCode>("01");
  const [newPrefixIsNomina, setNewPrefixIsNomina] = useState(false);

  const billingPrefixes = useMemo(
    () => draftPrefixes.filter((p) => !p.is_nomina),
    [draftPrefixes]
  );

  const loadProfile = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getProfileService();
      if (data instanceof Error || !data?.company) {
        throw new Error(data instanceof Error ? data.message : "Error al cargar prefijos");
      }
      setProfile(data);
      const normalized = (data.company.prefixes ?? []).map(normalizeCompanyPrefix);
      setDraftPrefixes(normalized);
      const locked: Record<string, string> = {};
      for (const p of normalized) {
        if (p.resolution.locked?.length) {
          locked[p.prefix] = p.resolution.locked.join(", ");
        }
      }
      setLockedInputs(locked);
      onPrefixesChanged?.();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar prefijos");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [onPrefixesChanged]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleAddPrefix = async () => {
    const prefix = newPrefixInput.trim().toUpperCase();
    if (!prefix) {
      errorToast("Ingresa el código del prefijo");
      return;
    }
    const init = parseInt(newPrefixInit, 10);

    if (newPrefixIsNomina) {
      if (Number.isNaN(init) || init < 1) {
        errorToast("El consecutivo inicial debe ser mayor o igual a 1");
        return;
      }
      if (prefix.length > 5) {
        errorToast("El prefijo de nómina admite máximo 5 caracteres");
        return;
      }
      setPrefixActionLoading("add");
      try {
        await addNominaPrefixService({ prefix, consecutivo_inicial: init });
        successToast("Prefijo de nómina añadido");
        resetAddForm();
        await loadProfile(true);
      } catch (error) {
        errorToast(error instanceof Error ? error.message : "Error al añadir prefijo de nómina");
      } finally {
        setPrefixActionLoading(null);
      }
      return;
    }

    const end = parseInt(newPrefixEnd, 10);
    const startDateIso = toIsoFromDate(newPrefixStartDate);
    const endDateIso = toIsoFromDate(newPrefixEndDate);
    const resolutionCode = newPrefixResolutionCode.trim();

    if (Number.isNaN(init) || init < 1) {
      errorToast("El consecutivo inicial debe ser mayor o igual a 1");
      return;
    }
    if (Number.isNaN(end) || end < init) {
      errorToast("El consecutivo final debe ser mayor o igual al inicial");
      return;
    }
    if (!startDateIso) {
      errorToast("Indica una fecha de inicio válida (AAAA-MM-DD)");
      return;
    }
    if (!endDateIso) {
      errorToast("Indica una fecha de vencimiento válida (AAAA-MM-DD)");
      return;
    }
    if (new Date(endDateIso).getTime() < new Date(startDateIso).getTime()) {
      errorToast("La fecha de vencimiento debe ser posterior a la de inicio");
      return;
    }
    if (!resolutionCode) {
      errorToast("Indica el número/código de resolución DIAN");
      return;
    }

    const locked = parseLockedInput(newPrefixLocked);
    setPrefixActionLoading("add");
    try {
      await addPrefixService({
        prefix,
        resolution: {
          init,
          end,
          ...(locked?.length ? { locked } : {}),
          status: "active",
          start_date: startDateIso,
          end_date: endDateIso,
          tipo_doc_electronico: newPrefixTipoDoc,
          tipo_factura: newPrefixTipoFactura,
          resolution: resolutionCode,
        },
      });
      successToast("Prefijo añadido correctamente");
      resetAddForm();
      await loadProfile(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al añadir el prefijo");
    } finally {
      setPrefixActionLoading(null);
    }
  };

  const resetAddForm = () => {
    setNewPrefixInput("");
    setNewPrefixInit("");
    setNewPrefixEnd("");
    setNewPrefixLocked("");
    setNewPrefixStartDate("");
    setNewPrefixEndDate("");
    setNewPrefixResolutionCode("");
    setNewPrefixTipoDoc(TipoDocElectronico.FACTURA);
    setNewPrefixTipoFactura("01");
    setNewPrefixIsNomina(false);
  };

  const handleSavePrefixResolutions = async () => {
    for (const item of draftPrefixes) {
      const { init, end } = item.resolution;
      if (init < 1 || end < init) {
        errorToast(`Prefijo ${item.prefix}: revisa inicio y fin de la resolución`);
        return;
      }
    }
    setSavingPrefixes(true);
    try {
      const payload: CompanyPrefix[] = draftPrefixes.map((p) => {
        const locked = parseLockedInput(lockedInputs[p.prefix] ?? "");
        const res = p.resolution;
        return {
          prefix: p.prefix,
          default: p.default,
          is_nomina: p.is_nomina,
          resolution: {
            init: res.init,
            end: res.end,
            ...(locked?.length ? { locked } : {}),
            status: res.status ?? "active",
            start_date: res.start_date,
            end_date: res.end_date,
            tipo_doc_electronico: res.tipo_doc_electronico,
            tipo_factura: res.tipo_factura,
            resolution: res.resolution,
          },
        };
      });
      await updateCompanyInfoService({ prefixes: payload });
      successToast("Resoluciones de prefijos actualizadas");
      await loadProfile(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar prefijos");
    } finally {
      setSavingPrefixes(false);
    }
  };

  const handleSetDefault = async (prefix: string) => {
    setPrefixActionLoading(`default-${prefix}`);
    try {
      await setDefaultPrefixService({ prefix });
      successToast("Prefijo por defecto actualizado");
      await loadProfile(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al establecer prefijo por defecto");
    } finally {
      setPrefixActionLoading(null);
    }
  };

  const handleToggleStatus = async (item: CompanyPrefixDraft) => {
    const nextStatus = item.resolution.status === "inactive" ? "active" : "inactive";
    setPrefixActionLoading(`status-${item.prefix}`);
    try {
      await setPrefixStatusService({ prefix: item.prefix, status: nextStatus });
      successToast(`Prefijo ${item.prefix} ${nextStatus === "active" ? "activado" : "desactivado"}`);
      await loadProfile(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al actualizar estado");
    } finally {
      setPrefixActionLoading(null);
    }
  };

  const confirmDelete = (prefix: string) => {
    Alert.alert(
      "Eliminar prefijo",
      `¿Eliminar el prefijo ${prefix}? Esta acción no se puede deshacer.`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: () => void handleDelete(prefix),
        },
      ]
    );
  };

  const handleDelete = async (prefix: string) => {
    setPrefixActionLoading(`delete-${prefix}`);
    try {
      await deletePrefixService(prefix);
      successToast("Prefijo eliminado");
      await loadProfile(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al eliminar prefijo");
    } finally {
      setPrefixActionLoading(null);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingWrap}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.content, embedded ? styles.embedded : null]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Prefijos DIAN</Text>
        <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
          Configura prefijos y resoluciones antes de crear facturas electrónicas.
        </Text>

        {billingPrefixes.length === 0 ? (
          <Text style={[styles.empty, { color: colors.textMuted }]}>No hay prefijos de facturación configurados</Text>
        ) : (
          billingPrefixes.map((item) => {
            const expanded = expandedPrefix === item.prefix;
            const busy = prefixActionLoading !== null || savingPrefixes;
            return (
              <View
                key={item.prefix}
                style={[styles.prefixCard, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}
              >
                <View style={styles.prefixHeader}>
                  <View style={{ flex: 1 }}>
                    <View style={styles.prefixTitleRow}>
                      <Text style={[styles.prefixCode, { color: colors.primary }]}>{item.prefix}</Text>
                      {item.default ? (
                        <View style={[styles.badge, { backgroundColor: `${colors.accent}22` }]}>
                          <Text style={[styles.badgeText, { color: colors.accent }]}>Por defecto</Text>
                        </View>
                      ) : null}
                      {item.resolution.status === "inactive" ? (
                        <View style={[styles.badge, { backgroundColor: "#fee2e2" }]}>
                          <Text style={[styles.badgeText, { color: "#b91c1c" }]}>Inactivo</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={[styles.prefixMeta, { color: colors.textMuted }]}>
                      {getTipoDocElectronicoLabel(item.resolution.tipo_doc_electronico)} ·{" "}
                      {getTipoFacturaLabel(item.resolution.tipo_factura)}
                    </Text>
                    <Text style={[styles.prefixMeta, { color: colors.textMuted }]}>
                      Res. {item.resolution.resolution || "—"} · {item.resolution.init}-{item.resolution.end}
                    </Text>
                    <Text style={[styles.prefixMeta, { color: colors.textMuted }]}>
                      Vigencia: {formatDateShort(item.resolution.start_date)} — {formatDateShort(item.resolution.end_date)}
                    </Text>
                  </View>
                  <View style={styles.prefixActions}>
                    <Pressable
                      onPress={() => setExpandedPrefix(expanded ? null : item.prefix)}
                      disabled={busy}
                      style={[styles.iconBtn, { borderColor: colors.border }]}
                    >
                      <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={18} color={colors.accent} />
                    </Pressable>
                    <Pressable
                      onPress={() => void handleToggleStatus(item)}
                      disabled={busy}
                      style={[styles.iconBtn, { borderColor: colors.border }]}
                    >
                      {prefixActionLoading === `status-${item.prefix}` ? (
                        <ActivityIndicator size="small" color={colors.accent} />
                      ) : (
                        <Ionicons
                          name={item.resolution.status === "inactive" ? "toggle-outline" : "toggle"}
                          size={18}
                          color={colors.accent}
                        />
                      )}
                    </Pressable>
                    {!item.default ? (
                      <Pressable
                        onPress={() => void handleSetDefault(item.prefix)}
                        disabled={busy}
                        style={[styles.iconBtn, { borderColor: colors.border }]}
                      >
                        {prefixActionLoading === `default-${item.prefix}` ? (
                          <ActivityIndicator size="small" color={colors.accent} />
                        ) : (
                          <Ionicons name="star-outline" size={18} color={colors.accent} />
                        )}
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => confirmDelete(item.prefix)}
                      disabled={busy}
                      style={[styles.iconBtn, { borderColor: "#fecaca" }]}
                    >
                      {prefixActionLoading === `delete-${item.prefix}` ? (
                        <ActivityIndicator size="small" color="#dc2626" />
                      ) : (
                        <Ionicons name="trash-outline" size={18} color="#dc2626" />
                      )}
                    </Pressable>
                  </View>
                </View>

                {expanded ? (
                  <View style={styles.expanded}>
                    <Field label="Consecutivos omitidos (opcional)">
                      <TextInput
                        style={[styles.input, { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText }]}
                        value={lockedInputs[item.prefix] ?? ""}
                        onChangeText={(v) =>
                          setLockedInputs((prev) => ({ ...prev, [item.prefix]: sanitizeLockedInput(v) }))
                        }
                        placeholder="Ej: 100, 200"
                        placeholderTextColor={colors.textMuted}
                        editable={!savingPrefixes}
                      />
                    </Field>
                  </View>
                ) : null}
              </View>
            );
          })
        )}

        {billingPrefixes.length > 0 ? (
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: savingPrefixes ? 0.7 : 1 }]}
            disabled={savingPrefixes || prefixActionLoading !== null}
            onPress={() => void handleSavePrefixResolutions()}
          >
            {savingPrefixes ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryBtnText}>Guardar cambios de resolución</Text>
            )}
          </Pressable>
        ) : null}
      </View>

      <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
        <Text style={[styles.cardTitle, { color: colors.primary }]}>Añadir prefijo</Text>
        <View style={styles.nominaRow}>
          <Text style={[styles.nominaLabel, { color: colors.primaryText }]}>Prefijo de nómina electrónica</Text>
          <Switch
            value={newPrefixIsNomina}
            onValueChange={setNewPrefixIsNomina}
            disabled={prefixActionLoading !== null}
            trackColor={{ false: colors.border, true: colors.accent }}
          />
        </View>

        <Field label="Código de prefijo">
          <TextInput
            style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
            value={newPrefixInput}
            onChangeText={(v) => setNewPrefixInput(v.toUpperCase())}
            placeholder={newPrefixIsNomina ? "Ej. NE" : "Ej. SETP"}
            placeholderTextColor={colors.textMuted}
            maxLength={newPrefixIsNomina ? 5 : 10}
            editable={prefixActionLoading !== null}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Consecutivo inicial">
          <TextInput
            style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
            value={newPrefixInit}
            onChangeText={setNewPrefixInit}
            keyboardType="number-pad"
            placeholder="1"
            placeholderTextColor={colors.textMuted}
            editable={prefixActionLoading !== null}
          />
        </Field>

        {!newPrefixIsNomina ? (
          <>
            <Field label="Tipo de documento">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {TIPO_DOC_ELECTRONICO_OPTIONS.map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.chip,
                      newPrefixTipoDoc === opt.value
                        ? { backgroundColor: colors.accent }
                        : { borderColor: colors.border },
                    ]}
                    onPress={() => {
                      setNewPrefixTipoDoc(opt.value);
                      setNewPrefixTipoFactura(defaultTipoFacturaForDoc(opt.value));
                    }}
                  >
                    <Text style={{ color: newPrefixTipoDoc === opt.value ? "#fff" : colors.primaryText, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Field>

            <Field label="Tipo de factura">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {getTipoFacturaOptionsForDoc(newPrefixTipoDoc, newPrefixTipoFactura).map((opt) => (
                  <Pressable
                    key={opt.value}
                    style={[
                      styles.chip,
                      newPrefixTipoFactura === opt.value
                        ? { backgroundColor: colors.accent }
                        : { borderColor: colors.border },
                    ]}
                    onPress={() => setNewPrefixTipoFactura(opt.value)}
                  >
                    <Text style={{ color: newPrefixTipoFactura === opt.value ? "#fff" : colors.primaryText, fontSize: 12 }}>
                      {opt.label}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Field>

            <Field label="Número de resolución DIAN">
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                value={newPrefixResolutionCode}
                onChangeText={setNewPrefixResolutionCode}
                placeholder="Ej. 18760000001"
                placeholderTextColor={colors.textMuted}
                editable={prefixActionLoading !== null}
              />
            </Field>

            <Field label="Consecutivo final">
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                value={newPrefixEnd}
                onChangeText={setNewPrefixEnd}
                keyboardType="number-pad"
                placeholder="999999"
                placeholderTextColor={colors.textMuted}
                editable={prefixActionLoading !== null}
              />
            </Field>

            <Field label="Fecha inicio (AAAA-MM-DD)">
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                value={newPrefixStartDate}
                onChangeText={setNewPrefixStartDate}
                placeholder="2024-01-01"
                placeholderTextColor={colors.textMuted}
                editable={prefixActionLoading !== null}
              />
            </Field>

            <Field label="Fecha vencimiento (AAAA-MM-DD)">
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                value={newPrefixEndDate}
                onChangeText={setNewPrefixEndDate}
                placeholder="2026-12-31"
                placeholderTextColor={colors.textMuted}
                editable={prefixActionLoading !== null}
              />
            </Field>

            <Field label="Consecutivos omitidos (opcional)">
              <TextInput
                style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText }]}
                value={newPrefixLocked}
                onChangeText={(v) => setNewPrefixLocked(sanitizeLockedInput(v))}
                placeholder="100, 200"
                placeholderTextColor={colors.textMuted}
                editable={prefixActionLoading !== null}
              />
            </Field>
          </>
        ) : null}

        <Pressable
          style={[styles.primaryBtn, { backgroundColor: colors.accent, opacity: prefixActionLoading === "add" ? 0.7 : 1 }]}
          disabled={prefixActionLoading !== null}
          onPress={() => void handleAddPrefix()}
        >
          {prefixActionLoading === "add" ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.primaryBtnText}>Añadir prefijo</Text>
          )}
        </Pressable>
      </View>

      {profile?.company ? (
        <Text style={[styles.footerNote, { color: colors.textMuted }]}>
          Empresa: {profile.company.razon_social}
        </Text>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingWrap: { padding: 32, alignItems: "center" },
  content: { padding: 16, gap: 16, paddingBottom: 32 },
  embedded: { paddingHorizontal: 0, paddingTop: 8 },
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 14,
    gap: 12,
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  cardDesc: { fontSize: 13, lineHeight: 18 },
  empty: { textAlign: "center", paddingVertical: 12, fontSize: 14 },
  prefixCard: { borderWidth: 1, borderRadius: 12, padding: 12, gap: 8 },
  prefixHeader: { flexDirection: "row", gap: 8 },
  prefixTitleRow: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  prefixCode: { fontSize: 16, fontWeight: "700" },
  prefixMeta: { fontSize: 12, marginTop: 2 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10 },
  badgeText: { fontSize: 10, fontWeight: "700" },
  prefixActions: { flexDirection: "row", gap: 4, alignItems: "flex-start" },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  expanded: { marginTop: 4 },
  field: { gap: 6 },
  fieldLabel: { fontSize: 12, fontWeight: "600" },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  primaryBtn: {
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    alignItems: "center",
    marginTop: 4,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  nominaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  nominaLabel: { fontSize: 14, flex: 1, marginRight: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 4,
  },
  footerNote: { fontSize: 12, textAlign: "center" },
});

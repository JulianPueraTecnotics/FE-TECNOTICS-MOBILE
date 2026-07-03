import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import LoadingScreen from "../../../router/LoadingScreen";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
  bootstrapAccounting,
  configureSequence,
  createCostCenter,
  createRetention,
  deleteCostCenter,
  deleteRetention,
  getAccountingConfig,
  getCoa,
  getCostCenters,
  getRetentions,
  getRoles,
  getSequence,
  getUvt,
  importCoa,
  saveAccountingConfig,
  seedDefaultRoles,
  setUvt,
  updateRetention,
} from "../accounting.service";
import type { AccountingConfig, CoaAccount, CostCenter, RetentionConcept, RetentionType, Role } from "../accounting.types";
import type { ConfigurationSection } from "./configuration.nav";
import {
  getTaxProfile,
  updateTaxProfile,
  type IvaPeriodicidad,
  type TaxProfile,
} from "../../dashboard/tax.service";
import { getAudit, type AuditEntry } from "../../../services/logger.service";

const DEFAULT_ACCOUNT_FIELDS: { key: keyof AccountingConfig; label: string }[] = [
  { key: "cuenta_por_pagar", label: "Cuenta por pagar" },
  { key: "cuenta_gasto_costo", label: "Gasto / costo" },
  { key: "cuenta_iva", label: "IVA descontable" },
  { key: "cuenta_ingreso", label: "Ingreso ventas" },
  { key: "cuenta_iva_generado", label: "IVA generado" },
  { key: "cuenta_cliente", label: "Clientes (CxC)" },
  { key: "cuenta_inventario", label: "Inventario" },
  { key: "cuenta_costo_ventas", label: "Costo de ventas" },
  { key: "cuenta_banco", label: "Banco" },
  { key: "cuenta_retefuente", label: "Retefuente" },
  { key: "cuenta_reteiva", label: "ReteIVA" },
  { key: "cuenta_reteica", label: "ReteICA" },
];

function DefaultAccountsSection() {
  const colors = useThemeColors();
  const [config, setConfig] = useState<AccountingConfig>({ marco: "niif" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getAccountingConfig()
      .then((r) => setConfig(r.config))
      .catch((e) => errorToast(e instanceof Error ? e.message : "Error al cargar"))
      .finally(() => setLoading(false));
  }, []);

  const setNiif = (key: keyof AccountingConfig, val: string) => {
    setConfig((c) => ({
      ...c,
      [key]: { ...(c[key] as { niif?: string } | undefined), niif: val },
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      const r = await saveAccountingConfig(config);
      setConfig(r.config);
      successToast("Cuentas guardadas");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const onBootstrap = () => {
    Alert.alert("Inicializar", "¿Sembrar PUC base y cuentas por defecto?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Inicializar",
        onPress: async () => {
          try {
            const r = await bootstrapAccounting();
            successToast(r.message);
            const fresh = await getAccountingConfig();
            setConfig(fresh.config);
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <LedgerPrimaryBtn label="Inicializar contabilidad" onPress={onBootstrap} />
      {DEFAULT_ACCOUNT_FIELDS.map((f) => {
        const pair = config[f.key] as { niif?: string } | undefined;
        return (
          <View key={String(f.key)} style={[styles.field, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
            <Text style={[styles.label, { color: colors.textMuted }]}>{f.label}</Text>
            <TextInput
              style={[styles.input, { color: colors.primary, borderColor: colors.border }]}
              placeholder="Código NIIF"
              placeholderTextColor={colors.textMuted}
              value={pair?.niif ?? ""}
              onChangeText={(v) => setNiif(f.key, v)}
            />
          </View>
        );
      })}
      <LedgerPrimaryBtn label={saving ? "Guardando…" : "Guardar cuentas"} onPress={onSave} disabled={saving} />
    </ScrollView>
  );
}

function SequencesSection() {
  const colors = useThemeColors();
  const [egreso, setEgreso] = useState("");
  const [causacion, setCausacion] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([getSequence("egreso"), getSequence("causacion")])
      .then(([e, c]) => {
        setEgreso(String(e.sequence?.base_number ?? ""));
        setCausacion(String(c.sequence?.base_number ?? ""));
      })
      .catch((err) => errorToast(err instanceof Error ? err.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const save = async (type: "egreso" | "causacion", base: string) => {
    const n = Number(base);
    if (!Number.isFinite(n) || n < 1) return errorToast("Número base inválido");
    setSaving(type);
    try {
      const r = await configureSequence(type, n);
      successToast(r.message);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      {(["egreso", "causacion"] as const).map((t) => (
        <View key={t} style={[styles.field, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
          <Text style={[styles.label, { color: colors.primary, fontWeight: "600" }]}>{t === "egreso" ? "Comprobante de egreso" : "Causación"}</Text>
          <TextInput
            style={[styles.input, { color: colors.primary, borderColor: colors.border }]}
            keyboardType="number-pad"
            value={t === "egreso" ? egreso : causacion}
            onChangeText={t === "egreso" ? setEgreso : setCausacion}
            placeholder="Número base"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable onPress={() => save(t, t === "egreso" ? egreso : causacion)} style={[styles.smallBtn, { backgroundColor: colors.accent }]}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>{saving === t ? "…" : "Guardar"}</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function CostCentersSection() {
  const colors = useThemeColors();
  const [items, setItems] = useState<CostCenter[]>([]);
  const [codigo, setCodigo] = useState("");
  const [desc, setDesc] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await getCostCenters();
      setItems(r.cost_centers);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onCreate = async () => {
    if (!codigo.trim()) return errorToast("Código requerido");
    try {
      await createCostCenter(codigo.trim(), desc.trim());
      setCodigo("");
      setDesc("");
      successToast("Centro creado");
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    }
  };

  const onDelete = (id: string) => {
    Alert.alert("Eliminar", "¿Eliminar este centro de costo?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteCostCenter(id);
            successToast("Eliminado");
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <View style={[styles.field, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
        <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border }]} placeholder="Código" placeholderTextColor={colors.textMuted} value={codigo} onChangeText={setCodigo} />
        <TextInput style={[styles.input, { color: colors.primary, borderColor: colors.border, marginTop: 8 }]} placeholder="Descripción" placeholderTextColor={colors.textMuted} value={desc} onChangeText={setDesc} />
        <LedgerPrimaryBtn label="Agregar centro" onPress={onCreate} />
      </View>
      {items.map((c) => (
        <View key={c._id} style={[styles.rowCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.primary, fontWeight: "600" }}>{c.codigo}</Text>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.descripcion}</Text>
          </View>
          <Pressable onPress={() => onDelete(c._id)}>
            <Text style={{ color: "#c0392b" }}>Eliminar</Text>
          </Pressable>
        </View>
      ))}
    </ScrollView>
  );
}

function PucSection() {
  const colors = useThemeColors();
  const [accounts, setAccounts] = useState<CoaAccount[]>([]);
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await getCoa(page, 40, debounced.trim());
      setAccounts(r.accounts);
      setTotalPages(r.pagination.totalPages);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [page, debounced]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setPage(1); }, [debounced]);

  const onImport = async () => {
    const pick = await DocumentPicker.getDocumentAsync({
      type: [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
        "text/csv",
      ],
      copyToCacheDirectory: true,
    });
    if (pick.canceled || !pick.assets[0]?.uri) return;
    setImporting(true);
    try {
      const base64 = await FileSystem.readAsStringAsync(pick.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const wb = XLSX.read(base64, { type: "base64" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: "" }) as string[][];
      const codes = matrix
        .slice(1)
        .map((row) => String(row[0] ?? "").trim())
        .filter((c) => /^\d+$/.test(c));
      if (!codes.length) {
        errorToast("No se encontraron códigos de cuenta.");
        return;
      }
      const rows = codes.map((codigo) => ({ codigo, nombre: codigo, naturaleza: "DEBITO" as const, tipo: "auxiliar" as const }));
      const r = await importCoa(rows);
      successToast(`Importadas ${r.importadas} cuentas`);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al importar");
    } finally {
      setImporting(false);
    }
  };

  const onExport = async () => {
    try {
      const r = await getCoa(1, 5000, debounced.trim());
      const rows = r.accounts.map((a) => [a.codigo, a.nombre ?? "", a.clase ?? "", a.categoria ?? ""]);
      const ws = XLSX.utils.aoa_to_sheet([["Código", "Nombre", "Clase", "Categoría"], ...rows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "PUC");
      const out = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
      const path = `${FileSystem.cacheDirectory}puc-export.xlsx`;
      await FileSystem.writeAsStringAsync(path, out, { encoding: FileSystem.EncodingType.Base64 });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(path);
      else successToast("Exportación generada");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al exportar");
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.toolRow}>
        <View style={[styles.searchRow, { borderColor: colors.border, backgroundColor: colors.cardBg, flex: 1, marginHorizontal: 0 }]}>
          <TextInput style={{ flex: 1, color: colors.primary, paddingVertical: 10 }} placeholder="Buscar cuenta…" placeholderTextColor={colors.textMuted} value={search} onChangeText={setSearch} />
        </View>
        <Pressable style={[styles.smallBtn, { backgroundColor: colors.headerAccent }]} onPress={() => void onImport()} disabled={importing}>
          <Text style={{ color: "#fff", fontWeight: "600" }}>{importing ? "…" : "Importar"}</Text>
        </Pressable>
        <Pressable style={[styles.smallBtn, { borderWidth: 1, borderColor: colors.border }]} onPress={() => void onExport()}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>Exportar</Text>
        </Pressable>
      </View>
      {loading ? <ActivityIndicator style={{ marginTop: 24 }} /> : (
        <ScrollView contentContainerStyle={styles.pad}>
          {accounts.map((a) => (
            <View key={a._id} style={[styles.rowCard, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{a.codigo}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{a.nombre}</Text>
                {a.clase ? <Text style={{ color: colors.textMuted, fontSize: 11 }}>{a.clase} · {a.naturaleza}</Text> : null}
              </View>
            </View>
          ))}
          {totalPages > 1 ? (
            <View style={styles.pager}>
              <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}><Text style={{ color: colors.primary }}>Anterior</Text></Pressable>
              <Text style={{ color: colors.textMuted }}>{page}/{totalPages}</Text>
              <Pressable disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}><Text style={{ color: colors.primary }}>Siguiente</Text></Pressable>
            </View>
          ) : null}
        </ScrollView>
      )}
    </View>
  );
}

const RETENTION_TYPES: RetentionType[] = ["fuente", "iva", "ica", "autorrenta"];
const TYPE_LABEL: Record<RetentionType, string> = {
  fuente: "Retefuente",
  iva: "ReteIVA",
  ica: "ReteICA",
  autorrenta: "Autorretención",
};

function TaxesSection() {
  const colors = useThemeColors();
  const [items, setItems] = useState<RetentionConcept[]>([]);
  const [uvtYear, setUvtYear] = useState(String(new Date().getFullYear()));
  const [uvtValue, setUvtValue] = useState("");
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<RetentionConcept | null>(null);
  const [form, setForm] = useState({ tipo: "fuente" as RetentionType, codigo: "", descripcion: "", base_minima_uvt: "0", tarifa: "0", cuenta: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([getRetentions(), getUvt()]);
      setItems(c.concepts);
      const current = u.uvts.find((x) => String(x.anio) === uvtYear);
      if (current) setUvtValue(String(current.valor));
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, [uvtYear]);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ tipo: "fuente", codigo: "", descripcion: "", base_minima_uvt: "0", tarifa: "0", cuenta: "" });
    setModalOpen(true);
  };

  const openEdit = (c: RetentionConcept) => {
    setEditing(c);
    setForm({
      tipo: c.tipo,
      codigo: c.codigo,
      descripcion: c.descripcion,
      base_minima_uvt: String(c.base_minima_uvt ?? 0),
      tarifa: String(c.tarifa ?? 0),
      cuenta: c.cuenta ?? "",
    });
    setModalOpen(true);
  };

  const onSaveConcept = async () => {
    setSaving(true);
    try {
      const payload = {
        tipo: form.tipo,
        codigo: form.codigo.trim(),
        descripcion: form.descripcion.trim(),
        base_minima_uvt: Number(form.base_minima_uvt) || 0,
        tarifa: Number(form.tarifa) || 0,
        cuenta: form.cuenta.trim(),
      };
      if (editing?._id) await updateRetention(editing._id, payload);
      else await createRetention(payload);
      successToast(editing ? "Concepto actualizado" : "Concepto creado");
      setModalOpen(false);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = (c: RetentionConcept) => {
    Alert.alert("Eliminar", `¿Eliminar ${c.codigo}?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Eliminar",
        style: "destructive",
        onPress: async () => {
          try {
            await deleteRetention(c._id);
            successToast("Eliminado");
            await load();
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const onSaveUvt = async () => {
    try {
      await setUvt(Number(uvtYear), Number(uvtValue));
      successToast("UVT guardado");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error UVT");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <>
      <ScrollView contentContainerStyle={styles.pad}>
        <Text style={[styles.sectionTitle, { color: colors.primary }]}>UVT {uvtYear}</Text>
        <View style={styles.toolRow}>
          <TextInput
            style={[styles.inputInline, { borderColor: colors.border, color: colors.primaryText, flex: 1 }]}
            value={uvtValue}
            onChangeText={setUvtValue}
            keyboardType="numeric"
            placeholder="Valor UVT"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable style={[styles.smallBtn, { backgroundColor: colors.headerAccent }]} onPress={() => void onSaveUvt()}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>Guardar UVT</Text>
          </Pressable>
        </View>

        <View style={[styles.toolRow, { marginTop: 12, marginBottom: 8 }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary, marginBottom: 0, flex: 1 }]}>Conceptos de retención</Text>
          <Pressable style={[styles.smallBtn, { backgroundColor: colors.headerAccent }]} onPress={openCreate}>
            <Text style={{ color: "#fff", fontWeight: "600" }}>+ Nuevo</Text>
          </Pressable>
        </View>

        {items.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sin conceptos de retención</Text>
        ) : (
          items.map((c) => (
            <Pressable key={c._id} onPress={() => openEdit(c)} style={[styles.rowCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.primary, fontWeight: "600" }}>{c.codigo} · {TYPE_LABEL[c.tipo]}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.descripcion}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                  Base {c.base_minima_uvt} UVT · Tarifa {(c.tarifa * 100).toFixed(2)}%
                </Text>
              </View>
              <Pressable onPress={() => onDelete(c)} hitSlop={8}>
                <Text style={{ color: "#c0392b" }}>Eliminar</Text>
              </Pressable>
            </Pressable>
          ))
        )}
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <ScrollView contentContainerStyle={[styles.pad, { paddingTop: 48 }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>{editing ? "Editar concepto" : "Nuevo concepto"}</Text>
          <View style={styles.chipRow}>
            {RETENTION_TYPES.map((t) => (
              <Pressable key={t} onPress={() => setForm((f) => ({ ...f, tipo: t }))} style={[styles.chip, { borderColor: colors.border, backgroundColor: form.tipo === t ? colors.headerAccent : colors.cardBg }]}>
                <Text style={{ color: form.tipo === t ? "#fff" : colors.primaryText, fontSize: 12 }}>{TYPE_LABEL[t]}</Text>
              </Pressable>
            ))}
          </View>
          {(["codigo", "descripcion", "base_minima_uvt", "tarifa", "cuenta"] as const).map((key) => (
            <TextInput
              key={key}
              style={[styles.inputInline, { borderColor: colors.border, color: colors.primaryText, marginBottom: 8 }]}
              value={form[key]}
              onChangeText={(v) => setForm((f) => ({ ...f, [key]: v }))}
              placeholder={key}
              placeholderTextColor={colors.textMuted}
              keyboardType={key === "base_minima_uvt" || key === "tarifa" ? "numeric" : "default"}
            />
          ))}
          <Pressable style={[styles.smallBtn, { backgroundColor: colors.headerAccent, opacity: saving ? 0.7 : 1 }]} disabled={saving} onPress={() => void onSaveConcept()}>
            <Text style={{ color: "#fff", fontWeight: "700" }}>{saving ? "Guardando…" : "Guardar"}</Text>
          </Pressable>
          <Pressable style={{ marginTop: 12, alignItems: "center" }} onPress={() => setModalOpen(false)}>
            <Text style={{ color: colors.textMuted }}>Cancelar</Text>
          </Pressable>
        </ScrollView>
      </Modal>
    </>
  );
}

function RolesSection() {
  const colors = useThemeColors();
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await getRoles();
      setRoles(r.roles);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const onSeed = async () => {
    try {
      const r = await seedDefaultRoles();
      successToast(r.message);
      await load();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error");
    }
  };

  if (loading) return <LoadingScreen />;

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <LedgerPrimaryBtn label="Sembrar roles por defecto" onPress={onSeed} />
      {roles.map((r) => (
        <View key={r._id} style={[styles.rowCard, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
          <Text style={{ color: colors.primary, fontWeight: "600" }}>{r.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{r.permissions.length} permiso(s)</Text>
        </View>
      ))}
    </ScrollView>
  );
}

const IVA_OPTIONS: { value: IvaPeriodicidad; label: string }[] = [
  { value: "bimestral", label: "Bimestral" },
  { value: "cuatrimestral", label: "Cuatrimestral" },
  { value: "no_responsable", label: "No responsable IVA" },
];

const TAX_FLAGS: { key: keyof TaxProfile; label: string }[] = [
  { key: "agente_retencion", label: "Agente de retención" },
  { key: "gran_contribuyente", label: "Gran contribuyente" },
  { key: "responsable_iva", label: "Responsable de IVA" },
  { key: "declara_reteica", label: "Declara ReteICA" },
  { key: "declara_ica", label: "Declara ICA propio" },
  { key: "autorretenedor_renta", label: "Autorretenedor de renta" },
  { key: "declara_renta", label: "Obligado a declarar renta" },
  { key: "presenta_exogena", label: "Información exógena" },
  { key: "regimen_simple", label: "Régimen Simple (RST)" },
];

function TaxProfileSection() {
  const colors = useThemeColors();
  const [profile, setProfile] = useState<TaxProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getTaxProfile()
      .then((r) => setProfile(r.profile))
      .catch((e) => errorToast(e instanceof Error ? e.message : "No se pudo cargar el perfil"))
      .finally(() => setLoading(false));
  }, []);

  const setFlag = (key: keyof TaxProfile, value: boolean) => {
    setProfile((p) => (p ? { ...p, [key]: value } : p));
  };

  const onSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const r = await updateTaxProfile(profile);
      setProfile(r.profile);
      successToast("Perfil tributario guardado");
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !profile) return <LoadingScreen />;

  const periodicidad = profile.iva_periodicidad ?? "cuatrimestral";

  return (
    <ScrollView contentContainerStyle={styles.pad}>
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>Periodicidad de IVA</Text>
      <View style={styles.chipRow}>
        {IVA_OPTIONS.map((opt) => {
          const active = periodicidad === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => setProfile((p) => (p ? { ...p, iva_periodicidad: opt.value, iva_periodicidad_manual: true } : p))}
              style={[
                styles.chip,
                {
                  borderColor: active ? colors.accent : colors.border,
                  backgroundColor: active ? colors.bgSubtle : colors.cardBg,
                },
              ]}
            >
              <Text style={{ color: active ? colors.primary : colors.textMuted, fontSize: 13 }}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 8 }]}>Obligaciones DIAN</Text>
      {TAX_FLAGS.map((f) => (
        <View
          key={String(f.key)}
          style={[styles.switchRow, { borderColor: colors.border, backgroundColor: colors.cardBg }, getSoftCardShadow()]}
        >
          <Text style={{ color: colors.primary, flex: 1 }}>{f.label}</Text>
          <Switch
            value={!!profile[f.key]}
            onValueChange={(v) => setFlag(f.key, v)}
            trackColor={{ true: colors.accent }}
          />
        </View>
      ))}

      <LedgerPrimaryBtn label={saving ? "Guardando…" : "Guardar perfil"} onPress={onSave} loading={saving} />
    </ScrollView>
  );
}

const ACCION_LABEL: Record<AuditEntry["accion"], string> = {
  create: "Creó",
  update: "Editó",
  delete: "Eliminó",
  post: "Contabilizó",
  annul: "Anuló",
  send: "Envió",
};

const ENTIDAD_LABEL: Record<AuditEntry["entidad"], string> = {
  factura: "Factura",
  compra: "Compra",
  asiento: "Comprobante",
  nomina: "Nómina",
  tercero: "Tercero",
  pago: "Pago",
  otro: "Otro",
};

function AuditLogSection() {
  const colors = useThemeColors();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getAudit({ page, limit: 20 });
      setItems(res.items);
      setTotalPages(res.pagination.totalPages);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar auditoría");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  if (loading && items.length === 0) return <LoadingScreen />;

  return (
    <View style={{ flex: 1 }}>
      {loading ? <ActivityIndicator style={{ marginTop: 12 }} color={colors.accent} /> : null}
      <ScrollView contentContainerStyle={styles.pad}>
        {items.length === 0 ? (
          <Text style={{ color: colors.textMuted, textAlign: "center" }}>Sin registros de auditoría</Text>
        ) : (
          items.map((row) => (
            <View key={row._id} style={[styles.rowCard, { backgroundColor: colors.cardBg, borderColor: colors.border, flexDirection: "column", alignItems: "flex-start" }, getSoftCardShadow()]}>
              <Text style={{ color: colors.primary, fontWeight: "600" }}>
                {ACCION_LABEL[row.accion]} · {ENTIDAD_LABEL[row.entidad]}
              </Text>
              <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>
                {row.usuario ?? "—"} · {row.fecha ? new Date(row.fecha).toLocaleString("es-CO") : "—"}
              </Text>
              {(row.referencia || row.descripcion) ? (
                <Text style={{ color: colors.textMuted, fontSize: 13, marginTop: 4 }} numberOfLines={2}>
                  {row.referencia || row.descripcion}
                </Text>
              ) : null}
            </View>
          ))
        )}
        {totalPages > 1 ? (
          <View style={styles.pager}>
            <Pressable disabled={page <= 1} onPress={() => setPage((p) => p - 1)}>
              <Text style={{ color: page <= 1 ? colors.textMuted : colors.primary }}>Anterior</Text>
            </Pressable>
            <Text style={{ color: colors.textMuted }}>{page}/{totalPages}</Text>
            <Pressable disabled={page >= totalPages} onPress={() => setPage((p) => p + 1)}>
              <Text style={{ color: page >= totalPages ? colors.textMuted : colors.primary }}>Siguiente</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

type Props = { section: ConfigurationSection };

export default function ConfigurationAccountingNative({ section }: Props) {
  switch (section) {
    case "cuentas":
      return <DefaultAccountsSection />;
    case "consecutivos":
      return <SequencesSection />;
    case "centros":
      return <CostCentersSection />;
    case "puc":
      return <PucSection />;
    case "impuestos":
      return <TaxesSection />;
    case "roles":
      return <RolesSection />;
    case "perfil_tributario":
      return <TaxProfileSection />;
    case "auditoria":
      return <AuditLogSection />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32, gap: 12 },
  field: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 4 },
  label: { fontSize: 12, marginBottom: 6 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  smallBtn: { marginTop: 10, paddingVertical: 10, paddingHorizontal: 12, borderRadius: SHELL_RADIUS.button, alignItems: "center" },
  toolRow: { flexDirection: "row", gap: 8, alignItems: "center", marginHorizontal: 16, marginTop: 8, flexWrap: "wrap" },
  inputInline: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  rowCard: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12 },
  searchRow: { marginHorizontal: 16, marginTop: 8, paddingHorizontal: 12, borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem },
  pager: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 12 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 12, paddingVertical: 8 },
  switchRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, marginBottom: 8, flexDirection: "row", alignItems: "center" },
});

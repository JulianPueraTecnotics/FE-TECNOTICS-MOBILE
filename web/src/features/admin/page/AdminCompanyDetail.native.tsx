import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import NativePagination from "../../../components/native/list/NativePagination.native";
import { DsButton, DsField, DsModuleScreen, DsSideModal } from "../../../components/design-system-native";
import { PATHS } from "../../../router/paths.contants";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import {
  adminGetCompany,
  adminGetCompanySubscription,
  adminListCompanyClients,
  adminListCompanyInvoices,
  adminListCompanyItems,
  adminListCompanySubUsers,
  adminResetCompanyPassword,
  adminSetCompanyActive,
  adminUpdateCompany,
  type AdminClient,
  type AdminCompanyDetail,
  type AdminInvoice,
  type AdminItem,
  type AdminSubUser,
} from "../services/admin_companies.service";
import type { CompanySubscriptionResponse } from "../../profile/page/services/get_subscription";

type Tab = "info" | "sub" | "users" | "facturas" | "clientes" | "items";

const formatDate = (v?: string) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO");
};

const formatCOP = (n: number) =>
  (n || 0).toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });

export default function AdminCompanyDetailNative() {
  const colors = useThemeColors();
  const navigate = useNavigate();
  const { companyId = "" } = useParams();
  const [detail, setDetail] = useState<AdminCompanyDetail | null>(null);
  const [sub, setSub] = useState<CompanySubscriptionResponse | null>(null);
  const [subusers, setSubusers] = useState<AdminSubUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("info");

  const [invoices, setInvoices] = useState<AdminInvoice[]>([]);
  const [invPage, setInvPage] = useState(1);
  const [invPages, setInvPages] = useState(1);
  const [clients, setClients] = useState<AdminClient[]>([]);
  const [cliPage, setCliPage] = useState(1);
  const [cliPages, setCliPages] = useState(1);
  const [items, setItems] = useState<AdminItem[]>([]);
  const [itPage, setItPage] = useState(1);
  const [itPages, setItPages] = useState(1);
  const [listLoading, setListLoading] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWebsite, setEditWebsite] = useState("");
  const [editObs, setEditObservations] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    if (!companyId) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const [d, s, u] = await Promise.all([
        adminGetCompany(companyId),
        adminGetCompanySubscription(companyId).catch(() => null),
        adminListCompanySubUsers(companyId).catch(() => []),
      ]);
      setDetail(d);
      setSub(s);
      setSubusers(Array.isArray(u) ? u : []);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar empresa");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [companyId]);

  useEffect(() => {
    void load();
  }, [load]);

  const loadTabData = useCallback(async () => {
    if (!companyId) return;
    setListLoading(true);
    try {
      if (tab === "facturas") {
        const r = await adminListCompanyInvoices(companyId, invPage);
        setInvoices(r.items);
        setInvPages(r.pages);
      } else if (tab === "clientes") {
        const r = await adminListCompanyClients(companyId, cliPage);
        setClients(r.items);
        setCliPages(r.pages);
      } else if (tab === "items") {
        const r = await adminListCompanyItems(companyId, itPage);
        setItems(r.items);
        setItPages(r.pages);
      }
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al cargar listado");
    } finally {
      setListLoading(false);
    }
  }, [companyId, tab, invPage, cliPage, itPage]);

  useEffect(() => {
    if (tab === "facturas" || tab === "clientes" || tab === "items") void loadTabData();
  }, [loadTabData, tab]);

  const toggleActive = () => {
    if (!detail) return;
    const next = !detail.company.active;
    Alert.alert(next ? "Activar empresa" : "Desactivar empresa", detail.company.razon_social, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Confirmar",
        onPress: async () => {
          try {
            await adminSetCompanyActive(companyId, next);
            successToast(next ? "Empresa activada" : "Empresa desactivada");
            await load(true);
          } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error");
          }
        },
      },
    ]);
  };

  const openEdit = () => {
    const c = detail?.company;
    if (!c) return;
    setEditPhone(c.phone ?? "");
    setEditEmail(c.email ?? "");
    setEditWebsite(c.website ?? "");
    setEditObservations(c.observations ?? "");
    setEditOpen(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      await adminUpdateCompany(companyId, {
        phone: editPhone.trim() || undefined,
        email: editEmail.trim() || undefined,
        website: editWebsite.trim() || undefined,
        observations: editObs.trim() || undefined,
      });
      successToast("Empresa actualizada");
      setEditOpen(false);
      await load(true);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "No se pudo actualizar");
    } finally {
      setSaving(false);
    }
  };

  const resetPassword = () => {
    Alert.prompt?.(
      "Restablecer contraseña",
      "Nueva contraseña para la empresa",
      async (pwd) => {
        if (!pwd?.trim()) return;
        try {
          await adminResetCompanyPassword(companyId, pwd.trim());
          successToast("Contraseña actualizada");
        } catch (e) {
          errorToast(e instanceof Error ? e.message : "Error");
        }
      },
    );
    if (!Alert.prompt) {
      Alert.alert("Restablecer contraseña", "Usa la versión web del panel admin para esta acción avanzada.");
    }
  };

  if (!loading && !detail) {
    return (
      <DsModuleScreen title="Empresa" subtitle="No encontrada">
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>Empresa no encontrada</Text>
      </DsModuleScreen>
    );
  }

  const c = detail?.company;
  const stats = detail?.stats;
  const tabs: { key: Tab; label: string }[] = [
    { key: "info", label: "Datos" },
    { key: "sub", label: "Suscripción" },
    { key: "users", label: "Usuarios" },
    { key: "facturas", label: "Facturas" },
    { key: "clientes", label: "Clientes" },
    { key: "items", label: "Ítems" },
  ];

  return (
    <>
      <DsModuleScreen
        title={c?.razon_social ?? "Empresa"}
        subtitle={c?.email ?? undefined}
        loading={loading}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        noScroll
        headerActions={
          <>
            <Pressable onPress={() => navigate(PATHS.ADMIN_HOME)} hitSlop={8}>
              <Ionicons name="arrow-back" size={22} color={colors.primary} />
            </Pressable>
            {c ? (
              <DsButton variant="secondary" label={c.active ? "Desactivar" : "Activar"} compact onPress={toggleActive} />
            ) : null}
          </>
        }
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabs}
        >
          {tabs.map((t) => (
            <Pressable
              key={t.key}
              onPress={() => setTab(t.key)}
              style={[
                styles.tab,
                tab === t.key
                  ? { backgroundColor: colors.headerAccent }
                  : { borderColor: colors.border, borderWidth: 1 },
              ]}
            >
              <Text style={{ color: tab === t.key ? "#fff" : colors.primaryText, fontWeight: "600", fontSize: 13 }}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
          {tab === "info" && c ? (
            <>
              <View style={{ flexDirection: "row", gap: 8, marginBottom: 12 }}>
                <DsButton label="Editar" icon="create-outline" compact onPress={openEdit} />
                <DsButton label="Reset clave" variant="secondary" icon="key-outline" compact onPress={resetPassword} />
              </View>
              <InfoRow label="NIT" value={`${c.doc_number || "—"}${c.doc_number_dv ? `-${c.doc_number_dv}` : ""}`} colors={colors} />
              <InfoRow label="Email" value={c.email} colors={colors} />
              <InfoRow label="Teléfono" value={c.phone} colors={colors} />
              <InfoRow label="Web" value={c.website} colors={colors} />
              <InfoRow label="Dirección" value={c.address?.value} colors={colors} />
              <InfoRow label="Estado" value={c.active ? "Activa" : "Inactiva"} colors={colors} />
              {c.observations ? <InfoRow label="Observaciones" value={c.observations} colors={colors} /> : null}
              {stats ? (
                <View style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }, getSoftCardShadow()]}>
                  <Text style={{ color: colors.primary, fontWeight: "700", marginBottom: 8 }}>Estadísticas</Text>
                  <Text style={{ color: colors.textMuted }}>
                    {stats.facturas} facturas · {stats.clientes} clientes · {stats.items} ítems · {stats.prefijos} prefijos
                  </Text>
                </View>
              ) : null}
            </>
          ) : null}

          {tab === "sub" ? (
            sub ? (
              <>
                <InfoRow label="Plan" value={sub.plan?.title} colors={colors} />
                <InfoRow label="Estado" value={sub.suscription?.status} colors={colors} />
                <InfoRow label="Inicio" value={formatDate(String(sub.suscription?.start_date ?? ""))} colors={colors} />
                <InfoRow label="Vence" value={formatDate(String(sub.suscription?.end_date ?? ""))} colors={colors} />
                <InfoRow label="Documentos" value={`${sub.used_documents ?? sub.suscription?.used_documents ?? 0} / ${sub.suscription?.total_documents ?? "—"}`} colors={colors} />
                <InfoRow label="Precio" value={sub.suscription?.price ? formatCOP(Number(sub.suscription.price)) : "—"} colors={colors} />
              </>
            ) : (
              <Text style={{ color: colors.textMuted }}>Sin suscripción activa</Text>
            )
          ) : null}

          {tab === "users" ? (
            subusers.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin sub-usuarios</Text>
            ) : (
              subusers.map((u) => (
                <View key={u._id} style={[styles.card, { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
                  <Text style={{ color: colors.primary, fontWeight: "600" }}>
                    {u.name} {u.last_name}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{u.email}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 12, marginTop: 4 }}>{u.active ? "Activo" : "Inactivo"}</Text>
                </View>
              ))
            )
          ) : null}

          {tab === "facturas" ? (
            listLoading ? (
              <Text style={{ color: colors.textMuted }}>Cargando…</Text>
            ) : invoices.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin facturas</Text>
            ) : (
              <>
                {invoices.map((inv) => (
                  <View key={inv._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                    <Text style={{ fontWeight: "700", color: colors.primaryText }}>{inv.number}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{inv.client}</Text>
                    <Text style={{ color: colors.primaryText }}>{formatCOP(inv.total)} · {inv.status}{inv.is_draft ? " (borrador)" : ""}</Text>
                  </View>
                ))}
                <NativePagination page={invPage} totalPages={invPages} loading={listLoading} onChange={setInvPage} />
              </>
            )
          ) : null}

          {tab === "clientes" ? (
            listLoading ? (
              <Text style={{ color: colors.textMuted }}>Cargando…</Text>
            ) : clients.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin clientes</Text>
            ) : (
              <>
                {clients.map((cl) => (
                  <View key={cl._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                    <Text style={{ fontWeight: "700", color: colors.primaryText }}>{cl.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{cl.doc_number} · {cl.email}</Text>
                  </View>
                ))}
                <NativePagination page={cliPage} totalPages={cliPages} loading={listLoading} onChange={setCliPage} />
              </>
            )
          ) : null}

          {tab === "items" ? (
            listLoading ? (
              <Text style={{ color: colors.textMuted }}>Cargando…</Text>
            ) : items.length === 0 ? (
              <Text style={{ color: colors.textMuted }}>Sin ítems</Text>
            ) : (
              <>
                {items.map((it) => (
                  <View key={it._id} style={[styles.card, { borderColor: colors.border, backgroundColor: colors.cardBg }]}>
                    <Text style={{ fontWeight: "700", color: colors.primaryText }}>{it.name}</Text>
                    <Text style={{ color: colors.textMuted, fontSize: 13 }}>{it.code} · {it.kind}</Text>
                    <Text style={{ color: colors.primaryText }}>{it.price != null ? formatCOP(it.price) : "—"}</Text>
                  </View>
                ))}
                <NativePagination page={itPage} totalPages={itPages} loading={listLoading} onChange={setItPage} />
              </>
            )
          ) : null}
        </ScrollView>
      </DsModuleScreen>

      <DsSideModal
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Editar empresa"
        icon="business-outline"
        onSubmit={() => void saveEdit()}
        submitLabel="Guardar"
        submitting={saving}
        closeDisabled={saving}
      >
        {(
          [
            { label: "Email", value: editEmail, set: setEditEmail, icon: "mail-outline", keyboardType: "email-address" },
            { label: "Teléfono", value: editPhone, set: setEditPhone, icon: "call-outline", keyboardType: "phone-pad" },
            { label: "Sitio web", value: editWebsite, set: setEditWebsite, icon: "globe-outline", keyboardType: "url" },
            { label: "Observaciones", value: editObs, set: setEditObservations, icon: "document-text-outline", multiline: true },
          ] as const
        ).map((f) => (
          <DsField
            key={f.label}
            label={f.label}
            icon={f.icon}
            value={f.value}
            onChangeText={f.set}
            keyboardType={"keyboardType" in f ? f.keyboardType : undefined}
            autoCapitalize="none"
            multiline={"multiline" in f ? f.multiline : undefined}
          />
        ))}
      </DsSideModal>
    </>
  );
}

function InfoRow({ label, value, colors }: { label: string; value?: string | null; colors: ReturnType<typeof useThemeColors> }) {
  return (
    <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
      <Text style={{ color: colors.textMuted, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: colors.primary, marginTop: 2 }}>{value || "—"}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tabsScroll: { flexGrow: 0, height: 52 },
  tabs: { paddingHorizontal: 12, paddingVertical: 8, gap: 8, alignItems: "center" },
  tab: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button, marginRight: 8 },
  card: { borderRadius: SHELL_RADIUS.card, borderWidth: 1, padding: 14, marginBottom: 10 },
  infoRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, marginBottom: 4 },
});

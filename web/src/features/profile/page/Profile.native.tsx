import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import LoadingScreen from "../../../router/LoadingScreen";
import { useThemeColors } from "../../../theme/useThemeColors";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import {
  getProfileService,
  type CompanyProfileResponse,
} from "./services/get_profile";
import {
  getSubscriptionService,
  type CompanySubscriptionResponse,
} from "./services/get_subscription";
import { updateLogoService } from "./services/update_logo";
import {
  PROFILE_MODE_SECTIONS,
  PROFILE_SECTION_LABELS,
  PAY_WINDOW_DAYS,
  SUBSCRIPTION_STATUS_LABELS,
  daysUntil,
  formatCurrencyCOP,
  formatLongDate,
  type ProfileSection,
} from "./profile.native.shared";
import BillingPrefixesNative from "../components/BillingPrefixes.native";

type Props = {
  mode?: "profile" | "configuration";
  embedded?: boolean;
  initialSection?: ProfileSection;
};

function ProfileCard({
  title,
  children,
  headerRight,
}: {
  title?: string;
  children: ReactNode;
  headerRight?: ReactNode;
}) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        getSoftCardShadow(colors),
        { backgroundColor: colors.cardBg, borderColor: colors.border },
      ]}
    >
      {title ? (
        <View style={styles.cardHeader}>
          <Text style={[styles.cardTitle, { color: colors.primary }]}>{title}</Text>
          {headerRight}
        </View>
      ) : null}
      {children}
    </View>
  );
}

function ReadOnlyField({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>{label}</Text>
      <View style={[styles.fieldValue, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
        <Text style={[styles.fieldText, { color: colors.primaryText }]}>{value || "N/A"}</Text>
      </View>
    </View>
  );
}

function StatusBadge({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={[styles.badge, active ? styles.badgeActive : styles.badgeInactive]}>
      <Text style={[styles.badgeText, active ? styles.badgeTextActive : styles.badgeTextInactive]}>
        {label}
      </Text>
    </View>
  );
}

function SubscriptionStatusBadge({ status }: { status: string }) {
  const style =
    status === "active"
      ? styles.subActive
      : status === "expired"
        ? styles.subExpired
        : styles.subInactive;
  return (
    <View style={[styles.subBadge, style]}>
      <Text style={styles.subBadgeText}>{SUBSCRIPTION_STATUS_LABELS[status] ?? status}</Text>
    </View>
  );
}

export default function ProfileNative({
  mode = "profile",
  embedded = false,
  initialSection,
}: Props) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const sections = PROFILE_MODE_SECTIONS[mode];
  const [activeSection, setActiveSection] = useState<ProfileSection>(
    initialSection && sections.includes(initialSection) ? initialSection : sections[0]
  );
  const [loading, setLoading] = useState(true);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [profile, setProfile] = useState<CompanyProfileResponse | null>(null);
  const [subscription, setSubscription] = useState<CompanySubscriptionResponse | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [profileData, subscriptionData] = await Promise.all([
        getProfileService(),
        getSubscriptionService().catch(() => null),
      ]);
      setProfile(profileData);
      setSubscription(subscriptionData);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al cargar el perfil");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialSection && sections.includes(initialSection)) {
      setActiveSection(initialSection);
    }
  }, [initialSection, sections]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const docNumber = useMemo(() => {
    if (!profile) return "N/A";
    const base = profile.company.doc_number || "";
    const dv = profile.company.doc_number_dv ? `-${profile.company.doc_number_dv}` : "";
    return `${base}${dv}` || "N/A";
  }, [profile]);

  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      errorToast("Se necesita permiso para acceder a la galería");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    const name = asset.fileName ?? `logo.${mime.split("/")[1] ?? "jpg"}`;

    setUploadingLogo(true);
    try {
      await updateLogoService({ uri: asset.uri, name, type: mime });
      successToast("Logo actualizado correctamente");
      await loadData();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al subir el logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  if (loading) {
    return <LoadingScreen />;
  }

  const renderConfigSection = (title: string, description: string) => (
    <ProfileCard title={title}>
      <Text style={[styles.portalText, { color: colors.textMuted }]}>{description}</Text>
      <Text style={[styles.portalText, { color: colors.textMuted, marginBottom: 0 }]}>
        Gestiona esta sección desde la app — misma API que el portal.
      </Text>
    </ProfileCard>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      {!embedded ? (
        <View style={[styles.pageHeader, { borderBottomColor: colors.border }]}>
          <Text style={[styles.pageTitle, { color: colors.primary }]}>
            {mode === "configuration" ? "Configuración" : "Mi Perfil"}
          </Text>
          <Text style={[styles.pageSubtitle, { color: colors.textMuted }]}>
            {mode === "configuration"
              ? "Configuración de facturación, documentos y eventos"
              : "Información de tu cuenta empresarial"}
          </Text>
        </View>
      ) : null}

      {!embedded ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {sections.map((section) => {
          const active = activeSection === section;
          return (
            <Pressable
              key={section}
              onPress={() => setActiveSection(section)}
              style={[
                styles.tab,
                active
                  ? { backgroundColor: colors.bgSubtle, borderColor: colors.accent }
                  : { borderColor: "transparent" },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: active ? colors.primary : colors.textMuted },
                  active ? styles.tabTextActive : null,
                ]}
              >
                {PROFILE_SECTION_LABELS[section]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.paddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {activeSection === "general" && (
          <>
            <ProfileCard>
              <View style={styles.logoSection}>
                <View style={[styles.logoCircle, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}>
                  {profile?.company.logo.url ? (
                    <Image source={{ uri: profile.company.logo.url }} style={styles.logoImage} />
                  ) : (
                    <Ionicons name="business-outline" size={40} color={colors.accent} />
                  )}
                </View>
                <Pressable
                  style={[styles.logoBtn, { borderColor: colors.accent }]}
                  onPress={() => void pickLogo()}
                  disabled={uploadingLogo}
                >
                  {uploadingLogo ? (
                    <ActivityIndicator color={colors.accent} />
                  ) : (
                    <>
                      <Ionicons name="cloud-upload-outline" size={18} color={colors.accent} />
                      <Text style={[styles.logoBtnText, { color: colors.accent }]}>Cambiar foto</Text>
                    </>
                  )}
                </Pressable>
              </View>

              <Text style={[styles.cardTitle, { color: colors.primary, marginBottom: 12 }]}>
                Información General
              </Text>
              <ReadOnlyField label="Razón Social" value={profile?.company.razon_social ?? "N/A"} />
              <ReadOnlyField label="Tipo de Documento" value={profile?.company.doc_type.value ?? "N/A"} />
              <ReadOnlyField label="Número de Documento" value={docNumber} />
              <View style={styles.field}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>Estado de Cuenta</Text>
                <StatusBadge
                  active={!!profile?.company.active}
                  label={profile?.company.active ? "Activa" : "Inactiva"}
                />
              </View>
            </ProfileCard>

            <ProfileCard
              title="Suscripción"
              headerRight={
                subscription?.suscription?.status ? (
                  <SubscriptionStatusBadge status={subscription.suscription.status} />
                ) : null
              }
            >
              {subscription ? (
                <>
                  <ReadOnlyField label="Plan" value={subscription.plan?.title ?? "N/A"} />
                  <ReadOnlyField
                    label="Fecha de inicio"
                    value={formatLongDate(subscription.suscription.start_date)}
                  />
                  <ReadOnlyField
                    label="Fecha de vencimiento"
                    value={formatLongDate(subscription.suscription.end_date)}
                  />
                  <ReadOnlyField
                    label="Documentos usados"
                    value={`${subscription.suscription.used_documents ?? 0} / ${subscription.suscription.total_documents ?? 0}`}
                  />
                  <ReadOnlyField
                    label="Valor del plan"
                    value={formatCurrencyCOP(subscription.suscription.total_price)}
                  />
                  <ReadOnlyField
                    label="Último pago"
                    value={formatLongDate(subscription.suscription.last_payment_date)}
                  />
                  {(() => {
                    const days = daysUntil(subscription.suscription.end_date);
                    if (days == null) return null;
                    const note =
                      days < 0
                        ? `Tu suscripción venció hace ${Math.abs(days)} día(s). Renueva para seguir facturando.`
                        : days <= PAY_WINDOW_DAYS
                          ? `Tu suscripción vence en ${days} día(s). Ya puedes renovar tu pago.`
                          : `El pago se habilita ${PAY_WINDOW_DAYS} días antes del vencimiento (${formatLongDate(subscription.suscription.end_date)}).`;
                    return (
                      <Text style={[styles.payNote, { color: colors.textMuted }]}>{note}</Text>
                    );
                  })()}
                  <Pressable
                    style={[styles.payBtn, { backgroundColor: colors.accent, opacity: 0.85 }]}
                    onPress={() =>
                      successToast(
                        "Renovación de suscripción disponible próximamente en la app móvil."
                      )
                    }
                  >
                    <Ionicons name="card-outline" size={18} color="#fff" />
                    <Text style={styles.payBtnText}>Pagar / Renovar suscripción</Text>
                  </Pressable>
                </>
              ) : (
                <Text style={[styles.portalText, { color: colors.textMuted }]}>
                  No se encontró una suscripción registrada para esta empresa.
                </Text>
              )}
            </ProfileCard>

            <ProfileCard title="Representante Legal">
              <ReadOnlyField
                label="Nombre Completo"
                value={profile?.company.legal_representative.name ?? "N/A"}
              />
              <ReadOnlyField
                label="Tipo de Documento"
                value={profile?.company.legal_representative.doc_type ?? "N/A"}
              />
              <ReadOnlyField
                label="Número de Documento"
                value={profile?.company.legal_representative.doc_number ?? "N/A"}
              />
            </ProfileCard>
          </>
        )}

        {activeSection === "contact-bank" && (
          <>
            <ProfileCard title="Información de contacto y banco">
              <ReadOnlyField label="Email" value={profile?.company.email ?? "N/A"} />
              <ReadOnlyField label="Teléfono" value={profile?.company.phone ?? "N/A"} />
              <ReadOnlyField label="Sitio Web" value={profile?.company.website ?? "N/A"} />
              <ReadOnlyField label="Dirección" value={profile?.company.address.value ?? "N/A"} />
              <ReadOnlyField label="País" value={profile?.company.address.pais_codigo ?? "N/A"} />
              <ReadOnlyField
                label="Departamento"
                value={profile?.company.address.departamento_codigo ?? "N/A"}
              />
              <ReadOnlyField label="Ciudad" value={profile?.company.address.ciudad_codigo ?? "N/A"} />
              <ReadOnlyField label="Código Postal" value={profile?.company.address.zip_code ?? "N/A"} />
            </ProfileCard>
            <ProfileCard title="Datos bancarios">
              <ReadOnlyField label="Banco" value={profile?.company.bank_account?.name ?? "N/A"} />
              <ReadOnlyField
                label="Número de cuenta"
                value={profile?.company.bank_account?.account_number ?? "N/A"}
              />
              <ReadOnlyField
                label="Tipo de cuenta"
                value={profile?.company.bank_account?.account_type ?? "N/A"}
              />
            </ProfileCard>
            <ProfileCard title="Observaciones">
              <ReadOnlyField label="Observaciones" value={profile?.company.observations ?? "—"} />
            </ProfileCard>
          </>
        )}

        {activeSection === "billing-config" ? (
          <BillingPrefixesNative embedded />
        ) : null}

        {activeSection === "documents" &&
          renderConfigSection(
            "Documentos de cuenta",
            "RUT, Cámara de Comercio, cédulas del representante legal y contrato de mandato."
          )}

        {activeSection === "events" &&
          renderConfigSection(
            "Consola de eventos",
            "Historial de eventos DIAN y trazabilidad de documentos electrónicos."
          )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pageHeader: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: { fontSize: 22, fontWeight: "700", marginBottom: 4 },
  pageSubtitle: { fontSize: 14, lineHeight: 20 },
  tabsScroll: { maxHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  tabsContent: { paddingHorizontal: 12, paddingVertical: 8, gap: 8 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    marginRight: 8,
  },
  tabText: { fontSize: 13, fontWeight: "500" },
  tabTextActive: { fontWeight: "700" },
  content: { padding: 16, gap: 14 },
  card: {
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 16,
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 8,
  },
  cardTitle: { fontSize: 17, fontWeight: "700" },
  logoSection: { alignItems: "center", marginBottom: 20 },
  logoCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    marginBottom: 12,
  },
  logoImage: { width: "100%", height: "100%" },
  logoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
  },
  logoBtnText: { fontSize: 14, fontWeight: "600" },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  fieldValue: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  fieldText: { fontSize: 14, fontWeight: "500" },
  badge: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  badgeActive: { backgroundColor: "#dcfce7" },
  badgeInactive: { backgroundColor: "#fee2e2" },
  badgeText: { fontSize: 13, fontWeight: "700" },
  badgeTextActive: { color: "#166534" },
  badgeTextInactive: { color: "#991b1b" },
  subBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
  },
  subActive: { backgroundColor: "#dcfce7" },
  subInactive: { backgroundColor: "#fef3c7" },
  subExpired: { backgroundColor: "#fee2e2" },
  subBadgeText: { fontSize: 12, fontWeight: "700", color: "#92400e" },
  payNote: { fontSize: 13, lineHeight: 19, marginTop: 4, marginBottom: 12 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: SHELL_RADIUS.button,
  },
  payBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  portalText: { fontSize: 14, lineHeight: 21, marginBottom: 14 },
  portalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 13,
    borderRadius: SHELL_RADIUS.button,
  },
  portalBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

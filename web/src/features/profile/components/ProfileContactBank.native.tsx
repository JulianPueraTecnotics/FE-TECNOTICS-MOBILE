import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
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
} from "../page/services/get_profile";
import {
  updateCompanyInfoService,
  type UpdateCompanyInfoBody,
} from "../page/services/update_company_info";

function Field({
  label,
  value,
  onChangeText,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  keyboardType?: "default" | "phone-pad" | "email-address" | "url";
  multiline?: boolean;
}) {
  const colors = useThemeColors();
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.multiline,
          { backgroundColor: colors.bgSubtle, borderColor: colors.border, color: colors.primaryText },
        ]}
        value={value}
        onChangeText={onChangeText}
        keyboardType={keyboardType}
        multiline={multiline}
        placeholderTextColor={colors.textMuted}
      />
    </View>
  );
}

export default function ProfileContactBankNative({
  profile: initialProfile,
  onSaved,
}: {
  profile: CompanyProfileResponse | null;
  onSaved?: () => void;
}) {
  const colors = useThemeColors();
  const [profile, setProfile] = useState(initialProfile);
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountType, setAccountType] = useState<"ahorro" | "corriente">("ahorro");
  const [observations, setObservations] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setProfile(initialProfile);
    if (!initialProfile) return;
    const c = initialProfile.company;
    setPhone(c.phone ?? "");
    setWebsite(c.website ?? "");
    setAddress(c.address?.value ?? "");
    setZip(c.address?.zip_code ?? "");
    setBankName(c.bank_account?.name ?? "");
    setAccountNumber(c.bank_account?.account_number ?? "");
    setAccountType(c.bank_account?.account_type ?? "ahorro");
    setObservations(c.observations ?? "");
  }, [initialProfile]);

  const onSave = async () => {
    if (!profile) return;
    setSaving(true);
    try {
      const body: UpdateCompanyInfoBody = {
        phone: phone.replace(/\D/g, ""),
        website: website.trim(),
        address: {
          value: address.trim(),
          ciudad_codigo: profile.company.address.ciudad_codigo,
          departamento_codigo: profile.company.address.departamento_codigo,
          pais_codigo: profile.company.address.pais_codigo,
          zip_code: zip.trim(),
        },
        bank_account: {
          name: bankName.trim(),
          account_number: accountNumber.trim(),
          account_type: accountType,
        },
        observations: observations.trim(),
      };
      await updateCompanyInfoService(body);
      successToast("Información actualizada correctamente");
      const fresh = await getProfileService();
      setProfile(fresh);
      onSaved?.();
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  const fillObservations = async () => {
    if (!bankName.trim() || !accountNumber.trim()) {
      errorToast("Indica banco y número de cuenta.");
      return;
    }
    const typeLabel = accountType === "corriente" ? "Corriente" : "Ahorro";
    const text = `Favor consignar a ${bankName.trim()} ${typeLabel} con número de cuenta ${accountNumber.trim()}`;
    setObservations(text);
  };

  if (!profile) {
    return <ActivityIndicator style={{ marginTop: 24 }} color={colors.headerAccent} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
      <Text style={[styles.sectionTitle, { color: colors.primary }]}>Información de contacto</Text>
      <View style={styles.field}>
        <Text style={[styles.label, { color: colors.textMuted }]}>Email (solo lectura)</Text>
        <View style={[styles.input, { backgroundColor: colors.bgSubtle, borderColor: colors.border, justifyContent: "center" }]}>
          <Text style={{ color: colors.primaryText }}>{profile.company.email ?? "N/A"}</Text>
        </View>
      </View>
      <Field label="Teléfono" value={phone} onChangeText={(v) => setPhone(v.replace(/\D/g, ""))} keyboardType="phone-pad" />
      <Field label="Sitio Web" value={website} onChangeText={setWebsite} keyboardType="url" />
      <Field label="Dirección" value={address} onChangeText={setAddress} multiline />

      <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 16 }]}>Datos bancarios</Text>
      <Field label="Banco" value={bankName} onChangeText={setBankName} />
      <Field label="Número de cuenta" value={accountNumber} onChangeText={setAccountNumber} keyboardType="phone-pad" />
      <View style={styles.typeRow}>
        {(["ahorro", "corriente"] as const).map((t) => (
          <Pressable
            key={t}
            onPress={() => setAccountType(t)}
            style={[
              styles.typeChip,
              {
                borderColor: colors.border,
                backgroundColor: accountType === t ? colors.headerAccent : colors.cardBg,
              },
            ]}
          >
            <Text style={{ color: accountType === t ? "#fff" : colors.primaryText, fontWeight: "600" }}>
              {t === "ahorro" ? "Ahorro" : "Corriente"}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 16 }]}>Observaciones</Text>
      <Field label="Observaciones en facturas" value={observations} onChangeText={setObservations} multiline />
      <Pressable onPress={() => void fillObservations()} style={styles.linkBtn}>
        <Text style={{ color: colors.headerAccent, fontWeight: "600" }}>Autocompletar con datos bancarios</Text>
      </Pressable>

      <Pressable
        style={[styles.saveBtn, { backgroundColor: colors.headerAccent, opacity: saving ? 0.7 : 1 }]}
        disabled={saving}
        onPress={() => void onSave()}
      >
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveText}>Guardar cambios</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: 24, gap: 4 },
  sectionTitle: { fontSize: 16, fontWeight: "700", marginBottom: 8 },
  field: { marginBottom: 10 },
  label: { fontSize: 12, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.button,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  multiline: { minHeight: 72, textAlignVertical: "top" },
  readOnlyNote: { fontSize: 11, marginBottom: 8, marginTop: -4 },
  typeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  typeChip: { borderWidth: 1, borderRadius: SHELL_RADIUS.button, paddingHorizontal: 14, paddingVertical: 8 },
  linkBtn: { marginBottom: 12 },
  saveBtn: { paddingVertical: 14, borderRadius: SHELL_RADIUS.button, alignItems: "center", marginTop: 8 },
  saveText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});

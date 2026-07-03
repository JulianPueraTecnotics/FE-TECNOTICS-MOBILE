import { Ionicons } from "@expo/vector-icons";
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { errorToast } from "../../../components/shared/toast/toasts";
import type { CompanyProfileResponse } from "../page/services/get_profile";

type DocKey = "rut" | "camara_comercio" | "cedula_front" | "cedula_back" | "contrato_mandato";

const DOC_ITEMS: { key: DocKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "rut", label: "RUT", icon: "document-text-outline" },
  { key: "camara_comercio", label: "Cámara de Comercio", icon: "document-text-outline" },
  { key: "cedula_front", label: "Cédula Frontal", icon: "image-outline" },
  { key: "cedula_back", label: "Cédula Posterior", icon: "image-outline" },
  { key: "contrato_mandato", label: "Contrato Mandato", icon: "document-text-outline" },
];

function resolveDocUrl(profile: CompanyProfileResponse | null, key: DocKey): string | null {
  const docs = profile?.companyDocuments;
  if (!docs) return null;
  if (key === "contrato_mandato") return docs.contrato_mandato ?? null;
  const entry = docs[key];
  return entry?.url ?? null;
}

async function openDocument(url: string) {
  try {
    const supported = await Linking.canOpenURL(url);
    if (!supported) {
      errorToast("No se puede abrir este documento en el dispositivo.");
      return;
    }
    await Linking.openURL(url);
  } catch {
    errorToast("No se pudo abrir el documento.");
  }
}

export default function ProfileDocumentsNative({ profile }: { profile: CompanyProfileResponse | null }) {
  const colors = useThemeColors();

  if (!profile?.companyDocuments) {
    return (
      <Text style={[styles.empty, { color: colors.textMuted }]}>
        Esta empresa no tiene documentos de cuenta cargados.
      </Text>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.wrap}>
      {DOC_ITEMS.map((item) => {
        const url = resolveDocUrl(profile, item.key);
        return (
          <Pressable
            key={item.key}
            disabled={!url}
            onPress={() => {
              if (!url) return;
              void openDocument(url);
            }}
            style={[
              styles.row,
              getSoftCardShadow(colors),
              {
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                opacity: url ? 1 : 0.5,
              },
            ]}
          >
            <Ionicons name={item.icon} size={22} color={colors.headerAccent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.label, { color: colors.primaryText }]}>{item.label}</Text>
              <Text style={[styles.hint, { color: colors.textMuted }]}>
                {url ? "Toca para abrir" : "No cargado"}
              </Text>
            </View>
            {url ? <Ionicons name="open-outline" size={18} color={colors.textMuted} /> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10, paddingBottom: 8 },
  empty: { fontSize: 14, lineHeight: 20 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.card,
    padding: 14,
  },
  label: { fontSize: 15, fontWeight: "600" },
  hint: { fontSize: 12, marginTop: 2 },
});

import { Ionicons } from "@expo/vector-icons";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useLocation, useNavigate } from "react-router-dom";
import { PATHS } from "../../router/paths.contants";
import { useThemeColors } from "../../theme/useThemeColors";
import { useNativePrivateInsets } from "../mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../mobile/shellStyles.native";
import {
  getModuleScreenConfig,
  getSiblingModules,
  MODULE_SCREEN_REGISTRY,
} from "./moduleScreens.native";

type Props = {
  overridePath?: string;
  overrideTitle?: string;
  overrideDescription?: string;
};

/** Pantalla nativa del módulo — misma API/backend que el portal, sin abrir el navegador. */
export default function NativeModuleScreen({
  overridePath,
  overrideTitle,
  overrideDescription,
}: Props) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const effectivePath = overridePath ?? pathname;
  const effectiveSearch = overridePath ? "" : search;
  const module = getModuleScreenConfig(effectivePath, effectiveSearch);
  const siblings = getSiblingModules(effectivePath, effectiveSearch);
  const title = overrideTitle ?? module.title;
  const description = overrideDescription ?? module.description;

  const goToModule = (path: string) => {
    const [base, query] = path.split("?");
    if (query) {
      navigate({ pathname: base, search: `?${query}` });
      return;
    }
    navigate(path);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.pageBg }}
      contentContainerStyle={[styles.scroll, { paddingBottom: insets.paddingBottom }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={[styles.hero, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
        <View style={[styles.iconCircle, { backgroundColor: colors.cardBg }]}>
          <Ionicons name={module.icon} size={32} color={colors.accent} />
        </View>
        <Text style={[styles.section, { color: colors.accent }]}>{module.section}</Text>
        <Text style={[styles.title, { color: colors.primary }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      </View>

      <View
        style={[
          styles.card,
          getSoftCardShadow(colors),
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.primaryText }]}>Qué puedes hacer aquí</Text>
        {module.highlights.map((item) => (
          <View key={item} style={styles.bulletRow}>
            <Ionicons name="checkmark-circle" size={18} color={colors.accent} />
            <Text style={[styles.bulletText, { color: colors.primaryText }]}>{item}</Text>
          </View>
        ))}
      </View>

      <View
        style={[
          styles.infoCard,
          getSoftCardShadow(colors),
          { backgroundColor: colors.cardBg, borderColor: colors.border },
        ]}
      >
        <Ionicons name="cloud-outline" size={22} color={colors.accent} />
        <Text style={[styles.infoText, { color: colors.textMuted }]}>
          Este módulo usa la misma conexión al backend que el portal web. La interfaz nativa completa
          se irá habilitando módulo a módulo dentro de la app.
        </Text>
      </View>

      <Pressable
        style={[styles.secondaryBtn, { borderColor: colors.border }]}
        onPress={() => navigate(PATHS.DASHBOARD)}
      >
        <Ionicons name="home-outline" size={18} color={colors.accent} />
        <Text style={[styles.secondaryBtnText, { color: colors.accent }]}>Volver al inicio</Text>
      </Pressable>

      {siblings.length > 0 && !overridePath ? (
        <>
          <Text style={[styles.relatedTitle, { color: colors.primary }]}>
            Más en {module.section}
          </Text>
          <View style={styles.relatedGrid}>
            {siblings.map((sib) => {
              const path = [...MODULE_SCREEN_REGISTRY.entries()].find(
                ([, cfg]) => cfg.title === sib.title
              )?.[0];
              if (!path) return null;
              return (
                <Pressable
                  key={path}
                  style={[
                    styles.relatedItem,
                    getSoftCardShadow(colors),
                    { backgroundColor: colors.cardBg, borderColor: colors.border },
                  ]}
                  onPress={() => goToModule(path)}
                >
                  <Ionicons name={sib.icon} size={20} color={colors.accent} />
                  <Text
                    style={[styles.relatedLabel, { color: colors.primaryText }]}
                    numberOfLines={2}
                  >
                    {sib.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingTop: 8 },
  hero: {
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 20,
    alignItems: "center",
    marginBottom: 16,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  section: {
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 10,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  card: {
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
    gap: 10,
  },
  cardTitle: { fontSize: 15, fontWeight: "700", marginBottom: 4 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
  infoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: SHELL_RADIUS.menuItem,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  infoText: { flex: 1, fontSize: 14, lineHeight: 21 },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: SHELL_RADIUS.button,
    borderWidth: 1,
    marginBottom: 20,
  },
  secondaryBtnText: { fontWeight: "600", fontSize: 15 },
  relatedTitle: { fontSize: 16, fontWeight: "700", marginBottom: 10 },
  relatedGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  relatedItem: {
    width: "48%",
    flexGrow: 1,
    minWidth: "46%",
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.menuItem,
    padding: 12,
    gap: 8,
    minHeight: 72,
  },
  relatedLabel: { fontSize: 13, fontWeight: "600" },
});

import { Ionicons } from "@expo/vector-icons";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useTheme } from "../../../store/theme.context";
import { useThemeColors } from "../../../theme/useThemeColors";

type Props = {
  previewUri: string | null;
  hasFile: boolean;
  error?: string;
  onPress: () => void;
};

export default function LogoUploadNative({ previewUri, hasFile, error, onPress }: Props) {
  const colors = useThemeColors();
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const circleBorder = error
    ? "#ef4444"
    : isDark
      ? "rgba(90, 159, 180, 0.35)"
      : "#dee2e6";
  const circleBg = isDark ? "rgba(0, 24, 40, 0.9)" : "rgba(248, 250, 252, 0.95)";

  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [
          styles.circle,
          {
            borderColor: circleBorder,
            backgroundColor: circleBg,
            opacity: pressed ? 0.92 : 1,
          },
          error ? styles.circleError : null,
        ]}
        accessibilityRole="button"
        accessibilityLabel={hasFile ? "Cambiar logo de la empresa" : "Subir logo de la empresa"}
      >
        {previewUri ? (
          <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />
        ) : (
          <View style={styles.placeholder}>
            <View style={styles.iconWrap}>
              <Ionicons
                name="image-outline"
                size={34}
                color={isDark ? colors.textMuted : "#6c757d"}
              />
              <View
                style={[
                  styles.plusBadge,
                  { backgroundColor: isDark ? colors.accent : colors.primary },
                ]}
              >
                <Ionicons name="add" size={11} color="#fff" />
              </View>
            </View>
            <Text style={[styles.placeholderText, { color: colors.textMuted }]}>
              Haz clic para subir el logo
            </Text>
          </View>
        )}
      </Pressable>

      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.selectRow, { opacity: pressed ? 0.75 : 1 }]}
      >
        <Ionicons name="cloud-upload-outline" size={20} color={colors.primaryText} />
        <Text style={[styles.selectLabel, { color: colors.primaryText }]}>
          {hasFile ? "Cambiar Logo" : "Seleccionar Logo"}
        </Text>
      </Pressable>

      <Text style={[styles.hint, { color: colors.textMuted }]}>
        PNG, JPG, JPEG o WebP – Máx 5MB
      </Text>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const CIRCLE_SIZE = 108;

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    gap: 12,
    marginBottom: 4,
  },
  circle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    borderWidth: 2,
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  circleError: {
    shadowColor: "rgba(239, 68, 68, 0.2)",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 1,
  },
  previewImage: {
    width: "88%",
    height: "88%",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  iconWrap: {
    position: "relative",
    width: 40,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  plusBadge: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: 11,
    lineHeight: 14,
    textAlign: "center",
    fontWeight: "500",
  },
  selectRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 4,
  },
  selectLabel: {
    fontSize: 15,
    fontWeight: "700",
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
  },
  errorText: {
    color: "#ef4444",
    fontSize: 12,
    textAlign: "center",
    marginTop: 2,
  },
});

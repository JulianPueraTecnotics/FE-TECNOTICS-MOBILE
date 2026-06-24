import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../store/theme.context";
import { useThemeColors } from "../../theme/useThemeColors";

const TRACK_WIDTH = 72;
const THUMB_SIZE = 32;
const PADDING = 2;

const ThemeSwitch: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const colors = useThemeColors();
  const isDark = theme === "dark";

  const thumbLeft = isDark ? TRACK_WIDTH - THUMB_SIZE - PADDING : PADDING;

  return (
    <Pressable
      style={[
        styles.track,
        {
          backgroundColor: colors.bgSubtle,
          borderColor: colors.border,
        },
      ]}
      onPress={() => setTheme(isDark ? "light" : "dark")}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
    >
      {/* Icono inactivo visible en el extremo opuesto */}
      <View style={[styles.endCap, { left: PADDING }]}>
        {isDark && <Ionicons name="sunny" size={17} color={colors.textMuted} />}
      </View>
      <View style={[styles.endCap, { right: PADDING }]}>
        {!isDark && <Ionicons name="moon" size={16} color={colors.textMuted} />}
      </View>

      {/* Círculo con sol o luna centrados */}
      <View
        style={[
          styles.thumb,
          {
            left: thumbLeft,
            backgroundColor: colors.accent,
            shadowColor: colors.primary,
          },
        ]}
      >
        <Ionicons
          name={isDark ? "moon" : "sunny"}
          size={17}
          color="#ffffff"
        />
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: THUMB_SIZE + PADDING * 2,
    borderRadius: (THUMB_SIZE + PADDING * 2) / 2,
    borderWidth: 1,
    justifyContent: "center",
  },
  endCap: {
    position: "absolute",
    top: PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    alignItems: "center",
    justifyContent: "center",
  },
  thumb: {
    position: "absolute",
    top: PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.22,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 1,
  },
});

export default ThemeSwitch;

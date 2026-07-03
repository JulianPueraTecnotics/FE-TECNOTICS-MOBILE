import { LinearGradient } from "expo-linear-gradient";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useThemeColors } from "../../theme/useThemeColors";

interface AccentStripProps {
  height?: number;
  opacity?: number;
  style?: StyleProp<ViewStyle>;
}

/** Franja decorativa inferior/superior — estilo ACTIVA con colores Tecnotics. */
const AccentStrip: React.FC<AccentStripProps> = ({ height = 2, opacity = 0.75, style }) => {
  const colors = useThemeColors();

  return (
    <View style={[styles.wrap, { height, opacity }, style]}>
      <LinearGradient
        colors={[colors.headerAccent, colors.primary, colors.headerAccent]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { width: "100%", overflow: "hidden" },
});

export default AccentStrip;

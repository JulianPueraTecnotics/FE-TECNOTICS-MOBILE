import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import appIcon from "../../assets/app-icon";
import { APP_BRAND_NAME } from "../../utils/global";
import { useThemeColors } from "../../theme/useThemeColors";

type Props = {
  onPress?: () => void;
};

export default function HeaderBrand({ onPress }: Props) {
  const colors = useThemeColors();

  const content = (
    <View style={styles.row}>
      <Image source={appIcon} style={styles.icon} resizeMode="contain" />
      <Text style={[styles.name, { color: colors.primary }]} numberOfLines={1}>
        {APP_BRAND_NAME}
      </Text>
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={styles.press} accessibilityLabel="Ir al inicio">
        {content}
      </Pressable>
    );
  }

  return content;
}

const styles = StyleSheet.create({
  press: { flexShrink: 1, maxWidth: "100%" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  icon: { width: 36, height: 36, borderRadius: 8, flexShrink: 0 },
  name: { fontSize: 15, fontWeight: "700", letterSpacing: -0.2, flexShrink: 1 },
});

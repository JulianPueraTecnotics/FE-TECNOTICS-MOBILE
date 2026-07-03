import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { DS_SPACE, SHELL_RADIUS, getSoftCardShadow } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  padded?: boolean;
};

/** Contenedor — paridad con `.ds-container` del portal web. */
export default function DsCard({ children, style, padded = true }: Props) {
  const colors = useThemeColors();
  return (
    <View
      style={[
        styles.card,
        getSoftCardShadow(colors),
        {
          backgroundColor: colors.cardBg,
          borderColor: colors.border,
          padding: padded ? DS_SPACE.container : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: SHELL_RADIUS.container,
    marginBottom: DS_SPACE.section,
  },
});

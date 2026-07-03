import type { ReactNode } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { DS_SPACE } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";

type Props = {
  header?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  style?: ViewStyle;
};

/** Layout base de listados — paridad con `.ds-page` + toolbar del portal. */
export default function DsListPageShell({ header, toolbar, children, style }: Props) {
  const colors = useThemeColors();
  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }, style]}>
      {header}
      {toolbar ? (
        <View style={[styles.toolbar, { borderBottomColor: colors.border, backgroundColor: colors.pageBg }]}>
          {toolbar}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  toolbar: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: DS_SPACE.gap,
    paddingHorizontal: DS_SPACE.page,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

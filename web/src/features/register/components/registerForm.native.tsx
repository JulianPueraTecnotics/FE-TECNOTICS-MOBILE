import { StyleSheet, Text, View } from "react-native";
import type { NativeThemeColors } from "../../../theme/theme.native";
import {
  PortalPasswordField,
  PortalPickerField,
  PortalTextField,
  type PortalIconName,
} from "../../../components/shared/PortalField.native";

export {
  PortalTextField as RegisterField,
  PortalPasswordField as PasswordField,
  PortalPickerField as RegisterPicker,
};
export type { PortalIconName };

export {
  RegisterFormActions,
  RegisterPrimaryButton,
} from "./RegisterActions.native";

export function createRegisterStyles(colors: NativeThemeColors) {
  return StyleSheet.create({
    section: { marginBottom: 24 },
    sectionHeader: {
      width: "100%",
      marginBottom: 16,
    },
    sectionHeaderTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.primary,
      textAlign: "center",
      marginBottom: 10,
    },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "700",
      color: colors.primary,
      marginBottom: 12,
    },
    sectionDivider: {
      height: 1,
      width: "100%",
      backgroundColor: colors.border,
    },
    primaryBtn: {
      marginTop: 8,
    },
    primaryBtnDisabled: { opacity: 0.6 },
    primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },
    secondaryBtn: { marginTop: 12, paddingVertical: 10, alignItems: "center" },
    secondaryBtnText: { color: colors.accent, fontWeight: "600", fontSize: 15 },
    linkText: { color: colors.textMuted, textAlign: "center", fontSize: 14 },
    errorText: { color: "#ef4444", fontSize: 12, marginTop: 4 },
    hint: { fontSize: 12, color: colors.textMuted, textAlign: "center", marginTop: 6 },
    card: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
      backgroundColor: colors.cardBg,
    },
    cardTitle: { fontSize: 15, fontWeight: "700", color: colors.primaryText, marginBottom: 8 },
    infoBox: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 14,
      backgroundColor: colors.bgSubtle,
      marginTop: 12,
    },
    infoTitle: { fontWeight: "700", color: colors.primaryText, marginBottom: 6 },
    infoText: { color: colors.textMuted, lineHeight: 20, fontSize: 14 },
  });
}

export function RegisterSectionHeader({
  title,
  colors,
}: {
  title: string;
  colors: NativeThemeColors;
}) {
  const styles = createRegisterStyles(colors);
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderTitle}>{title}</Text>
      <View style={styles.sectionDivider} />
    </View>
  );
}

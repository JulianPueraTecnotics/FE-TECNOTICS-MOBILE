import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocation } from "react-router-dom";
import AccentStrip from "./AccentStrip.native";
import ThemeSwitch from "../shared/ThemeSwitch.native";
import { useThemeColors } from "../../theme/useThemeColors";
import { AUTH_HEADER_HEIGHT } from "./nativeShell.constants";
import { getHeaderShadow } from "./shellStyles.native";
import { resolveMobilePageTitle } from "./mobilePageTitles.native";

type Props = {
  onOpenMenu: () => void;
};

export default function MobileAuthenticatedHeader({ onOpenMenu }: Props) {
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const location = useLocation();
  const title = resolveMobilePageTitle(location.pathname, location.search);
  const headerTotalHeight = insets.top + AUTH_HEADER_HEIGHT;
  const headerShadow = getHeaderShadow(colors);

  return (
    <>
      <View
        style={[
          styles.header,
          headerShadow,
          {
            paddingTop: insets.top,
            height: headerTotalHeight,
            backgroundColor: colors.pageBg,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          style={styles.menuBtn}
          onPress={onOpenMenu}
          accessibilityLabel="Abrir menú"
          hitSlop={8}
        >
          <Ionicons name="menu-outline" size={26} color={colors.primaryText} />
        </Pressable>

        <Text style={[styles.title, { color: colors.primary }]} numberOfLines={1}>
          {title}
        </Text>

        <ThemeSwitch />

        <View style={styles.accentWrap}>
          <AccentStrip height={2} opacity={0.75} />
        </View>
      </View>

      <View style={{ height: headerTotalHeight, backgroundColor: colors.pageBg }} />
    </>
  );
}

const styles = StyleSheet.create({
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 0,
    borderBottomWidth: 1,
    gap: 12,
  },
  accentWrap: { position: "absolute", left: 0, right: 0, bottom: 0 },
  menuBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    textAlign: "center",
  },
});

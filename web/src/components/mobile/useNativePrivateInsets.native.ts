import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AUTH_HEADER_HEIGHT, BOTTOM_NAV_HEIGHT } from "./nativeShell.constants";

export function useNativePrivateInsets(showBottomNav = true) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + AUTH_HEADER_HEIGHT,
    paddingBottom: showBottomNav ? BOTTOM_NAV_HEIGHT + insets.bottom : insets.bottom + 16,
    headerTotalHeight: insets.top + AUTH_HEADER_HEIGHT,
    bottomNavTotalHeight: BOTTOM_NAV_HEIGHT + insets.bottom,
  };
}

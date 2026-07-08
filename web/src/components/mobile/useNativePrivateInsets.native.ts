import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AUTH_HEADER_HEIGHT, BOTTOM_NAV_HEIGHT } from "./nativeShell.constants";

/** Separación entre el final del contenido y la barra inferior. */
export const CONTENT_BOTTOM_GAP = 20;

export function useNativePrivateInsets(showBottomNav = true) {
  const insets = useSafeAreaInsets();
  return {
    paddingTop: insets.top + AUTH_HEADER_HEIGHT,
    paddingBottom: showBottomNav
      ? BOTTOM_NAV_HEIGHT + insets.bottom + CONTENT_BOTTOM_GAP
      : insets.bottom + CONTENT_BOTTOM_GAP,
    headerTotalHeight: insets.top + AUTH_HEADER_HEIGHT,
    bottomNavTotalHeight: BOTTOM_NAV_HEIGHT + insets.bottom,
  };
}

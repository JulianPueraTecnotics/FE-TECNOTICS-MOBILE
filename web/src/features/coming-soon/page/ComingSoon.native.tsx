import { useLocation, useNavigate } from "react-router-dom";
import { useMemo } from "react";
import { Text } from "react-native";
import { DsButton, DsModuleScreen } from "../../../components/design-system-native";
import { COMPANY_MENU, type MenuItem } from "../../../components/shared/nav/menu.config";
import { PATHS } from "../../../router/paths.contants";
import { useThemeColors } from "../../../theme/useThemeColors";

function findMenuItemByPath(pathname: string): MenuItem | undefined {
  for (const item of COMPANY_MENU) {
    if (item.path === pathname) return item;
    const child = item.children?.find((c) => c.path === pathname);
    if (child) return child;
  }
  return undefined;
}

export default function ComingSoonNative() {
  const colors = useThemeColors();
  const location = useLocation();
  const navigate = useNavigate();
  const item = useMemo(() => findMenuItemByPath(location.pathname), [location.pathname]);
  const title = item?.label ?? "Módulo";

  return (
    <DsModuleScreen title={title} subtitle="Próximamente">
      <Text style={{ color: colors.textMuted, fontSize: 15, lineHeight: 22, marginBottom: 20 }}>
        Este módulo está en construcción. Pronto podrás gestionar {title} desde aquí.
      </Text>
      <DsButton label="Volver al inicio" icon="home-outline" onPress={() => navigate(PATHS.DASHBOARD)} />
    </DsModuleScreen>
  );
}

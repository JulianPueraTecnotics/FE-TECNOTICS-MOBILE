import type { ReactNode } from "react";
import { RefreshControl, ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import LoadingScreen from "../../router/LoadingScreen";
import { useNativePrivateInsets } from "../mobile/useNativePrivateInsets.native";
import { DS_SPACE } from "../mobile/shellStyles.native";
import { useThemeColors } from "../../theme/useThemeColors";
import DsListPageShell from "./DsListPageShell.native";
import DsPageHeader from "./DsPageHeader.native";

type Props = {
  title: string;
  subtitle?: string;
  headerActions?: ReactNode;
  toolbar?: ReactNode;
  loading?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  children: ReactNode;
  /** Contenido fijo sin ScrollView (p. ej. configuración con tabs). */
  noScroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  footer?: ReactNode;
};

/** Layout estándar de módulo nativo — paridad con `.ds-page` del portal. */
export default function DsModuleScreen({
  title,
  subtitle,
  headerActions,
  toolbar,
  loading,
  refreshing,
  onRefresh,
  children,
  noScroll,
  contentStyle,
  footer,
}: Props) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();

  if (loading) return <LoadingScreen />;

  const body = noScroll ? (
    <View style={[{ flex: 1 }, contentStyle]}>{children}</View>
  ) : (
    <ScrollView
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.headerAccent}
          />
        ) : undefined
      }
      contentContainerStyle={[
        { padding: DS_SPACE.page, paddingBottom: insets.paddingBottom + DS_SPACE.page },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );

  return (
    <DsListPageShell
      header={<DsPageHeader title={title} subtitle={subtitle} actions={headerActions} />}
      toolbar={toolbar}
    >
      {body}
      {footer}
    </DsListPageShell>
  );
}

import { Platform } from "react-native";
import { StatusBar } from "expo-status-bar";
import { useThemeColors } from "../../theme/useThemeColors";

/** Status bar en iOS/Android según tema del portal. */
const ThemeAwareStatusBar: React.FC = () => {
  if (Platform.OS === "web") return null;
  const colors = useThemeColors();
  return <StatusBar style={colors.statusBarStyle} />;
};

export default ThemeAwareStatusBar;

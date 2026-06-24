import { Image } from "react-native";
import type { ImageStyle, StyleProp } from "react-native";
import brandLogo from "../../assets/brand.png";
import { useTheme } from "../../store/theme.context";

interface ThemeBrandLogoProps {
  style?: StyleProp<ImageStyle>;
}

/** Logo de facturación — en oscuro: equivalente visual a invert(1) grayscale(1). */
const ThemeBrandLogo: React.FC<ThemeBrandLogoProps> = ({ style }) => {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  return (
    <Image
      source={brandLogo}
      style={[style, isDark && { tintColor: "#e6edf3" }]}
      resizeMode="contain"
    />
  );
};

export default ThemeBrandLogo;

import { Image } from "react-native";
import type { ImageStyle, StyleProp } from "react-native";
import appLogo from "../../assets/app-logo";

interface ThemeBrandLogoProps {
  style?: StyleProp<ImageStyle>;
}

/** Logo Tecnotics Contable (assets/favicon.png). */
const ThemeBrandLogo: React.FC<ThemeBrandLogoProps> = ({ style }) => {
  return <Image source={appLogo} style={style} resizeMode="contain" />;
};

export default ThemeBrandLogo;

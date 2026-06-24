import { Platform } from "react-native";
import MobileShellNative from "./MobileShell.native";
import MobileShellWeb from "./MobileShell.web";

export default Platform.OS === "web" ? MobileShellWeb : MobileShellNative;

import { Platform } from "react-native";
import LoadingScreenNative from "./LoadingScreen.native";
import LoadingScreenWeb from "./LoadingScreen.web";

export default Platform.OS === "web" ? LoadingScreenWeb : LoadingScreenNative;

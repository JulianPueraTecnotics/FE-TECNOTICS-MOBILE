import { Platform } from "react-native";
import ConfigurationNative from "./Configuration.native";
import ConfigurationWeb from "./Configuration.web";

export default Platform.OS === "web" ? ConfigurationWeb : ConfigurationNative;

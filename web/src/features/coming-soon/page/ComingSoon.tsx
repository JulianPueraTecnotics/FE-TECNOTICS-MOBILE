import { Platform } from "react-native";
import ComingSoonNative from "./ComingSoon.native";
import ComingSoonWeb from "./ComingSoon.web";

export default Platform.OS === "web" ? ComingSoonWeb : ComingSoonNative;

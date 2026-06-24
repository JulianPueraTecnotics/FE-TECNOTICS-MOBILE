import { Platform } from "react-native";
import LoginNative from "./Login.native";
import LoginWeb from "./Login.web";

export default Platform.OS === "web" ? LoginWeb : LoginNative;

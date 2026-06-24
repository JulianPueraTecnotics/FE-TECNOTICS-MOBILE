import { Platform } from "react-native";
import RegisterNative from "./Register.native";
import RegisterWeb from "./Register.web";

export default Platform.OS === "web" ? RegisterWeb : RegisterNative;

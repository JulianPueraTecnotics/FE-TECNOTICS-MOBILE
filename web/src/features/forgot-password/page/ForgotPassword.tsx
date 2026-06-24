import { Platform } from "react-native";
import ForgotPasswordNative from "./ForgotPassword.native";
import ForgotPasswordWeb from "./ForgotPassword.web";

export default Platform.OS === "web" ? ForgotPasswordWeb : ForgotPasswordNative;

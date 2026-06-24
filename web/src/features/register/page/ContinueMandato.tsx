import { Platform } from "react-native";
import ContinueMandatoNative from "./ContinueMandato.native";
import ContinueMandatoWeb from "./ContinueMandato.web";

export default Platform.OS === "web" ? ContinueMandatoWeb : ContinueMandatoNative;

import { Platform } from "react-native";
import TecAssistantNative from "./TecAssistant.native";
import TecAssistantWeb from "./TecAssistant.web";

export default Platform.OS === "web" ? TecAssistantWeb : TecAssistantNative;

import { Platform } from "react-native";
import ClientsNative from "./Clients.native";
import ClientsWeb from "./Clients.web";

export default Platform.OS === "web" ? ClientsWeb : ClientsNative;

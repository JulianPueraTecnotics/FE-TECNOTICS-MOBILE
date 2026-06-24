import { Platform } from "react-native";
import HomeNative from "./Home.native";
import HomeWeb from "./Home.web";

export default Platform.OS === "web" ? HomeWeb : HomeNative;

import { Platform } from "react-native";
import DashboardNative from "./Dashboard.native";
import DashboardWeb from "./Dashboard.web";

export default Platform.OS === "web" ? DashboardWeb : DashboardNative;

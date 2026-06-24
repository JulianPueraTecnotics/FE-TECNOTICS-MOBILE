import { Platform } from "react-native";
import DocumentsNative from "./Documents.native";
import DocumentsWeb from "./Documents.web";

export default Platform.OS === "web" ? DocumentsWeb : DocumentsNative;

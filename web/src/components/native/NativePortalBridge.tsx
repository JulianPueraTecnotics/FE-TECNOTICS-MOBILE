import { Platform } from "react-native";

const NativePortalBridge: React.FC =
  Platform.OS === "web"
    ? () => null
    : require("./NativePortalBridge.native").default;

export default NativePortalBridge;

import { Platform } from "react-native";
import type { ProfileSection } from "./profile.native.shared";
import ProfileNative from "./Profile.native";
import ProfileWeb from "./Profile.web";

type Props = {
  mode?: "profile" | "configuration";
  embedded?: boolean;
  initialSection?: ProfileSection;
};

export default function ProfilePage(props: Props) {
  return Platform.OS === "web" ? <ProfileWeb {...props} /> : <ProfileNative {...props} />;
}

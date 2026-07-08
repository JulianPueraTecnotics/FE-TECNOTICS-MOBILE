import { resolveImageUri } from "../utils/resolveImageUri";
import appLogoAsset from "../../../assets/favicon.png";

/** Para `<Image source={…} />` (React Native). */
export default appLogoAsset;

/** Para `<img src={…} />` y CSS en web/Metro. */
export const appLogoSrc = resolveImageUri(appLogoAsset);

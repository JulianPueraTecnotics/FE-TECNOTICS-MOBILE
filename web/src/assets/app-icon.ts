import { resolveImageUri } from "../utils/resolveImageUri";
import appIconAsset from "../../../assets/icon.png";

/** Icono de app (assets/icon.png) — header, splash, favicon. */
export default appIconAsset;

export const appIconSrc = resolveImageUri(appIconAsset);

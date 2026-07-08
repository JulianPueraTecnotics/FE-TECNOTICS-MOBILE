import { resolveImageUri } from "../utils/resolveImageUri";
import appIconAsset from "../../../assets/favicon.png";

/** Icono de app (assets/favicon.png) — header, splash, favicon. */
export default appIconAsset;

export const appIconSrc = resolveImageUri(appIconAsset);

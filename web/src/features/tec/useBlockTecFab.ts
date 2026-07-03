import { useEffect, useState } from "react";
import { useIsMobile } from "../../components/design-system";

/** Selectores de capas que tapan la app en móvil (menú lateral, modales, drawers). */
const MOBILE_OVERLAY_SELECTORS = [
    ".sidebar.sidebar__open",
    ".ds-modal-overlay",
    ".ds-drawer-overlay",
    ".config-drawer-overlay",
    ".pm-overlay",
    ".modal-overlay",
    ".payment-drawer-overlay",
    ".confirm-overlay",
    ".unsaved-overlay",
    '[class*="-filters-drawer-overlay"]',
] as const;

function hasBlockingOverlay(): boolean {
    return MOBILE_OVERLAY_SELECTORS.some((selector) => Boolean(document.querySelector(selector)));
}

/** En móvil oculta el FAB de TEC mientras haya un menú lateral o modal abierto. */
export function useBlockTecFab(): boolean {
    const isMobile = useIsMobile();
    const [blocked, setBlocked] = useState(false);

    useEffect(() => {
        if (!isMobile) {
            setBlocked(false);
            return;
        }

        const sync = () => setBlocked(hasBlockingOverlay());
        sync();

        const observer = new MutationObserver(sync);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
            attributes: true,
            attributeFilter: ["class"],
        });

        return () => observer.disconnect();
    }, [isMobile]);

    return isMobile && blocked;
}

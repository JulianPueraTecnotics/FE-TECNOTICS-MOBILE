import { useEffect, useState } from "react";
import type { ViewMode } from "./ViewModeToggle";

export const LIST_MOBILE_BREAKPOINT = 768;

export function useIsMobile(breakpoint = LIST_MOBILE_BREAKPOINT): boolean {
    const [isMobile, setIsMobile] = useState(
        () => typeof window !== "undefined" && window.innerWidth <= breakpoint,
    );

    useEffect(() => {
        const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, [breakpoint]);

    return isMobile;
}

/** En móvil siempre tarjetas; el selector de vista solo aplica en escritorio. */
export function useEffectiveViewMode(viewMode: ViewMode): ViewMode {
    const isMobile = useIsMobile();
    return isMobile ? "cards" : viewMode;
}

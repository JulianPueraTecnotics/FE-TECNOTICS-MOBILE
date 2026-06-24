import { useEffect } from "react";

let activeLocks = 0;
let previousBodyOverflow = "";
let previousBodyPosition = "";
let previousBodyTop = "";
let previousBodyLeft = "";
let previousBodyRight = "";
let previousBodyWidth = "";
let previousHtmlOverflow = "";
let savedScrollY = 0;
let savedScrollX = 0;
const previousContainerOverflows = new Map<HTMLElement, string>();

function lockBodyScroll() {
    if (typeof document === "undefined" || typeof window === "undefined") return;

    if (activeLocks === 0) {
        savedScrollY = window.scrollY;
        savedScrollX = window.scrollX;

        previousBodyOverflow = document.body.style.overflow;
        previousBodyPosition = document.body.style.position;
        previousBodyTop = document.body.style.top;
        previousBodyLeft = document.body.style.left;
        previousBodyRight = document.body.style.right;
        previousBodyWidth = document.body.style.width;
        previousHtmlOverflow = document.documentElement.style.overflow;

        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
        document.body.style.position = "fixed";
        document.body.style.top = `-${savedScrollY}px`;
        document.body.style.left = `-${savedScrollX}px`;
        document.body.style.right = "0";
        document.body.style.width = "100%";

        const scrollContainers = Array.from(document.querySelectorAll<HTMLElement>(".container-scroll"));
        scrollContainers.forEach((container) => {
            previousContainerOverflows.set(container, container.style.overflowY);
            container.style.overflowY = "hidden";
        });
    }

    activeLocks += 1;
}

function unlockBodyScroll() {
    if (typeof document === "undefined" || typeof window === "undefined") return;
    if (activeLocks === 0) return;

    activeLocks -= 1;

    if (activeLocks === 0) {
        document.documentElement.style.overflow = previousHtmlOverflow;
        document.body.style.overflow = previousBodyOverflow;
        document.body.style.position = previousBodyPosition;
        document.body.style.top = previousBodyTop;
        document.body.style.left = previousBodyLeft;
        document.body.style.right = previousBodyRight;
        document.body.style.width = previousBodyWidth;

        previousContainerOverflows.forEach((overflow, container) => {
            container.style.overflowY = overflow;
        });
        previousContainerOverflows.clear();

        window.scrollTo(savedScrollX, savedScrollY);
    }
}

export function useBodyScrollLock(active: boolean) {
    useEffect(() => {
        if (!active) return;

        lockBodyScroll();

        return () => {
            unlockBodyScroll();
        };
    }, [active]);
}


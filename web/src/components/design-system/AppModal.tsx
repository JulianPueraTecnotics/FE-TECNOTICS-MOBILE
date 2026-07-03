import type { ReactNode } from "react";
import { useBodyScrollLock } from "../../hooks/useBodyScrollLock";

type AppModalProps = {
    title: string;
    titleIcon?: string;
    onClose: () => void;
    children: ReactNode;
    footer: ReactNode;
    closeDisabled?: boolean;
    wide?: boolean;
    compact?: boolean;
    ariaLabelledBy?: string;
};

export function AppModal({
    title,
    titleIcon,
    onClose,
    children,
    footer,
    closeDisabled = false,
    wide = false,
    compact = false,
    ariaLabelledBy,
}: AppModalProps) {
    useBodyScrollLock(true);
    const titleId = ariaLabelledBy ?? "ds-modal-title";
    const modalClass = [
        "ds-modal export-modal",
        wide ? "ds-modal--wide" : "",
        compact ? "ds-modal--confirm" : "",
    ].filter(Boolean).join(" ");

    return (
        <div className="ds-modal-overlay export-overlay" onClick={closeDisabled ? undefined : onClose} role="presentation">
            <div
                className={modalClass}
                onClick={(e) => e.stopPropagation()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="ds-modal-header export-modal-header">
                    <div className="export-modal-header__content">
                        <h3 id={titleId}>
                            {titleIcon && <i className={titleIcon} aria-hidden />}
                            {title}
                        </h3>
                    </div>
                    <button
                        type="button"
                        className="ds-modal-close export-modal-close"
                        onClick={onClose}
                        disabled={closeDisabled}
                        aria-label="Cerrar"
                    >
                        <i className="ri-close-line" />
                    </button>
                </div>
                <div className="ds-modal-body export-modal-body">{children}</div>
                <div className="ds-modal-actions export-modal-actions">{footer}</div>
            </div>
        </div>
    );
}

type AppDrawerProps = {
    title: string;
    titleIcon?: string;
    onClose: () => void;
    children: ReactNode;
    footer?: ReactNode;
    closeDisabled?: boolean;
    wide?: boolean;
    ariaLabelledBy?: string;
};

export function AppDrawer({ title, titleIcon, onClose, children, footer, closeDisabled = false, wide = false, ariaLabelledBy }: AppDrawerProps) {
    useBodyScrollLock(true);
    const titleId = ariaLabelledBy ?? "ds-drawer-title";

    return (
        <>
            <div className="ds-drawer-overlay" onClick={closeDisabled ? undefined : onClose} role="presentation" aria-hidden={false} />
            <aside
                className={`ds-drawer ${wide ? "ds-drawer--wide" : ""}`.trim()}
                role="dialog"
                aria-modal="true"
                aria-labelledby={titleId}
            >
                <div className="ds-modal-header export-modal-header">
                    <div className="export-modal-header__content">
                        <h3 id={titleId}>
                            {titleIcon && <i className={titleIcon} aria-hidden />}
                            {title}
                        </h3>
                    </div>
                    <button type="button" className="ds-modal-close export-modal-close" onClick={onClose} disabled={closeDisabled} aria-label="Cerrar">
                        <i className="ri-close-line" />
                    </button>
                </div>
                <div className="ds-modal-body export-modal-body">{children}</div>
                {footer && <div className="ds-modal-actions export-modal-actions">{footer}</div>}
            </aside>
        </>
    );
}

import type { ReactNode } from "react";

type ListPageShellProps = {
    children: ReactNode;
    className?: string;
};

export function ListPageShell({ children, className = "" }: ListPageShellProps) {
    return <main className={`ds-page ${className}`.trim()}>{children}</main>;
}

type ListPageContainerProps = {
    children: ReactNode;
    className?: string;
};

export function ListPageContainer({ children, className = "" }: ListPageContainerProps) {
    return <div className={`ds-container ${className}`.trim()}>{children}</div>;
}

type ListPageHeaderProps = {
    title: string;
    subtitle?: string;
    actions?: ReactNode;
    className?: string;
};

export function ListPageHeader({ title, subtitle, actions, className = "" }: ListPageHeaderProps) {
    return (
        <header className={`ds-header ${className}`.trim()}>
            <div className="header-content">
                <h1>{title}</h1>
                {subtitle && <p>{subtitle}</p>}
            </div>
            {actions && <div className="ds-actions">{actions}</div>}
        </header>
    );
}

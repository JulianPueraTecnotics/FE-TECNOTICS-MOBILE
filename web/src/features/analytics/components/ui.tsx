import React from "react";
import "./premium.css";

/* Helpers de formato compartidos por el módulo. */
export const money = (n: number) => "$" + (n || 0).toLocaleString("es-CO", { maximumFractionDigits: 0 });
export const moneyShort = (v: number) => {
    const a = Math.abs(v);
    const s = a >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : a >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : `${Math.round(v)}`;
    return "$" + s;
};
export const pct = (n: number) => `${(n ?? 0).toFixed(1)}%`;
const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
export const periodoLabel = (p: string) => {
    const [y, m] = (p || "").split("-");
    return m ? `${MONTHS[parseInt(m, 10) - 1]} ${(y || "").slice(2)}` : p;
};

/** Sparkline SVG: tendencia compacta de una serie de valores. */
export const Sparkline: React.FC<{ data: number[]; color?: string; height?: number }> = ({ data, color = "#5a9fb4", height = 28 }) => {
    if (!data || data.length < 2) return null;
    const w = 100;
    const min = Math.min(...data);
    const max = Math.max(...data);
    const span = max - min || 1;
    const step = w / (data.length - 1);
    const pts = data.map((v, i) => `${(i * step).toFixed(1)},${(height - ((v - min) / span) * (height - 4) - 2).toFixed(1)}`);
    const last = data[data.length - 1];
    const lastPrev = data[data.length - 2];
    const up = last >= lastPrev;
    const lineColor = color;
    const areaId = `sp-${Math.round(min)}-${data.length}-${Math.round(max)}`;
    return (
        <svg className="pa-spark" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" aria-hidden>
            <defs>
                <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={lineColor} stopOpacity="0.22" />
                    <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
                </linearGradient>
            </defs>
            <polygon points={`0,${height} ${pts.join(" ")} ${w},${height}`} fill={`url(#${areaId})`} />
            <polyline points={pts.join(" ")} fill="none" stroke={lineColor} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx={(data.length - 1) * step} cy={height - ((last - min) / span) * (height - 4) - 2} r="2.2" fill={up ? "#22c55e" : "#ef4444"} />
        </svg>
    );
};

/** Delta porcentual con flecha y color. invert=true → bajar es bueno (gastos). */
export const Delta: React.FC<{ v?: number; invert?: boolean }> = ({ v, invert }) => {
    if (v === undefined || v === null) return null;
    const dir = v > 0 ? "up" : v < 0 ? "down" : "flat";
    const good = invert ? v < 0 : v > 0;
    const cls = v === 0 ? "flat" : good ? "up" : "down";
    return (
        <span className={`pa-delta pa-delta--${cls}`}>
            {dir === "up" ? "▲" : dir === "down" ? "▼" : "—"} {Math.abs(v)}%
        </span>
    );
};

export interface KpiProps {
    label: string;
    value: string;
    icon?: string;
    /** Color de acento (banda superior + icono). */
    accent?: string;
    delta?: number;
    deltaInvert?: boolean;
    hint?: string;
    spark?: number[];
    negative?: boolean;
    onClick?: () => void;
}

/** KPI card premium: icono + valor grande + delta + sparkline opcional. */
export const KpiCard: React.FC<KpiProps> = ({ label, value, icon, accent = "#5a9fb4", delta, deltaInvert, hint, spark, negative, onClick }) => (
    <div
        className={`pa-kpi ${onClick ? "pa-kpi--clickable" : ""}`}
        style={{ ["--pa-accent" as string]: accent }}
        onClick={onClick}
        role={onClick ? "button" : undefined}
    >
        <div className="pa-kpi__top">
            {icon && <span className="pa-kpi__icon"><i className={icon} /></span>}
            <span className="pa-kpi__label">{label}</span>
        </div>
        <div className={`pa-kpi__value ${negative ? "pa-kpi__value--neg" : ""}`}>{value}</div>
        {(delta !== undefined || hint) && (
            <div className="pa-kpi__foot">
                {hint ? <span className="pa-kpi__hint">{hint}</span> : <span />}
                <Delta v={delta} invert={deltaInvert} />
            </div>
        )}
        {spark && spark.length > 1 && <Sparkline data={spark} color={accent} />}
    </div>
);

/** Panel con título, subtítulo opcional, acciones y cuerpo. */
export const Section: React.FC<{ title: string; icon?: string; sub?: string; actions?: React.ReactNode; children: React.ReactNode; wide?: boolean }> = ({ title, icon, sub, actions, children }) => (
    <div className="pa-section">
        <div className="pa-section__head">
            <div>
                <h3 className="pa-section__title">{icon && <i className={icon} />} {title}</h3>
                {sub && <div className="pa-section__sub">{sub}</div>}
            </div>
            {actions}
        </div>
        {children}
    </div>
);

export type Health = "ok" | "warn" | "bad" | "info";
export const HealthBadge: React.FC<{ level: Health; children: React.ReactNode }> = ({ level, children }) => (
    <span className={`pa-badge pa-badge--${level}`}>{children}</span>
);

/** Lista de alertas (semáforo accionable). */
export interface AlertItem {
    level: "bad" | "warn" | "ok";
    icon: string;
    text: string;
    onClick?: () => void;
}
export const AlertList: React.FC<{ items: AlertItem[] }> = ({ items }) => (
    <div className="pa-alerts">
        {items.map((a, i) => (
            <div key={i} className={`pa-alert pa-alert--${a.level}`} style={a.onClick ? { cursor: "pointer" } : undefined} onClick={a.onClick}>
                <i className={a.icon} />
                <span>{a.text}</span>
            </div>
        ))}
    </div>
);

/** Grid de skeletons mientras carga. */
export const SkeletonGrid: React.FC<{ kpis?: number; charts?: number }> = ({ kpis = 4, charts = 1 }) => (
    <div>
        <div className="pa-grid">
            {Array.from({ length: kpis }).map((_, i) => (
                <div key={i} className="pa-skel pa-skel--kpi" />
            ))}
        </div>
        {Array.from({ length: charts }).map((_, i) => (
            <div key={i} className="pa-skel pa-skel--chart" />
        ))}
    </div>
);

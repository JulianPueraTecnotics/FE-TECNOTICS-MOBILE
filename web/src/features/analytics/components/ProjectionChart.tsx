import React from "react";
import { periodoLabel, moneyShort } from "./ui";
import type { ProjectionReport } from "../analytics.service";

/**
 * Gráfico SVG de proyección con banda de confianza ±1σ.
 * Histórico = línea sólida; proyección = línea punteada con banda sombreada.
 */
const ProjectionChart: React.FC<{ data: ProjectionReport; accent?: string }> = ({ data, accent = "#5a9fb4" }) => {
    const hist = data.historico ?? [];
    const proj = data.proyeccion ?? [];
    if (hist.length < 2) return <p className="reports-empty">Datos insuficientes para proyectar</p>;

    const W = 720;
    const H = 240;
    const padX = 44;
    const padY = 24;
    const all = [...hist.map((h) => h.valor), ...proj.flatMap((p) => [p.min, p.max, p.centro])];
    const max = Math.max(...all, 1);
    const min = Math.min(...all, 0);
    const span = max - min || 1;
    const n = hist.length + proj.length;
    const x = (i: number) => padX + (i / (n - 1)) * (W - padX - 12);
    const y = (v: number) => H - padY - ((v - min) / span) * (H - padY * 2);

    const histPts = hist.map((h, i) => `${x(i).toFixed(1)},${y(h.valor).toFixed(1)}`);
    // La proyección arranca desde el último punto histórico para continuidad.
    const lastHistIdx = hist.length - 1;
    const projLine = [`${x(lastHistIdx).toFixed(1)},${y(hist[lastHistIdx].valor).toFixed(1)}`, ...proj.map((p, i) => `${x(hist.length + i).toFixed(1)},${y(p.centro).toFixed(1)}`)];
    // Banda: arriba (max) ida + abajo (min) vuelta.
    const bandTop = proj.map((p, i) => `${x(hist.length + i).toFixed(1)},${y(p.max).toFixed(1)}`);
    const bandBot = proj.map((p, i) => `${x(hist.length + i).toFixed(1)},${y(p.min).toFixed(1)}`).reverse();
    const bandStart = `${x(lastHistIdx).toFixed(1)},${y(hist[lastHistIdx].valor).toFixed(1)}`;
    const band = `${bandStart} ${bandTop.join(" ")} ${bandBot.join(" ")}`;

    const labels = [...hist.map((h) => h.periodo), ...proj.map((p) => p.periodo)];
    // Líneas guía Y (3).
    const guides = [0, 0.5, 1].map((f) => min + f * span);

    return (
        <div className="pa-projection-chart">
            <svg viewBox={`0 0 ${W} ${H + 20}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label="Proyección con banda de confianza">
                {/* guías Y */}
                {guides.map((g, i) => (
                    <g key={i}>
                        <line x1={padX} y1={y(g)} x2={W - 8} y2={y(g)} stroke="#e8edf2" strokeWidth="1" />
                        <text x={4} y={y(g) + 3} fontSize="9" fill="#94a3b8">{moneyShort(g)}</text>
                    </g>
                ))}
                {/* banda de confianza */}
                {proj.length > 0 && <polygon points={band} fill={accent} fillOpacity="0.13" stroke={accent} strokeOpacity="0.3" strokeDasharray="3 3" strokeWidth="1" />}
                {/* histórico */}
                <polyline points={histPts.join(" ")} fill="none" stroke={accent} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                {hist.map((h, i) => (
                    <circle key={i} cx={x(i)} cy={y(h.valor)} r="2.6" fill={accent}>
                        <title>{`${periodoLabel(h.periodo)}: ${moneyShort(h.valor)}`}</title>
                    </circle>
                ))}
                {/* proyección (punteada) */}
                {proj.length > 0 && <polyline points={projLine.join(" ")} fill="none" stroke={accent} strokeWidth="2.2" strokeDasharray="6 4" strokeLinejoin="round" />}
                {proj.map((p, i) => (
                    <circle key={i} cx={x(hist.length + i)} cy={y(p.centro)} r="2.8" fill="#fff" stroke={accent} strokeWidth="1.6">
                        <title>{`${periodoLabel(p.periodo)} (proyección): ${moneyShort(p.centro)} · banda ${moneyShort(p.min)}–${moneyShort(p.max)}`}</title>
                    </circle>
                ))}
                {/* labels X (cada ~2 para no saturar) */}
                {labels.map((l, i) =>
                    i % Math.ceil(n / 8) === 0 || i === n - 1 ? (
                        <text key={i} x={x(i)} y={H + 6} fontSize="9" fill="#64748b" textAnchor="middle">{periodoLabel(l)}</text>
                    ) : null,
                )}
            </svg>
        </div>
    );
};

export default ProjectionChart;

import { useEffect, useRef, useState } from "react";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { listarJobs, reanudarJob, type BankJob } from "../../../features/treasury/conciliacion.service";
import { successToast, errorToast } from "../toast/toasts";
import "./ActivityCenter.css";

/** Estado y acciones del centro de notificaciones (jobs en segundo plano). */
export function useActivityJobs() {
    const [jobs, setJobs] = useState<BankJob[]>([]);
    const [reanudando, setReanudando] = useState<string | null>(null);
    const avisados = useRef<Set<string>>(new Set());

    const onReanudar = async (jobId: string) => {
        setReanudando(jobId);
        avisados.current.delete(jobId);
        try {
            const r = await reanudarJob(jobId);
            successToast(r.message);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo reanudar la actividad");
        } finally {
            setReanudando(null);
        }
    };

    useEffect(() => {
        listarJobs().then((r) => setJobs(r.jobs)).catch(() => { /* opcional */ });
    }, []);

    useRealtime(RealtimeEvents.BANK_JOB, (payload) => {
        const job = payload.item as BankJob | undefined;
        if (!job?._id) return;
        setJobs((prev) => {
            const exists = prev.some((j) => j._id === job._id);
            return exists ? prev.map((j) => (j._id === job._id ? job : j)) : [job, ...prev];
        });
        if ((job.estado === "completado" || job.estado === "error" || job.estado === "parcial") && !avisados.current.has(job._id)) {
            avisados.current.add(job._id);
            successToast(job.mensaje || `${job.titulo}: ${job.estado}`);
        }
    });

    const activos = jobs.filter((j) => j.estado === "running").length;
    const badgeCount = activos > 0 ? activos : jobs.length;

    return { jobs, reanudando, onReanudar, activos, badgeCount };
}

type ActivityNotificationsListProps = {
    jobs: BankJob[];
    reanudando: string | null;
    onReanudar: (jobId: string) => void;
};

/** Lista de notificaciones / actividades en curso. */
export function ActivityNotificationsList({ jobs, reanudando, onReanudar }: ActivityNotificationsListProps) {
    if (jobs.length === 0) {
        return <p className="activity-center__empty">Sin notificaciones recientes.</p>;
    }

    return (
        <ul className="activity-center__list">
            {jobs.map((j) => {
                const pct = j.total > 0 ? Math.round((j.procesados / j.total) * 100) : 0;
                const color =
                    j.estado === "completado"
                        ? "var(--accent-teal)"
                        : j.estado === "error"
                          ? "var(--tertiary-color)"
                          : j.estado === "parcial"
                            ? "#b45309"
                            : "var(--secondary-color)";
                return (
                    <li key={j._id} className="activity-center__item">
                        <div className="activity-center__item-title">
                            <i
                                className={
                                    j.estado === "running"
                                        ? "ri-loader-4-line activity-center__spin"
                                        : j.estado === "completado"
                                          ? "ri-checkbox-circle-fill"
                                          : j.estado === "error"
                                            ? "ri-error-warning-fill"
                                            : "ri-alert-fill"
                                }
                                style={{ color }}
                            />
                            {j.titulo}
                        </div>
                        <div className="activity-center__bar">
                            <div className="activity-center__bar-fill" style={{ width: `${pct}%`, background: color }} />
                        </div>
                        <div className="activity-center__item-sub">
                            {j.estado === "running" ? `${j.procesados}/${j.total} (${pct}%)` : j.mensaje || j.estado}
                        </div>
                        {(j.estado === "error" || j.estado === "parcial") && j.params?.cuenta && (
                            <button
                                type="button"
                                className="activity-center__resume"
                                onClick={() => onReanudar(j._id)}
                                disabled={reanudando === j._id}
                            >
                                <i className="ri-restart-line" /> {reanudando === j._id ? "Reanudando…" : "Reanudar"}
                            </button>
                        )}
                    </li>
                );
            })}
        </ul>
    );
}

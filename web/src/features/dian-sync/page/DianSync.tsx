import { useCallback, useEffect, useRef, useState } from "react";
import "./DianSync.css";
import {
    listCredentials,
    validateCredential,
    deleteCredential,
    listSyncJobs,
    getSyncJob,
    deleteSyncJob,
    listSyncDocuments,
    downloadSyncExcel,
    downloadSyncPdfs,
    enrichSyncJob,
    openDocumentPdf,
    listEvents,
    listLogs,
    DIAN_EVENT_LABELS,
    DIAN_GROUP_LABELS,
    isDianModuleUnavailable,
    type DianCredential,
    type DianSyncJob,
    type DianDocument,
    type DianEvent,
    type DianLog,
    type DianEventCode,
} from "../../../services/dian.service";
import CredentialModal from "../components/CredentialModal";
import ResponsibleModal from "../components/ResponsibleModal";
import SyncModal from "../components/SyncModal";
import EventModal from "../components/EventModal";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

type Tab = "sync" | "documents" | "events" | "logs";

const PAGE_SIZE = 20;

const formatCOP = (value?: number): string =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(value) || 0);

const fmtDate = (value?: string): string => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });
};

const fmtDateTime = (value?: string): string => {
    if (!value) return "—";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "short" });
};

/** Minutos restantes hasta el vencimiento del token. */
const minutesLeft = (expiresAt: string): number => Math.floor((new Date(expiresAt).getTime() - Date.now()) / 60000);

const syncStatusLabel: Record<string, string> = {
    queued: "En cola",
    running: "Procesando",
    completed: "Completado",
    failed: "Fallido",
};

const DianSyncPage: React.FC = () => {
    // ── Credenciales ──
    const [credentials, setCredentials] = useState<DianCredential[]>([]);
    const [credLoading, setCredLoading] = useState(true);
    /** El módulo DIAN es opcional; si el backend no lo tiene configurado (503) no es un error. */
    const [moduleAvailable, setModuleAvailable] = useState(true);
    const prevCredIds = useRef<Set<string>>(new Set());
    const [, forceTick] = useState(0); // re-render para el contador de vencimiento

    // ── Tabs ──
    const [tab, setTab] = useState<Tab>("sync");

    // ── Sync jobs ──
    const [jobs, setJobs] = useState<DianSyncJob[]>([]);
    const [jobsLoading, setJobsLoading] = useState(true);
    const [jobsRefresh, setJobsRefresh] = useState(0);

    // ── Documentos ──
    const [selectedJobId, setSelectedJobId] = useState<string>("");
    const [documents, setDocuments] = useState<DianDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docsPage, setDocsPage] = useState(1);
    const [docsTotal, setDocsTotal] = useState(0);
    const [docFilterGrupo, setDocFilterGrupo] = useState("");
    const [docFilterNit, setDocFilterNit] = useState("");
    const [docsRefresh, setDocsRefresh] = useState(0);

    // ── Eventos / Logs ──
    const [events, setEvents] = useState<DianEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [logs, setLogs] = useState<DianLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);

    // ── Modales ──
    const [isCredModalOpen, setIsCredModalOpen] = useState(false);
    const [credToRefresh, setCredToRefresh] = useState<DianCredential | null>(null);
    const [credForResponsible, setCredForResponsible] = useState<DianCredential | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [docForEvent, setDocForEvent] = useState<DianDocument | null>(null);
    const [credToDelete, setCredToDelete] = useState<DianCredential | null>(null);
    const [jobToDelete, setJobToDelete] = useState<DianSyncJob | null>(null);
    const [validatingId, setValidatingId] = useState<string>("");
    const [downloadingPdfs, setDownloadingPdfs] = useState<string>("");
    const [enrichingJob, setEnrichingJob] = useState<string>("");
    const [busyDelete, setBusyDelete] = useState(false);

    const docsTotalPages = Math.max(1, Math.ceil(docsTotal / PAGE_SIZE));
    const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;

    // ── Carga + polling de credenciales (cada 60s detecta credenciales vencidas/barridas) ──
    const loadCredentials = useCallback(async (silent = false) => {
        if (!silent) setCredLoading(true);
        try {
            const res = await listCredentials();
            const newIds = new Set(res.credentials.map((c) => c._id));
            // Detectar credenciales que desaparecieron (vencidas y barridas por el backend).
            for (const prev of prevCredIds.current) {
                if (!newIds.has(prev)) {
                    const old = credentials.find((c) => c._id === prev);
                    if (old) errorToast(`La credencial "${old.label || "(sin nombre)"}" (NIT ${old.nit}) venció y fue eliminada.`);
                }
            }
            prevCredIds.current = newIds;
            setCredentials(res.credentials);
            setModuleAvailable(true);
        } catch (error) {
            // El módulo DIAN es opcional: si no está configurado (503) no es un error del usuario,
            // solo significa que esta empresa aún no usa la sincronización con la DIAN.
            if (isDianModuleUnavailable(error)) {
                setModuleAvailable(false);
                setCredentials([]);
            } else if (!silent) {
                errorToast(error instanceof Error ? error.message : "Error al cargar credenciales");
            }
        } finally {
            if (!silent) setCredLoading(false);
        }
    }, [credentials]);

    useEffect(() => {
        loadCredentials();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const id = setInterval(() => loadCredentials(true), 60_000);
        return () => clearInterval(id);
    }, [loadCredentials]);

    // Tick cada 30s para refrescar el contador de vencimiento.
    useEffect(() => {
        const id = setInterval(() => forceTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // ── Carga de sync jobs ──
    const loadJobs = useCallback(async (silent = false) => {
        if (!silent) setJobsLoading(true);
        try {
            const res = await listSyncJobs(1, 50);
            setJobs(res.jobs);
        } catch (error) {
            if (!silent) errorToast(error instanceof Error ? error.message : "Error al cargar sincronizaciones");
        } finally {
            if (!silent) setJobsLoading(false);
        }
    }, []);

    useEffect(() => {
        loadJobs();
    }, [loadJobs, jobsRefresh]);

    // Polling cada 4s mientras haya jobs en queued/running.
    useEffect(() => {
        const hasActive = jobs.some((j) => j.status === "queued" || j.status === "running");
        if (!hasActive) return;
        const id = setInterval(async () => {
            try {
                const active = jobs.filter((j) => j.status === "queued" || j.status === "running");
                const updates = await Promise.all(active.map((j) => getSyncJob(j._id).then((r) => r.job).catch(() => null)));
                setJobs((prev) => prev.map((j) => updates.find((u) => u && u._id === j._id) || j));
            } catch {
                /* noop */
            }
        }, 4_000);
        return () => clearInterval(id);
    }, [jobs]);

    // ── Carga de documentos del job seleccionado ──
    useEffect(() => {
        if (!selectedJobId || tab !== "documents") return;
        let ignore = false;
        setDocsLoading(true);
        (async () => {
            try {
                const res = await listSyncDocuments(selectedJobId, {
                    page: docsPage,
                    pageSize: PAGE_SIZE,
                    grupo: docFilterGrupo || undefined,
                    nit_emisor: docFilterNit.trim() || undefined,
                });
                if (ignore) return;
                setDocuments(res.documents);
                setDocsTotal(res.total);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar documentos");
            } finally {
                if (!ignore) setDocsLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [selectedJobId, tab, docsPage, docFilterGrupo, docFilterNit, docsRefresh]);

    // ── Carga de eventos ──
    useEffect(() => {
        if (tab !== "events") return;
        let ignore = false;
        setEventsLoading(true);
        listEvents()
            .then((res) => { if (!ignore) setEvents(res.events); })
            .catch((error) => { if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar eventos"); })
            .finally(() => { if (!ignore) setEventsLoading(false); });
        return () => { ignore = true; };
    }, [tab]);

    // ── Carga de logs ──
    useEffect(() => {
        if (tab !== "logs") return;
        let ignore = false;
        setLogsLoading(true);
        listLogs(1, 50)
            .then((res) => { if (!ignore) setLogs(res.logs); })
            .catch((error) => { if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar la auditoría"); })
            .finally(() => { if (!ignore) setLogsLoading(false); });
        return () => { ignore = true; };
    }, [tab]);

    // ── Acciones ──
    const handleValidate = async (cred: DianCredential) => {
        setValidatingId(cred._id);
        try {
            await validateCredential(cred._id);
            successToast("Sesión DIAN válida.");
            loadCredentials(true);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo validar la sesión");
        } finally {
            setValidatingId("");
        }
    };

    const handleConfirmDeleteCred = async () => {
        if (!credToDelete) return;
        setBusyDelete(true);
        try {
            await deleteCredential(credToDelete._id);
            successToast("Credencial eliminada.");
            setCredToDelete(null);
            loadCredentials(true);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar la credencial");
        } finally {
            setBusyDelete(false);
        }
    };

    const handleConfirmDeleteJob = async () => {
        if (!jobToDelete) return;
        setBusyDelete(true);
        try {
            await deleteSyncJob(jobToDelete._id);
            successToast("Sincronización eliminada.");
            if (selectedJobId === jobToDelete._id) setSelectedJobId("");
            setJobToDelete(null);
            setJobsRefresh((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar la sincronización");
        } finally {
            setBusyDelete(false);
        }
    };

    const handleDownloadExcel = async (jobId: string) => {
        try {
            await downloadSyncExcel(jobId);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo descargar el Excel");
        }
    };

    const handleDownloadPdfs = async (jobId: string) => {
        setDownloadingPdfs(jobId);
        try {
            const meta = await downloadSyncPdfs(jobId);
            successToast(`PDFs descargados: ${meta.succeeded ?? 0}/${meta.total ?? 0}${meta.failed ? ` (${meta.failed} fallidos)` : ""}.`);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudieron descargar los PDFs");
        } finally {
            setDownloadingPdfs("");
        }
    };

    const handleEnrich = async (jobId: string) => {
        setEnrichingJob(jobId);
        try {
            const { result } = await enrichSyncJob(jobId);
            successToast(`Listo: ${result.providersCreated} proveedor(es) y ${result.itemsCreated} producto(s) creados desde los PDF.`);
            setJobsRefresh((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudieron leer los PDF");
        } finally {
            setEnrichingJob("");
        }
    };

    const handleViewDocuments = (jobId: string) => {
        setSelectedJobId(jobId);
        setDocsPage(1);
        setTab("documents");
    };

    const handleOpenPdf = async (docId: string) => {
        try {
            await openDocumentPdf(docId);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo abrir el PDF");
        }
    };

    const renderCredExpiry = (cred: DianCredential) => {
        const mins = minutesLeft(cred.token_expires_at);
        if (mins <= 0) return <span className="dian-badge dian-badge--danger">Vencido</span>;
        if (mins <= 5) return <span className="dian-badge dian-badge--warning">Por vencer · {mins}m</span>;
        return <span className="dian-badge dian-badge--ok">Vigente · {mins}m</span>;
    };

    const hasResponsible = (c: DianCredential) => !!(c.responsible_id && c.responsible_first_name && c.responsible_last_name);

    return (
        <main className="dian-page">
            <div className="dian-container">
                <div className="dian-header">
                    <div className="dian-header__content">
                        <h1>Sincronización con la DIAN</h1>
                        <p>Descarga tus facturas recibidas y emitidas desde el portal de la DIAN, lee los PDF para crear automáticamente proveedores y productos, y emite acuses de recibo.</p>
                    </div>
                </div>

                {/* ── Credenciales ── */}
                <section className="dian-card">
                    <div className="dian-card__head">
                        <h2><i className="ri-key-2-line"></i> Credenciales</h2>
                        <button className="btn-primary" onClick={() => { setCredToRefresh(null); setIsCredModalOpen(true); }} disabled={!moduleAvailable}>
                            <i className="ri-add-line"></i> Agregar credencial
                        </button>
                    </div>

                    {credLoading ? (
                        <div className="dian-empty"><p>Cargando credenciales...</p></div>
                    ) : !moduleAvailable ? (
                        <div className="dian-empty">
                            <i className="ri-information-line"></i>
                            <p>La sincronización con la DIAN no está habilitada para tu cuenta. Es un módulo opcional; si quieres usarlo, contacta al administrador para activarlo.</p>
                        </div>
                    ) : credentials.length === 0 ? (
                        <div className="dian-empty">
                            <i className="ri-government-line"></i>
                            <p>No hay credenciales. Agrega una pegando el enlace de acceso de la DIAN para empezar.</p>
                        </div>
                    ) : (
                        <div className="dian-cred-grid">
                            {credentials.map((cred) => (
                                <div className="dian-cred-card" key={cred._id}>
                                    <div className="dian-cred-card__top">
                                        <div>
                                            <strong>{cred.label || "(Sin nombre)"}</strong>
                                            <span className="dian-cred-card__nit">NIT {cred.nit}</span>
                                        </div>
                                        {renderCredExpiry(cred)}
                                    </div>
                                    <div className="dian-cred-card__meta">
                                        <span title="Datos del responsable para emitir eventos">
                                            <i className={hasResponsible(cred) ? "ri-checkbox-circle-line" : "ri-error-warning-line"}></i>
                                            Responsable: {hasResponsible(cred) ? "configurado" : "pendiente"}
                                        </span>
                                        {cred.last_login_at && <span><i className="ri-login-circle-line"></i> Último acceso: {fmtDateTime(cred.last_login_at)}</span>}
                                        {cred.last_login_error && <span className="dian-cred-card__err" title={cred.last_login_error}><i className="ri-error-warning-line"></i> {cred.last_login_error}</span>}
                                    </div>
                                    <div className="dian-cred-card__actions">
                                        <button className="btn-mini" onClick={() => handleValidate(cred)} disabled={validatingId === cred._id}>
                                            {validatingId === cred._id ? <i className="ri-loader-4-line rotating"></i> : <i className="ri-shield-check-line"></i>} Validar
                                        </button>
                                        <button className="btn-mini" onClick={() => { setCredToRefresh(cred); setIsCredModalOpen(true); }}>
                                            <i className="ri-refresh-line"></i> Refrescar
                                        </button>
                                        <button className="btn-mini" onClick={() => setCredForResponsible(cred)}>
                                            <i className="ri-user-settings-line"></i> Responsable
                                        </button>
                                        <button className="btn-mini btn-mini--danger" onClick={() => setCredToDelete(cred)}>
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Tabs ── */}
                <div className="dian-tabs" role="tablist">
                    <button className={`dian-tab ${tab === "sync" ? "active" : ""}`} role="tab" aria-selected={tab === "sync"} onClick={() => setTab("sync")}>
                        <i className="ri-refresh-line"></i> Sincronizaciones
                    </button>
                    <button className={`dian-tab ${tab === "documents" ? "active" : ""}`} role="tab" aria-selected={tab === "documents"} onClick={() => setTab("documents")}>
                        <i className="ri-file-list-3-line"></i> Documentos
                    </button>
                    <button className={`dian-tab ${tab === "events" ? "active" : ""}`} role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>
                        <i className="ri-mail-check-line"></i> Eventos
                    </button>
                    <button className={`dian-tab ${tab === "logs" ? "active" : ""}`} role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}>
                        <i className="ri-history-line"></i> Auditoría
                    </button>
                </div>

                {/* ── Tab Sincronizaciones ── */}
                {tab === "sync" && (
                    <section className="dian-card">
                        <div className="dian-card__head">
                            <h2>Historial de sincronizaciones</h2>
                            <button className="btn-primary" onClick={() => setIsSyncModalOpen(true)} disabled={credentials.length === 0}>
                                <i className="ri-refresh-line"></i> Nueva sincronización
                            </button>
                        </div>
                        {jobsLoading ? (
                            <div className="dian-empty"><p>Cargando...</p></div>
                        ) : jobs.length === 0 ? (
                            <div className="dian-empty"><p>Aún no has hecho sincronizaciones. Crea la primera con "Nueva sincronización".</p></div>
                        ) : (
                            <div className="dian-table-wrap">
                                <table className="dian-table">
                                    <thead>
                                        <tr>
                                            <th>Fecha</th><th>Rango</th><th>Grupo</th><th>Estado</th><th>Documentos</th><th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {jobs.map((job) => (
                                            <tr key={job._id} className={selectedJobId === job._id ? "is-selected" : ""}>
                                                <td data-label="Fecha">{fmtDateTime(job.created)}</td>
                                                <td data-label="Rango">{job.filters.fromDate} → {job.filters.toDate}</td>
                                                <td data-label="Grupo">{DIAN_GROUP_LABELS[(job.filters.group as keyof typeof DIAN_GROUP_LABELS) ?? "all"] ?? "Todos"}</td>
                                                <td data-label="Estado">
                                                    <span className={`dian-badge dian-status-${job.status}`}>
                                                        {(job.status === "queued" || job.status === "running") && <i className="ri-loader-4-line rotating"></i>} {syncStatusLabel[job.status] ?? job.status}
                                                    </span>
                                                    {(job.status === "running" || job.status === "queued") && job.progress && (
                                                        <div className="dian-progress-text">{job.progress}</div>
                                                    )}
                                                    {job.status === "failed" && job.error_message && <div className="dian-err-text" title={job.error_message}>{job.error_message}</div>}
                                                </td>
                                                <td data-label="Documentos">
                                                    {job.status === "completed" ? (
                                                        <div className="dian-doc-counts">
                                                            <span title="listados / nuevos / existentes">{job.total_listed} · <b>{job.total_imported}</b> nuevos</span>
                                                            {(!!job.enrich_providers_created || !!job.enrich_items_created) && (
                                                                <span className="dian-enrich-counts" title="Creados al leer los PDF">
                                                                    <i className="ri-robot-2-line"></i> {job.enrich_providers_created ?? 0} prov · {job.enrich_items_created ?? 0} prod
                                                                </span>
                                                            )}
                                                        </div>
                                                    ) : "—"}
                                                </td>
                                                <td data-label="Acciones">
                                                    <div className="dian-row-actions">
                                                        <button className="btn-icon" title="Ver documentos" onClick={() => handleViewDocuments(job._id)} disabled={job.status !== "completed" || job.total_listed === 0}>
                                                            <i className="ri-eye-line"></i>
                                                        </button>
                                                        <button className="btn-icon" title="Descargar Excel" onClick={() => handleDownloadExcel(job._id)} disabled={!job.excel_filename}>
                                                            <i className="ri-file-excel-2-line"></i>
                                                        </button>
                                                        <button className="btn-icon" title="Descargar PDFs (ZIP)" onClick={() => handleDownloadPdfs(job._id)} disabled={job.status !== "completed" || job.total_listed === 0 || downloadingPdfs === job._id}>
                                                            {downloadingPdfs === job._id ? <i className="ri-loader-4-line rotating"></i> : <i className="ri-file-zip-line"></i>}
                                                        </button>
                                                        <button className="btn-icon" title="Leer PDFs → crear proveedores y productos" onClick={() => handleEnrich(job._id)} disabled={job.status !== "completed" || job.total_listed === 0 || enrichingJob === job._id}>
                                                            {enrichingJob === job._id ? <i className="ri-loader-4-line rotating"></i> : <i className="ri-robot-2-line"></i>}
                                                        </button>
                                                        <button className="btn-icon btn-icon-danger" title="Eliminar" onClick={() => setJobToDelete(job)}>
                                                            <i className="ri-delete-bin-line"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* ── Tab Documentos ── */}
                {tab === "documents" && (
                    <section className="dian-card">
                        <div className="dian-card__head">
                            <h2>Documentos {selectedJob && <span className="dian-subtle">· {selectedJob.filters.fromDate} → {selectedJob.filters.toDate}</span>}</h2>
                        </div>
                        {!selectedJobId ? (
                            <div className="dian-empty"><p>Selecciona una sincronización completada (botón <i className="ri-eye-line"></i>) para ver sus documentos.</p></div>
                        ) : (
                            <>
                                <div className="dian-filters">
                                    <select value={docFilterGrupo} onChange={(e) => { setDocFilterGrupo(e.target.value); setDocsPage(1); }}>
                                        <option value="">Todos los grupos</option>
                                        <option value="Recibido">Recibidos</option>
                                        <option value="Emitido">Emitidos</option>
                                    </select>
                                    <input
                                        type="text"
                                        placeholder="Filtrar por NIT emisor"
                                        value={docFilterNit}
                                        onChange={(e) => { setDocFilterNit(e.target.value); setDocsPage(1); }}
                                    />
                                    <button className="btn-mini" onClick={() => setDocsRefresh((k) => k + 1)}><i className="ri-refresh-line"></i> Actualizar</button>
                                </div>
                                {docsLoading ? (
                                    <div className="dian-empty"><p>Cargando documentos...</p></div>
                                ) : documents.length === 0 ? (
                                    <div className="dian-empty"><p>No hay documentos con esos filtros.</p></div>
                                ) : (
                                    <>
                                        <div className="dian-table-wrap">
                                            <table className="dian-table">
                                                <thead>
                                                    <tr>
                                                        <th>Fecha</th><th>Tipo</th><th>Documento</th><th>Emisor</th><th>Receptor</th><th>Total</th><th>Grupo</th><th>Acciones</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {documents.map((doc) => (
                                                        <tr key={doc._id}>
                                                            <td data-label="Fecha">{fmtDate(doc.fecha_emision)}</td>
                                                            <td data-label="Tipo">{doc.tipo_documento || "—"}</td>
                                                            <td data-label="Documento" className="cell-strong">{doc.prefijo}{doc.folio ? `-${doc.folio}` : ""}</td>
                                                            <td data-label="Emisor" title={doc.cufe}>{doc.nombre_emisor || doc.nit_emisor || "—"}</td>
                                                            <td data-label="Receptor">{doc.nombre_receptor || doc.nit_receptor || "—"}</td>
                                                            <td data-label="Total">{formatCOP(doc.total)}</td>
                                                            <td data-label="Grupo"><span className="dian-badge dian-badge--soft">{doc.grupo || "—"}</span></td>
                                                            <td data-label="Acciones">
                                                                <div className="dian-row-actions">
                                                                    <button className="btn-icon" title="Abrir PDF" onClick={() => handleOpenPdf(doc._id)}>
                                                                        <i className="ri-file-pdf-2-line"></i>
                                                                    </button>
                                                                    {doc.grupo === "Recibido" && (
                                                                        <button className="btn-icon" title="Emitir evento (acuse)" onClick={() => setDocForEvent(doc)}>
                                                                            <i className="ri-mail-check-line"></i>
                                                                        </button>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                        <div className="pagination pagination--bottom">
                                            <button onClick={() => setDocsPage((p) => Math.max(1, p - 1))} disabled={docsPage === 1 || docsLoading}>Anterior</button>
                                            <span className="pagination__info">Página {docsPage} de {docsTotalPages}</span>
                                            <button onClick={() => setDocsPage((p) => Math.min(docsTotalPages, p + 1))} disabled={docsPage >= docsTotalPages || docsLoading}>Siguiente</button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </section>
                )}

                {/* ── Tab Eventos ── */}
                {tab === "events" && (
                    <section className="dian-card">
                        <div className="dian-card__head"><h2>Eventos emitidos</h2></div>
                        {eventsLoading ? (
                            <div className="dian-empty"><p>Cargando eventos...</p></div>
                        ) : events.length === 0 ? (
                            <div className="dian-empty"><p>Aún no has emitido eventos. Hazlo desde la pestaña Documentos.</p></div>
                        ) : (
                            <div className="dian-table-wrap">
                                <table className="dian-table">
                                    <thead>
                                        <tr><th>Fecha</th><th>Tipo</th><th>CUFE</th><th>Estado</th></tr>
                                    </thead>
                                    <tbody>
                                        {events.map((ev) => (
                                            <tr key={ev._id}>
                                                <td data-label="Fecha">{fmtDateTime(ev.emitted_at || ev.created)}</td>
                                                <td data-label="Tipo">{ev.event_code} · {DIAN_EVENT_LABELS[ev.event_code as DianEventCode] ?? ""}</td>
                                                <td data-label="CUFE" className="cell-cufe" title={ev.cufe}>{ev.cufe.slice(0, 20)}…</td>
                                                <td data-label="Estado">
                                                    <span className={`dian-badge dian-event-${ev.status}`}>{ev.status === "emitted" ? "Emitido" : ev.status === "failed" ? "Fallido" : "Pendiente"}</span>
                                                    {ev.status === "failed" && ev.error_message && <div className="dian-err-text" title={ev.error_message}>{ev.error_message}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}

                {/* ── Tab Auditoría ── */}
                {tab === "logs" && (
                    <section className="dian-card">
                        <div className="dian-card__head"><h2>Auditoría</h2></div>
                        {logsLoading ? (
                            <div className="dian-empty"><p>Cargando...</p></div>
                        ) : logs.length === 0 ? (
                            <div className="dian-empty"><p>Sin registros todavía.</p></div>
                        ) : (
                            <div className="dian-table-wrap">
                                <table className="dian-table">
                                    <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th></tr></thead>
                                    <tbody>
                                        {logs.map((log) => (
                                            <tr key={log._id}>
                                                <td data-label="Fecha">{fmtDateTime(log.createdAt)}</td>
                                                <td data-label="Evento"><span className={`dian-badge ${log.event.endsWith("FAIL") ? "dian-badge--danger" : "dian-badge--soft"}`}>{log.event}</span></td>
                                                <td data-label="Detalle">{log.message || "—"}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                )}
            </div>

            {/* ── Modales ── */}
            <CredentialModal
                isOpen={isCredModalOpen}
                onClose={() => { setIsCredModalOpen(false); setCredToRefresh(null); }}
                onSuccess={() => loadCredentials(true)}
                credential={credToRefresh}
            />
            <ResponsibleModal
                isOpen={!!credForResponsible}
                onClose={() => setCredForResponsible(null)}
                onSuccess={() => loadCredentials(true)}
                credential={credForResponsible}
            />
            <SyncModal
                isOpen={isSyncModalOpen}
                onClose={() => setIsSyncModalOpen(false)}
                onSuccess={() => setJobsRefresh((k) => k + 1)}
                credentials={credentials}
            />
            <EventModal
                isOpen={!!docForEvent}
                onClose={() => setDocForEvent(null)}
                onSuccess={() => setTab("events")}
                credentialId={selectedJob?.credential_id ?? ""}
                document={docForEvent}
            />
            <ConfirmModal
                isOpen={!!credToDelete}
                onClose={() => setCredToDelete(null)}
                onConfirm={handleConfirmDeleteCred}
                title="¿Eliminar credencial?"
                message={`Se eliminará la credencial "${credToDelete?.label || ""}" (NIT ${credToDelete?.nit ?? ""}). Los datos históricos (sincronizaciones, documentos, eventos) se conservan.`}
                confirmText="Eliminar"
                type="danger"
                loading={busyDelete}
            />
            <ConfirmModal
                isOpen={!!jobToDelete}
                onClose={() => setJobToDelete(null)}
                onConfirm={handleConfirmDeleteJob}
                title="¿Eliminar sincronización?"
                message="Se eliminará el job y sus documentos asociados. Esta acción no se puede deshacer."
                confirmText="Eliminar"
                type="danger"
                loading={busyDelete}
            />
        </main>
    );
};

export default DianSyncPage;

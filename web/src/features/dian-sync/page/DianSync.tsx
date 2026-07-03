import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "../../purchases/page/Purchases.css";
import "./DianSync.css";
import {
    getDianStatus,
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
    retryPdfs,
    cancelSyncJob,
    importDianExcel,
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
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import {
    ListPageShell,
    ListPageContainer,
    ListPageHeader,
    PaginationToolbar,
    paginationRange,
    FilterField,
    FieldControl,
    useEffectiveViewMode,
    ColumnFilterFields,
    useColumnFilters,
    type ColumnFilterDef,
    type ViewMode,
} from "../../../components/design-system";
import { useLedgerFiltersPanel } from "../../ledger/hooks/useLedgerFiltersPanel";
import { useClientPagination } from "../../ledger/hooks/useClientPagination";
import { normalizePageSize, PAGE_SIZE_OPTIONS } from "../../ledger/ledgerFormat";
import { docLabel, syncJobLabel } from "../../dian-reconcile/reconcileUi";

type Tab = "sync" | "documents" | "events" | "logs";

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
    cancelled: "Cancelado",
};

/** Badge de la clasificación del documento (venta / compra / ajena). */
const clasifBadge = (c?: string) => {
    if (c === "venta") return <span className="dian-badge dian-badge--ok">Venta</span>;
    if (c === "compra") return <span className="dian-badge dian-badge--soft" style={{ background: "rgba(90,159,180,.15)", color: "var(--accent-teal)" }}>Compra/gasto</span>;
    if (c === "ajena") return <span className="dian-badge dian-badge--warning">Ajena</span>;
    return <span className="dian-badge dian-badge--soft">—</span>;
};

const toIsoDate = (d?: string) => {
    if (!d) return "";
    const dt = new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const JOBS_COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "rango", label: "Rango", type: "text", icon: "ri-calendar-2-line" },
    { id: "grupo", label: "Grupo", type: "text", icon: "ri-folder-3-line" },
    { id: "estado", label: "Estado", type: "text", icon: "ri-filter-3-line" },
    { id: "documentos", label: "Documentos", type: "number", icon: "ri-file-list-3-line" },
];

const DOCS_COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "tipo", label: "Tipo", type: "text", icon: "ri-file-text-line" },
    { id: "documento", label: "Documento", type: "text", icon: "ri-file-list-3-line" },
    { id: "emisor", label: "Emisor", type: "text", icon: "ri-building-line", serverSide: true },
    { id: "receptor", label: "Receptor", type: "text", icon: "ri-user-line" },
    { id: "total", label: "Total", type: "number", icon: "ri-money-dollar-circle-line" },
    { id: "clasificacion", label: "Clasificación", type: "select", icon: "ri-filter-3-line", serverSide: true, options: [{ value: "venta", label: "Ventas" }, { value: "compra", label: "Compras" }, { value: "ajena", label: "Ajenas" }] },
];

const EVENTS_COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "tipo", label: "Tipo", type: "text", icon: "ri-mail-check-line" },
    { id: "cufe", label: "CUFE", type: "text", icon: "ri-search-line", serverSide: true },
    { id: "estado", label: "Estado", type: "select", icon: "ri-toggle-line", options: [{ value: "emitted", label: "Emitido" }, { value: "failed", label: "Fallido" }, { value: "pending", label: "Pendiente" }] },
];

const LOGS_COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
    { id: "evento", label: "Evento", type: "text", icon: "ri-history-line" },
    { id: "detalle", label: "Detalle", type: "text", icon: "ri-file-text-line" },
];

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
    const [jobsPage, setJobsPage] = useState(1);
    const [jobsPageSize, setJobsPageSize] = useState(20);
    const [jobsTotal, setJobsTotal] = useState(0);

    // ── Documentos ──
    const [selectedJobId, setSelectedJobId] = useState<string>("");
    const [documents, setDocuments] = useState<DianDocument[]>([]);
    const [docsLoading, setDocsLoading] = useState(false);
    const [docsPage, setDocsPage] = useState(1);
    const [docsPageSize, setDocsPageSize] = useState(20);
    const [docsTotal, setDocsTotal] = useState(0);
    const [docFilterClasif, setDocFilterClasif] = useState("");
    const [docFilterNit, setDocFilterNit] = useState("");
    const debouncedDocFilterNit = useDebouncedValue(docFilterNit, FILTER_DEBOUNCE_MS);
    const [docsRefresh, setDocsRefresh] = useState(0);

    // ── Eventos / Logs ──
    const [events, setEvents] = useState<DianEvent[]>([]);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventFilterCode, setEventFilterCode] = useState("");
    const [eventFilterCufe, setEventFilterCufe] = useState("");
    const debouncedEventCufe = useDebouncedValue(eventFilterCufe, FILTER_DEBOUNCE_MS);
    const [logs, setLogs] = useState<DianLog[]>([]);
    const [logsLoading, setLogsLoading] = useState(false);
    const [logsPage, setLogsPage] = useState(1);
    const [logsPageSize, setLogsPageSize] = useState(20);
    const [logsTotal, setLogsTotal] = useState(0);

    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    // ── Modales ──
    const [isCredModalOpen, setIsCredModalOpen] = useState(false);
    const [credToRefresh, setCredToRefresh] = useState<DianCredential | null>(null);
    const [credForResponsible, setCredForResponsible] = useState<DianCredential | null>(null);
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
    const [docForEvent, setDocForEvent] = useState<DianDocument | null>(null);
    const [credToDelete, setCredToDelete] = useState<DianCredential | null>(null);
    const [jobToDelete, setJobToDelete] = useState<DianSyncJob | null>(null);
    const [jobToEnrich, setJobToEnrich] = useState<DianSyncJob | null>(null);
    const [validatingId, setValidatingId] = useState<string>("");
    const [downloadingPdfs, setDownloadingPdfs] = useState<string>("");
    const [enrichingJob, setEnrichingJob] = useState<string>("");
    const [retryingPdfs, setRetryingPdfs] = useState<string>("");
    const [importingExcel, setImportingExcel] = useState(false);
    const importInputRef = useRef<HTMLInputElement>(null);
    const [busyDelete, setBusyDelete] = useState(false);

    const jobsTotalPages = Math.max(1, Math.ceil(jobsTotal / jobsPageSize));
    const docsTotalPages = Math.max(1, Math.ceil(docsTotal / docsPageSize));
    const logsTotalPages = Math.max(1, Math.ceil(logsTotal / logsPageSize));
    const selectedJob = jobs.find((j) => j._id === selectedJobId) || null;
    const { start: docsRangeStart, end: docsRangeEnd } = paginationRange(docsPage, docsPageSize, docsTotal);
    const { start: jobsRangeStart, end: jobsRangeEnd } = paginationRange(jobsPage, jobsPageSize, jobsTotal);
    const { start: logsRangeStart, end: logsRangeEnd } = paginationRange(logsPage, logsPageSize, logsTotal);

    const hasActiveDocFilters = docFilterClasif !== "" || docFilterNit.trim() !== "";
    const hasActiveEventFilters = eventFilterCode !== "" || eventFilterCufe.trim() !== "";

    const getJobRowValue = useCallback((job: DianSyncJob, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(job.created);
            case "rango": return `${job.filters.fromDate} ${job.filters.toDate}`;
            case "grupo": return DIAN_GROUP_LABELS[(job.filters.group as keyof typeof DIAN_GROUP_LABELS) ?? "all"] ?? "Todos";
            case "estado": return syncStatusLabel[job.status] ?? job.status;
            case "documentos": return String(job.total_listed ?? 0);
            default: return "";
        }
    }, []);
    const getDocRowValue = useCallback((doc: DianDocument, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(doc.fecha_emision);
            case "tipo": return doc.tipo_documento ?? "";
            case "documento": return docLabel(doc.prefijo, doc.folio);
            case "emisor": return doc.nombre_emisor || doc.nit_emisor || "";
            case "receptor": return doc.nombre_receptor || doc.nit_receptor || "";
            case "total": return String(doc.total ?? 0);
            case "clasificacion": return doc.clasificacion ?? "";
            default: return "";
        }
    }, []);
    const getEventRowValue = useCallback((ev: DianEvent, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(ev.emitted_at || ev.created);
            case "tipo": return `${ev.event_code} ${DIAN_EVENT_LABELS[ev.event_code as DianEventCode] ?? ""}`;
            case "cufe": return ev.cufe ?? "";
            case "estado": return ev.status ?? "";
            default: return "";
        }
    }, []);
    const getLogRowValue = useCallback((log: DianLog, filterId: string): string => {
        switch (filterId) {
            case "fecha": return toIsoDate(log.createdAt);
            case "evento": return log.event ?? "";
            case "detalle": return log.message ?? "";
            default: return "";
        }
    }, []);

    const { values: jobsColValues, setFilter: setJobsColFilter, clearFilters: clearJobsColFilters, hasActiveClientFilters: hasActiveJobsColFilters, filterRows: filterJobRows } =
        useColumnFilters(JOBS_COLUMN_FILTER_DEFS, getJobRowValue);
    const { values: docsColValues, setFilter: setDocsColFilter, clearFilters: clearDocsColFilters, hasActiveClientFilters: hasActiveDocsColFilters, filterRows: filterDocRows } =
        useColumnFilters(DOCS_COLUMN_FILTER_DEFS, getDocRowValue);
    const { values: eventsColValues, setFilter: setEventsColFilter, clearFilters: clearEventsColFilters, hasActiveClientFilters: hasActiveEventsColFilters, filterRows: filterEventRows } =
        useColumnFilters(EVENTS_COLUMN_FILTER_DEFS, getEventRowValue);
    const { values: logsColValues, setFilter: setLogsColFilter, clearFilters: clearLogsColFilters, hasActiveClientFilters: hasActiveLogsColFilters, filterRows: filterLogRows } =
        useColumnFilters(LOGS_COLUMN_FILTER_DEFS, getLogRowValue);

    const displayedJobs = useMemo(() => filterJobRows(jobs), [jobs, filterJobRows]);
    const displayedDocuments = useMemo(() => filterDocRows(documents), [documents, filterDocRows]);

    const filteredEvents = useMemo(() => {
        let list = events;
        if (eventFilterCode) list = list.filter((ev) => ev.event_code === eventFilterCode);
        const cufe = debouncedEventCufe.trim();
        if (cufe) list = list.filter((ev) => ev.cufe.includes(cufe));
        return filterEventRows(list);
    }, [events, eventFilterCode, debouncedEventCufe, filterEventRows]);

    const displayedLogs = useMemo(() => filterLogRows(logs), [logs, filterLogRows]);

    const eventsPagination = useClientPagination(filteredEvents, [eventFilterCode, debouncedEventCufe, eventsColValues], 20);

    const handleJobsPageChange = (nextPage: number) => setJobsPage(Math.max(1, Math.min(jobsTotalPages, nextPage)));
    const handleJobsPageSizeChange = (next: number) => {
        setJobsPageSize(normalizePageSize(next));
        setJobsPage(1);
    };

    const handleDocsPageChange = (nextPage: number) => setDocsPage(Math.max(1, Math.min(docsTotalPages, nextPage)));
    const handleDocsPageSizeChange = (next: number) => {
        setDocsPageSize(normalizePageSize(next));
        setDocsPage(1);
    };

    const handleLogsPageChange = (nextPage: number) => setLogsPage(Math.max(1, Math.min(logsTotalPages, nextPage)));
    const handleLogsPageSizeChange = (next: number) => {
        setLogsPageSize(normalizePageSize(next));
        setLogsPage(1);
    };

    const didMountDocFilters = useRef(false);
    useEffect(() => {
        if (!didMountDocFilters.current) {
            didMountDocFilters.current = true;
            return;
        }
        setDocsPage(1);
    }, [docFilterClasif, debouncedDocFilterNit, docsPageSize]);

    useEffect(() => {
        if (docsPage > docsTotalPages) setDocsPage(docsTotalPages);
    }, [docsPage, docsTotalPages]);

    useEffect(() => {
        if (jobsPage > jobsTotalPages) setJobsPage(jobsTotalPages);
    }, [jobsPage, jobsTotalPages]);

    useEffect(() => {
        if (logsPage > logsTotalPages) setLogsPage(logsTotalPages);
    }, [logsPage, logsTotalPages]);

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

    // Al montar, primero consultamos el ESTADO del módulo (no lanza 503). Si está apagado por
    // defecto, no cargamos credenciales ni hacemos polling — así no se generan errores de fondo.
    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const { enabled } = await getDianStatus();
                if (cancelled) return;
                if (!enabled) {
                    setModuleAvailable(false);
                    setCredLoading(false);
                    setJobsLoading(false);
                    return;
                }
                setModuleAvailable(true);
                loadCredentials();
            } catch {
                if (!cancelled) { setModuleAvailable(false); setCredLoading(false); }
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // El polling de credenciales (cada 60s) solo corre con el módulo activo.
    useEffect(() => {
        if (!moduleAvailable) return;
        const id = setInterval(() => loadCredentials(true), 60_000);
        return () => clearInterval(id);
    }, [loadCredentials, moduleAvailable]);

    // Tick cada 30s para refrescar el contador de vencimiento.
    useEffect(() => {
        const id = setInterval(() => forceTick((n) => n + 1), 30_000);
        return () => clearInterval(id);
    }, []);

    // ── Carga de sync jobs ──
    const loadJobs = useCallback(async (silent = false) => {
        if (!silent) setJobsLoading(true);
        try {
            const res = await listSyncJobs(jobsPage, jobsPageSize);
            setJobs(res.jobs);
            setJobsTotal(res.total);
        } catch (error) {
            if (!silent) errorToast(error instanceof Error ? error.message : "Error al cargar sincronizaciones");
        } finally {
            if (!silent) setJobsLoading(false);
        }
    }, [jobsPage, jobsPageSize]);

    useEffect(() => {
        if (!moduleAvailable) return;
        loadJobs();
    }, [loadJobs, jobsRefresh, moduleAvailable]);

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
                    pageSize: docsPageSize,
                    clasificacion: docFilterClasif || undefined,
                    nit_emisor: debouncedDocFilterNit.trim() || undefined,
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
    }, [selectedJobId, tab, docsPage, docFilterClasif, debouncedDocFilterNit, docsPageSize, docsRefresh]);

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
        listLogs(logsPage, logsPageSize)
            .then((res) => {
                if (!ignore) {
                    setLogs(res.logs);
                    setLogsTotal(res.total);
                }
            })
            .catch((error) => { if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar la auditoría"); })
            .finally(() => { if (!ignore) setLogsLoading(false); });
        return () => { ignore = true; };
    }, [tab, logsPage, logsPageSize]);

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

    const handleCancel = async (jobId: string) => {
        try {
            const r = await cancelSyncJob(jobId);
            successToast(r.message);
            setJobsRefresh((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo cancelar el proceso");
        }
    };

    const handleRetryPdfs = async (jobId: string) => {
        setRetryingPdfs(jobId);
        // Marca el job como "running" localmente para que arranque el polling y se vea el progreso en vivo.
        setJobs((prev) => prev.map((j) => (j._id === jobId ? { ...j, status: "running" as const, progress: "Reanudando descarga de PDFs…" } : j)));
        try {
            const r = await retryPdfs(jobId);
            successToast(r.message);
            setJobsRefresh((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudieron reintentar los PDFs");
            setJobsRefresh((k) => k + 1);
        } finally {
            setRetryingPdfs("");
        }
    };

    const handleImportExcel = async (file: File | null) => {
        if (!file) return;
        setImportingExcel(true);
        try {
            // Si hay una credencial vigente, la usamos para descargar los PDFs del Excel importado.
            const cred = credentials[0];
            await importDianExcel(file, cred?._id);
            successToast("Importación iniciada. Procesando documentos del Excel…");
            setJobsRefresh((k) => k + 1);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo importar el Excel");
        } finally {
            setImportingExcel(false);
            if (importInputRef.current) importInputRef.current.value = "";
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

    const clearDocFilters = () => {
        setDocFilterClasif("");
        setDocFilterNit("");
        clearDocsColFilters();
    };

    const clearEventFilters = () => {
        setEventFilterCode("");
        setEventFilterCufe("");
        clearEventsColFilters();
    };

    const { filtersToolbar: docsFiltersToolbar, filtersMobileDrawer: docsFiltersDrawer } = useLedgerFiltersPanel({
        panelId: "dian-sync-docs",
        title: "Filtrar documentos",
        hasActiveFilters: hasActiveDocFilters || hasActiveDocsColFilters,
        onClear: clearDocFilters,
        repositionDeps: [docFilterClasif, docFilterNit, selectedJobId, docsColValues],
        filterContent: (
            <>
                <FilterField label="Sincronización" htmlFor="dian-docs-job" icon="ri-refresh-line">
                    <FieldControl
                        id="dian-docs-job"
                        as="select"
                        value={selectedJobId}
                        onChange={(e) => {
                            setSelectedJobId(e.target.value);
                            setDocsPage(1);
                        }}
                    >
                        <option value="">Selecciona una sincronización</option>
                        {jobs.filter((j) => j.status === "completed" && j.total_listed > 0).map((j) => (
                            <option key={j._id} value={j._id}>
                                {syncJobLabel(j)}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="Clasificación" htmlFor="dian-docs-clasif" icon="ri-filter-3-line">
                    <FieldControl
                        id="dian-docs-clasif"
                        as="select"
                        value={docFilterClasif}
                        onChange={(e) => setDocFilterClasif(e.target.value)}
                    >
                        <option value="">Todas las clasificaciones</option>
                        <option value="venta">Ventas (emitidas)</option>
                        <option value="compra">Compras / gastos</option>
                        <option value="ajena">Ajenas</option>
                    </FieldControl>
                </FilterField>
                <FilterField label="NIT emisor" htmlFor="dian-docs-nit" icon="ri-building-line">
                    <FieldControl
                        id="dian-docs-nit"
                        type="text"
                        value={docFilterNit}
                        onChange={(e) => setDocFilterNit(e.target.value)}
                        placeholder="Filtrar por NIT emisor"
                    />
                </FilterField>
                <ColumnFilterFields defs={DOCS_COLUMN_FILTER_DEFS} values={docsColValues} onChange={setDocsColFilter} />
            </>
        ),
    });

    const { filtersToolbar: eventsFiltersToolbar, filtersMobileDrawer: eventsFiltersDrawer } = useLedgerFiltersPanel({
        panelId: "dian-sync-events",
        title: "Filtrar eventos",
        hasActiveFilters: hasActiveEventFilters || hasActiveEventsColFilters,
        onClear: clearEventFilters,
        repositionDeps: [eventFilterCode, eventFilterCufe, eventsColValues],
        filterContent: (
            <>
                <FilterField label="Tipo de evento" htmlFor="dian-ev-code" icon="ri-mail-check-line">
                    <FieldControl
                        id="dian-ev-code"
                        as="select"
                        value={eventFilterCode}
                        onChange={(e) => setEventFilterCode(e.target.value)}
                    >
                        <option value="">Todos</option>
                        {(Object.keys(DIAN_EVENT_LABELS) as DianEventCode[]).map((code) => (
                            <option key={code} value={code}>
                                {code} · {DIAN_EVENT_LABELS[code]}
                            </option>
                        ))}
                    </FieldControl>
                </FilterField>
                <FilterField label="CUFE" htmlFor="dian-ev-cufe" icon="ri-search-line">
                    <FieldControl
                        id="dian-ev-cufe"
                        type="text"
                        value={eventFilterCufe}
                        onChange={(e) => setEventFilterCufe(e.target.value)}
                        placeholder="Buscar por CUFE"
                    />
                </FilterField>
                <ColumnFilterFields defs={EVENTS_COLUMN_FILTER_DEFS} values={eventsColValues} onChange={setEventsColFilter} />
            </>
        ),
    });

    const { filtersToolbar: jobsFiltersToolbar, filtersMobileDrawer: jobsFiltersDrawer } = useLedgerFiltersPanel({
        panelId: "dian-sync-jobs",
        title: "Filtrar sincronizaciones",
        hasActiveFilters: hasActiveJobsColFilters,
        onClear: clearJobsColFilters,
        repositionDeps: [jobsColValues],
        filterContent: (
            <ColumnFilterFields defs={JOBS_COLUMN_FILTER_DEFS} values={jobsColValues} onChange={setJobsColFilter} />
        ),
    });

    const { filtersToolbar: logsFiltersToolbar, filtersMobileDrawer: logsFiltersDrawer } = useLedgerFiltersPanel({
        panelId: "dian-sync-logs",
        title: "Filtrar auditoría",
        hasActiveFilters: hasActiveLogsColFilters,
        onClear: clearLogsColFilters,
        repositionDeps: [logsColValues],
        filterContent: (
            <ColumnFilterFields defs={LOGS_COLUMN_FILTER_DEFS} values={logsColValues} onChange={setLogsColFilter} />
        ),
    });

    const renderJobDocumentsCell = (job: DianSyncJob) => {
        const pdfTarget = job.total_pdf_target ?? job.total_listed;
        const pdfDone = job.total_downloaded ?? 0;
        const pdfMissing = Math.max(0, pdfTarget - pdfDone);
        if (job.status === "completed") {
    return (
                <div className="dian-doc-counts">
                    <span title="listados / nuevos / existentes">
                        {job.total_listed} · <b>{job.total_imported}</b> nuevos
                    </span>
                    <span className="dian-enrich-counts" title="PDFs descargados / total (sin acuses)" style={{ color: pdfMissing > 0 ? "var(--tertiary-color)" : undefined }}>
                        <i className="ri-file-pdf-2-line"></i> {pdfDone}/{pdfTarget} PDFs
                        {pdfMissing > 0 && <> · faltan {pdfMissing}</>}
                    </span>
                    {(!!job.enrich_providers_created || !!job.enrich_items_created) && (
                        <span className="dian-enrich-counts" title="Creados al leer los PDF">
                            <i className="ri-robot-2-line"></i> {job.enrich_providers_created ?? 0} prov · {job.enrich_items_created ?? 0} prod
                        </span>
                    )}
                </div>
            );
        }
        if (job.status === "running" || job.status === "queued") {
            const m = (job.progress || "").match(/(\d+)\s*\/\s*(\d+)/);
            if (m) {
                const done = Number(m[1]);
                const total = Number(m[2]);
                const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                return (
                    <div className="dian-doc-counts">
                        <span><b>{done}</b> de {total} PDFs</span>
                        <div className="dian-progress-bar"><div className="dian-progress-bar__fill" style={{ width: `${pct}%` }} /></div>
                    </div>
                );
            }
            return <span className="dian-subtle">Procesando…</span>;
        }
        if (job.status === "failed" || job.status === "cancelled") {
            return (
                <span className="dian-enrich-counts" title="PDFs alcanzados antes de suspender (sin acuses)" style={{ color: "var(--tertiary-color)" }}>
                    <i className="ri-file-pdf-2-line"></i> {pdfDone}/{pdfTarget} PDFs
                </span>
            );
        }
        return "—";
    };

    const renderJobStatusCell = (job: DianSyncJob) => (
        <>
            <span className={`dian-badge dian-status-${job.status}`}>
                {(job.status === "queued" || job.status === "running") && <i className="ri-loader-4-line rotating"></i>}{" "}
                {syncStatusLabel[job.status] ?? job.status}
            </span>
            {(job.status === "running" || job.status === "queued") && job.progress && (
                <div className="dian-progress-text">{job.progress}</div>
            )}
            {(job.status === "failed" || job.status === "cancelled") && (job.error_message || job.progress) && (
                <div className="dian-err-text" title={job.error_message || job.progress}>{job.error_message || job.progress}</div>
            )}
        </>
    );

    const renderJobActions = (job: DianSyncJob, layout: "table" | "list" | "cards" = "table") => {
        const pdfTarget = job.total_pdf_target ?? job.total_listed;
        const pdfDone = job.total_downloaded ?? 0;
        const pdfMissing = Math.max(0, pdfTarget - pdfDone);
        const compact = layout !== "table";
        return (
            <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
                <button type="button" className="btn-action" title="Ver documentos" onClick={() => handleViewDocuments(job._id)} disabled={job.status !== "completed" || job.total_listed === 0}>
                    <i className="ri-eye-line" aria-hidden />
                    {!compact && " Documentos"}
                </button>
                <button type="button" className="btn-action" title="Descargar Excel" onClick={() => handleDownloadExcel(job._id)} disabled={!job.excel_filename}>
                    <i className="ri-file-excel-2-line" aria-hidden />
                    {!compact && " Excel"}
                </button>
                <button type="button" className="btn-action" title="Descargar PDFs (ZIP)" onClick={() => handleDownloadPdfs(job._id)} disabled={job.status !== "completed" || job.total_listed === 0 || downloadingPdfs === job._id}>
                    {downloadingPdfs === job._id ? <i className="ri-loader-4-line rotating" aria-hidden /> : <i className="ri-file-zip-line" aria-hidden />}
                    {!compact && " PDFs"}
                </button>
                {(job.status === "running" || job.status === "queued") && (
                    <button type="button" className="btn-action" title="Cancelar el proceso" onClick={() => handleCancel(job._id)}>
                        <i className="ri-stop-circle-line" aria-hidden />
                        {!compact && " Cancelar"}
                    </button>
                )}
                {job.status !== "running" && job.status !== "queued" && pdfMissing > 0 ? (
                    <button type="button" className="btn-secondary" onClick={() => handleRetryPdfs(job._id)} disabled={retryingPdfs === job._id} title="Continúa la descarga de PDFs faltantes">
                        {retryingPdfs === job._id ? <i className="ri-loader-4-line rotating" aria-hidden /> : <i className="ri-play-circle-line" aria-hidden />}
                        {!compact && ` Faltantes (${pdfMissing})`}
                    </button>
                ) : (
                    <button type="button" className="btn-action" title="Reintentar PDFs faltantes" onClick={() => handleRetryPdfs(job._id)} disabled={job.total_listed === 0 || retryingPdfs === job._id || job.status === "running" || job.status === "queued"}>
                        {retryingPdfs === job._id ? <i className="ri-loader-4-line rotating" aria-hidden /> : <i className="ri-download-cloud-2-line" aria-hidden />}
                    </button>
                )}
                <button type="button" className="btn-action" title="Leer PDFs → proveedores y productos" onClick={() => setJobToEnrich(job)} disabled={job.status !== "completed" || job.total_listed === 0 || enrichingJob === job._id}>
                    {enrichingJob === job._id ? <i className="ri-loader-4-line rotating" aria-hidden /> : <i className="ri-robot-2-line" aria-hidden />}
                    {!compact && " Enriquecer"}
                </button>
                <button type="button" className="btn-action" title="Eliminar" onClick={() => setJobToDelete(job)}>
                    <i className="ri-delete-bin-line" aria-hidden />
                </button>
            </div>
        );
    };

    const renderDocActions = (doc: DianDocument, layout: "table" | "list" | "cards" = "table") => {
        const compact = layout !== "table";
        return (
            <div className={`action-buttons ds-row-actions purchases-actions--${layout}`}>
                <button type="button" className="btn-action" title="Abrir PDF" onClick={() => handleOpenPdf(doc._id)}>
                    <i className="ri-file-pdf-2-line" aria-hidden />
                    {!compact && " PDF"}
                </button>
                {doc.clasificacion === "compra" && (
                    <button type="button" className="btn-action" title="Emitir evento (acuse)" onClick={() => setDocForEvent(doc)}>
                        <i className="ri-mail-check-line" aria-hidden />
                        {!compact && " Evento"}
                    </button>
                )}
            </div>
        );
    };

    const renderJobsTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table dian-table">
                <thead>
                    <tr>
                        <th>Fecha</th><th>Rango</th><th>Grupo</th><th>Estado</th><th>Documentos</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedJobs.map((job) => (
                        <tr key={job._id} className={selectedJobId === job._id ? "is-selected" : ""}>
                            <td data-label="Fecha">{fmtDateTime(job.created)}</td>
                            <td data-label="Rango">{job.filters.fromDate} → {job.filters.toDate}</td>
                            <td data-label="Grupo">{DIAN_GROUP_LABELS[(job.filters.group as keyof typeof DIAN_GROUP_LABELS) ?? "all"] ?? "Todos"}</td>
                            <td data-label="Estado">{renderJobStatusCell(job)}</td>
                            <td data-label="Documentos">{renderJobDocumentsCell(job)}</td>
                            <td data-label="Acciones">{renderJobActions(job)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderJobsList = () => (
        <div className="purchases-list-view">
            {displayedJobs.map((job) => (
                <article key={job._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{fmtDateTime(job.created)}</strong>
                            <span className={`dian-badge dian-status-${job.status}`}>{syncStatusLabel[job.status] ?? job.status}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <span>{job.filters.fromDate} → {job.filters.toDate}</span>
                            <span>{DIAN_GROUP_LABELS[(job.filters.group as keyof typeof DIAN_GROUP_LABELS) ?? "all"] ?? "Todos"}</span>
                        </div>
                        <div className="dian-doc-counts" style={{ marginTop: 8 }}>{renderJobDocumentsCell(job)}</div>
                    </div>
                    <footer className="purchases-list-item__actions">{renderJobActions(job, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderJobsCards = () => (
        <div className="purchases-cards-view">
            {displayedJobs.map((job) => (
                <article key={job._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{fmtDateTime(job.created)}</strong>
                        <span className={`dian-badge dian-status-${job.status}`}>{syncStatusLabel[job.status] ?? job.status}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <span>{job.filters.fromDate} → {job.filters.toDate}</span>
                        <span>· {DIAN_GROUP_LABELS[(job.filters.group as keyof typeof DIAN_GROUP_LABELS) ?? "all"] ?? "Todos"}</span>
                    </div>
                    <div className="dian-doc-counts" style={{ marginTop: 8 }}>{renderJobDocumentsCell(job)}</div>
                    <footer className="purchases-card__actions">{renderJobActions(job, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderJobsView = () => {
        if (effectiveViewMode === "list") return renderJobsList();
        if (effectiveViewMode === "cards") return renderJobsCards();
        return renderJobsTable();
    };

    const renderDocsTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table dian-table">
                <thead>
                    <tr>
                        <th>Fecha</th><th>Tipo</th><th>Documento</th><th>Emisor</th><th>Receptor</th><th className="ds-num">Total</th><th>Clasificación</th><th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {displayedDocuments.map((doc) => (
                        <tr key={doc._id}>
                            <td data-label="Fecha">{fmtDate(doc.fecha_emision)}</td>
                            <td data-label="Tipo">{doc.tipo_documento || "—"}</td>
                            <td data-label="Documento" className="cell-strong">{docLabel(doc.prefijo, doc.folio)}</td>
                            <td data-label="Emisor" title={doc.cufe}>{doc.nombre_emisor || doc.nit_emisor || "—"}</td>
                            <td data-label="Receptor">{doc.nombre_receptor || doc.nit_receptor || "—"}</td>
                            <td data-label="Total" className="ds-num">{formatCOP(doc.total)}</td>
                            <td data-label="Clasificación">{clasifBadge(doc.clasificacion)}</td>
                            <td data-label="Acciones">{renderDocActions(doc)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderDocsList = () => (
        <div className="purchases-list-view">
            {displayedDocuments.map((doc) => (
                <article key={doc._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{docLabel(doc.prefijo, doc.folio)}</strong>
                            <span className="purchases-list-item__amount-badge">{formatCOP(doc.total)}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <strong>{doc.nombre_emisor || doc.nit_emisor || "—"}</strong>
                            <span>{fmtDate(doc.fecha_emision)}</span>
                        </div>
                        <dl className="purchases-list-item__fields">
                            <div className="purchases-list-item__field">
                                <dt>Clasificación</dt>
                                <dd>{clasifBadge(doc.clasificacion)}</dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="purchases-list-item__actions">{renderDocActions(doc, "list")}</footer>
                </article>
            ))}
        </div>
    );

    const renderDocsCards = () => (
        <div className="purchases-cards-view">
            {displayedDocuments.map((doc) => (
                <article key={doc._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{docLabel(doc.prefijo, doc.folio)}</strong>
                        <span className="purchases-card__amount-badge">{formatCOP(doc.total)}</span>
                    </div>
                    <div className="purchases-card__sub">
                        <strong>{doc.nombre_emisor || doc.nit_emisor || "—"}</strong>
                        <span>· {fmtDate(doc.fecha_emision)}</span>
                    </div>
                    <dl className="purchases-card__fields">
                        <div className="purchases-card__field">
                            <dt>Clasificación</dt>
                            <dd>{clasifBadge(doc.clasificacion)}</dd>
                        </div>
                    </dl>
                    <footer className="purchases-card__actions">{renderDocActions(doc, "cards")}</footer>
                </article>
            ))}
        </div>
    );

    const renderDocsView = () => {
        if (effectiveViewMode === "list") return renderDocsList();
        if (effectiveViewMode === "cards") return renderDocsCards();
        return renderDocsTable();
    };

    const renderEventsTable = (items: DianEvent[]) => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table dian-table">
                <thead>
                    <tr><th>Fecha</th><th>Tipo</th><th>CUFE</th><th>Estado</th></tr>
                </thead>
                <tbody>
                    {items.map((ev) => (
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
    );

    const renderEventsList = (items: DianEvent[]) => (
        <div className="purchases-list-view">
            {items.map((ev) => (
                <article key={ev._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <strong className="purchases-list-item__title">{ev.event_code} · {DIAN_EVENT_LABELS[ev.event_code as DianEventCode] ?? ""}</strong>
                            <span className={`dian-badge dian-event-${ev.status}`}>{ev.status === "emitted" ? "Emitido" : ev.status === "failed" ? "Fallido" : "Pendiente"}</span>
                        </div>
                        <div className="purchases-list-item__sub">
                            <span>{fmtDateTime(ev.emitted_at || ev.created)}</span>
                        </div>
                        <p className="cell-cufe dian-subtle" title={ev.cufe}>{ev.cufe}</p>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderEventsCards = (items: DianEvent[]) => (
        <div className="purchases-cards-view">
            {items.map((ev) => (
                <article key={ev._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <strong className="purchases-card__title">{ev.event_code} · {DIAN_EVENT_LABELS[ev.event_code as DianEventCode] ?? ""}</strong>
                        <span className={`dian-badge dian-event-${ev.status}`}>{ev.status === "emitted" ? "Emitido" : ev.status === "failed" ? "Fallido" : "Pendiente"}</span>
                    </div>
                    <div className="purchases-card__sub">{fmtDateTime(ev.emitted_at || ev.created)}</div>
                    <p className="cell-cufe dian-subtle" title={ev.cufe}>{ev.cufe}</p>
                </article>
            ))}
        </div>
    );

    const renderEventsView = (items: DianEvent[]) => {
        if (effectiveViewMode === "list") return renderEventsList(items);
        if (effectiveViewMode === "cards") return renderEventsCards(items);
        return renderEventsTable(items);
    };

    const renderLogsTable = () => (
        <div className="purchases-table-container ds-table-container">
            <table className="purchases-table ds-table dian-table">
                <thead><tr><th>Fecha</th><th>Evento</th><th>Detalle</th></tr></thead>
                <tbody>
                    {displayedLogs.map((log) => (
                        <tr key={log._id}>
                            <td data-label="Fecha">{fmtDateTime(log.createdAt)}</td>
                            <td data-label="Evento"><span className={`dian-badge ${log.event.endsWith("FAIL") ? "dian-badge--danger" : "dian-badge--soft"}`}>{log.event}</span></td>
                            <td data-label="Detalle">{log.message || "—"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderLogsList = () => (
        <div className="purchases-list-view">
            {displayedLogs.map((log) => (
                <article key={log._id} className="purchases-list-item">
                    <div className="purchases-list-item__body">
                        <div className="purchases-list-item__head">
                            <span className={`dian-badge ${log.event.endsWith("FAIL") ? "dian-badge--danger" : "dian-badge--soft"}`}>{log.event}</span>
                            <span className="dian-subtle">{fmtDateTime(log.createdAt)}</span>
                        </div>
                        <p>{log.message || "—"}</p>
                    </div>
                </article>
            ))}
        </div>
    );

    const renderLogsCards = () => (
        <div className="purchases-cards-view">
            {displayedLogs.map((log) => (
                <article key={log._id} className="purchases-card">
                    <div className="purchases-card__header">
                        <span className={`dian-badge ${log.event.endsWith("FAIL") ? "dian-badge--danger" : "dian-badge--soft"}`}>{log.event}</span>
                        <span className="dian-subtle">{fmtDateTime(log.createdAt)}</span>
                    </div>
                    <p>{log.message || "—"}</p>
                </article>
            ))}
        </div>
    );

    const renderLogsView = () => {
        if (effectiveViewMode === "list") return renderLogsList();
        if (effectiveViewMode === "cards") return renderLogsCards();
        return renderLogsTable();
    };

    return (
        <ListPageShell className="dian-page purchases-page">
            <ListPageContainer className="dian-container">
                <ListPageHeader
                    className="dian-header"
                    title="Sincronización con la DIAN"
                    subtitle="Descarga tus facturas recibidas y emitidas desde el portal de la DIAN, lee los PDF para crear automáticamente proveedores y productos, y emite acuses de recibo."
                />

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
                                    <div className="dian-cred-card__actions action-buttons ds-row-actions">
                                        <button type="button" className="btn-secondary" onClick={() => handleValidate(cred)} disabled={validatingId === cred._id}>
                                            {validatingId === cred._id ? <i className="ri-loader-4-line rotating"></i> : <i className="ri-shield-check-line"></i>} Validar
                                        </button>
                                        <button type="button" className="btn-secondary" onClick={() => { setCredToRefresh(cred); setIsCredModalOpen(true); }}>
                                            <i className="ri-refresh-line"></i> Refrescar
                                        </button>
                                        <button type="button" className="btn-secondary" onClick={() => setCredForResponsible(cred)}>
                                            <i className="ri-user-settings-line"></i> Responsable
                                        </button>
                                        <button type="button" className="btn-action" title="Eliminar credencial" onClick={() => setCredToDelete(cred)}>
                                            <i className="ri-delete-bin-line"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* ── Tabs ── */}
                <div className="led-tabs led-tabs--ds" role="tablist">
                    <button type="button" className={tab === "sync" ? "active" : ""} role="tab" aria-selected={tab === "sync"} onClick={() => setTab("sync")}>
                        <i className="ri-refresh-line"></i> Sincronizaciones
                    </button>
                    <button type="button" className={tab === "documents" ? "active" : ""} role="tab" aria-selected={tab === "documents"} onClick={() => setTab("documents")}>
                        <i className="ri-file-list-3-line"></i> Documentos
                    </button>
                    <button type="button" className={tab === "events" ? "active" : ""} role="tab" aria-selected={tab === "events"} onClick={() => setTab("events")}>
                        <i className="ri-mail-check-line"></i> Eventos
                    </button>
                    <button type="button" className={tab === "logs" ? "active" : ""} role="tab" aria-selected={tab === "logs"} onClick={() => setTab("logs")}>
                        <i className="ri-history-line"></i> Auditoría
                    </button>
                </div>

                {/* ── Tab Sincronizaciones ── */}
                {tab === "sync" && (
                    <section className="dian-card dian-section">
                        <div className="dian-card__head">
                            <h2>Historial de sincronizaciones</h2>
                            <div className="dian-section__head-actions">
                                <input
                                    ref={importInputRef}
                                    type="file"
                                    accept=".xlsx,.xls"
                                    hidden
                                    onChange={(e) => handleImportExcel(e.target.files?.[0] ?? null)}
                                />
                                <button type="button" className="btn-secondary" onClick={() => importInputRef.current?.click()} disabled={importingExcel} title="Sube el Excel que genera la DIAN para procesarlo manualmente">
                                    {importingExcel ? <i className="ri-loader-4-line rotating"></i> : <i className="ri-file-excel-2-line"></i>} Importar Excel
                                </button>
                                <button type="button" className="btn-primary" onClick={() => setIsSyncModalOpen(true)} disabled={credentials.length === 0}>
                                    <i className="ri-refresh-line"></i> Nueva sincronización
                                </button>
                            </div>
                        </div>
                        {jobsLoading ? (
                            <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando…</div>
                        ) : jobsTotal === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-refresh-line" />
                                <p>Aún no has hecho sincronizaciones. Crea la primera con &quot;Nueva sincronización&quot;.</p>
                                                        </div>
                        ) : (
                            <>
                                {jobsFiltersDrawer}
                                <PaginationToolbar
                                    position="top"
                                    page={jobsPage}
                                    totalPages={jobsTotalPages}
                                    totalItems={jobsTotal}
                                    pageSize={jobsPageSize}
                                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                                    rangeStart={jobsRangeStart}
                                    rangeEnd={jobsRangeEnd}
                                    isFetching={jobsLoading}
                                    onPageChange={handleJobsPageChange}
                                    onPageSizeChange={handleJobsPageSizeChange}
                                    viewMode={viewMode}
                                    onViewModeChange={setViewMode}
                                    showViewToggle
                                    beforeViewToggle={jobsFiltersToolbar}
                                />
                                {renderJobsView()}
                                <PaginationToolbar
                                    position="bottom"
                                    page={jobsPage}
                                    totalPages={jobsTotalPages}
                                    totalItems={jobsTotal}
                                    pageSize={jobsPageSize}
                                    rangeStart={jobsRangeStart}
                                    rangeEnd={jobsRangeEnd}
                                    isFetching={jobsLoading}
                                    onPageChange={handleJobsPageChange}
                                />
                            </>
                        )}
                    </section>
                )}

                {/* ── Tab Documentos ── */}
                {tab === "documents" && (
                    <section className="dian-card dian-section">
                        <div className="dian-card__head">
                            <h2>
                                Documentos
                                {selectedJob && <span className="dian-subtle"> · {selectedJob.filters.fromDate} → {selectedJob.filters.toDate}</span>}
                            </h2>
                            {selectedJobId && (
                                <button type="button" className="btn-secondary" onClick={() => setDocsRefresh((k) => k + 1)}>
                                    <i className="ri-refresh-line"></i> Actualizar
                                </button>
                            )}
                        </div>
                        {docsFiltersDrawer}
                        {!selectedJobId ? (
                            <div className="purchases-empty">
                                <i className="ri-eye-line" />
                                <p>Selecciona una sincronización completada para ver sus documentos (botón Documentos en Sincronizaciones o el filtro de sincronización).</p>
                                </div>
                        ) : docsLoading && documents.length === 0 ? (
                            <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando documentos…</div>
                        ) : docsTotal === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-file-list-3-line" />
                                <p>No hay documentos con esos filtros.</p>
                            </div>
                                ) : (
                                    <>
                                        <PaginationToolbar
                                            position="top"
                                            page={docsPage}
                                            totalPages={docsTotalPages}
                                            totalItems={docsTotal}
                                    pageSize={docsPageSize}
                                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                                            rangeStart={docsRangeStart}
                                            rangeEnd={docsRangeEnd}
                                            isFetching={docsLoading}
                                            onPageChange={handleDocsPageChange}
                                    onPageSizeChange={handleDocsPageSizeChange}
                                    viewMode={viewMode}
                                    onViewModeChange={setViewMode}
                                    showViewToggle
                                    beforeViewToggle={docsFiltersToolbar}
                                />
                                {renderDocsView()}
                                        <PaginationToolbar
                                            position="bottom"
                                            page={docsPage}
                                            totalPages={docsTotalPages}
                                            totalItems={docsTotal}
                                    pageSize={docsPageSize}
                                            rangeStart={docsRangeStart}
                                            rangeEnd={docsRangeEnd}
                                            isFetching={docsLoading}
                                            onPageChange={handleDocsPageChange}
                                        />
                            </>
                        )}
                    </section>
                )}

                {/* ── Tab Eventos ── */}
                {tab === "events" && (
                    <section className="dian-card dian-section">
                        <div className="dian-card__head"><h2>Eventos emitidos</h2></div>
                        {eventsFiltersDrawer}
                        {eventsLoading ? (
                            <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando eventos…</div>
                        ) : events.length === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-mail-check-line" />
                                <p>Aún no has emitido eventos. Hazlo desde la pestaña Documentos.</p>
                            </div>
                        ) : filteredEvents.length === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-filter-off-line" />
                                <p>No hay eventos con esos filtros.</p>
                            </div>
                        ) : (
                            <>
                                <PaginationToolbar
                                    position="top"
                                    page={eventsPagination.page}
                                    totalPages={eventsPagination.totalPages}
                                    totalItems={eventsPagination.totalItems}
                                    pageSize={eventsPagination.pageSize}
                                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                                    rangeStart={eventsPagination.start}
                                    rangeEnd={eventsPagination.end}
                                    isFetching={eventsLoading}
                                    onPageChange={eventsPagination.handlePageChange}
                                    onPageSizeChange={eventsPagination.handlePageSizeChange}
                                    viewMode={viewMode}
                                    onViewModeChange={setViewMode}
                                    showViewToggle
                                    beforeViewToggle={eventsFiltersToolbar}
                                />
                                {renderEventsView(eventsPagination.paginated)}
                                <PaginationToolbar
                                    position="bottom"
                                    page={eventsPagination.page}
                                    totalPages={eventsPagination.totalPages}
                                    totalItems={eventsPagination.totalItems}
                                    pageSize={eventsPagination.pageSize}
                                    rangeStart={eventsPagination.start}
                                    rangeEnd={eventsPagination.end}
                                    isFetching={eventsLoading}
                                    onPageChange={eventsPagination.handlePageChange}
                                />
                            </>
                        )}
                    </section>
                )}

                {/* ── Tab Auditoría ── */}
                {tab === "logs" && (
                    <section className="dian-card dian-section">
                        <div className="dian-card__head"><h2>Auditoría</h2></div>
                        {logsLoading ? (
                            <div className="page-loading ds-empty" style={{ textAlign: "center", padding: 40 }}>Cargando…</div>
                        ) : logsTotal === 0 ? (
                            <div className="purchases-empty">
                                <i className="ri-history-line" />
                                <p>Sin registros todavía.</p>
                            </div>
                        ) : (
                            <>
                                {logsFiltersDrawer}
                                <PaginationToolbar
                                    position="top"
                                    page={logsPage}
                                    totalPages={logsTotalPages}
                                    totalItems={logsTotal}
                                    pageSize={logsPageSize}
                                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                                    rangeStart={logsRangeStart}
                                    rangeEnd={logsRangeEnd}
                                    isFetching={logsLoading}
                                    onPageChange={handleLogsPageChange}
                                    onPageSizeChange={handleLogsPageSizeChange}
                                    viewMode={viewMode}
                                    onViewModeChange={setViewMode}
                                    showViewToggle
                                    beforeViewToggle={logsFiltersToolbar}
                                />
                                {renderLogsView()}
                                <PaginationToolbar
                                    position="bottom"
                                    page={logsPage}
                                    totalPages={logsTotalPages}
                                    totalItems={logsTotal}
                                    pageSize={logsPageSize}
                                    rangeStart={logsRangeStart}
                                    rangeEnd={logsRangeEnd}
                                    isFetching={logsLoading}
                                    onPageChange={handleLogsPageChange}
                                />
                            </>
                        )}
                    </section>
                )}
            </ListPageContainer>

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
            <ConfirmModal
                isOpen={!!jobToEnrich}
                onClose={() => setJobToEnrich(null)}
                onConfirm={() => { const id = jobToEnrich?._id; setJobToEnrich(null); if (id) handleEnrich(id); }}
                title="Leer los PDF y crear proveedores y productos"
                message={
                    "Esto va a realizar lo siguiente:\n\n" +
                    "1. Lee los PDF de las facturas de COMPRA descargadas de esta sincronización.\n" +
                    "2. Por cada proveedor (emisor de la factura) que aún no exista, lo crea en Compras → Proveedores y en el maestro de Terceros.\n" +
                    "3. Crea los productos/servicios de esas facturas en el catálogo del proveedor.\n\n" +
                    "Es seguro repetirlo: no duplica proveedores ni productos que ya existan, solo agrega los que falten. Solo se procesan las facturas de compra (no las de venta ni los acuses)."
                }
                confirmText="Aceptar"
                cancelText="Cancelar"
                type="info"
                loading={enrichingJob === jobToEnrich?._id}
            />
        </ListPageShell>
    );
};

export default DianSyncPage;

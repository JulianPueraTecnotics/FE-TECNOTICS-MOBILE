import { useEffect, useState, useCallback, useRef, useLayoutEffect, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useNavigate, NavLink, useSearchParams } from "react-router-dom";
import { PATHS } from "../../../router/paths.contants";
import { FILTER_DEBOUNCE_MS } from "../../../utils/useDebouncedValue";
import "./Documents.css";
import { TipoDocElectronico, type Factura, RECURRENCE_LABELS, type RecurrenceType } from "../../../types";
import { exportInvoicesExcel, getAllInvoices } from "../../../services/invoices.service";
import { setInvoiceTemplate } from "../../../services/plantillas.service";
import { createRemision } from "../../../services/remisiones.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import { PaginationToolbar, paginationRange, AppModal, FilterField, FieldControl, FiltersMobileDrawer, ListPageShell, ListPageContainer, ListPageHeader, useEffectiveViewMode, ColumnFilterFields, useColumnFilters, type ColumnFilterDef, type ViewMode } from "../../../components/design-system";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100] as const;

const normalizePageSize = (value: number): number =>
    PAGE_SIZE_OPTIONS.includes(value as (typeof PAGE_SIZE_OPTIONS)[number]) ? value : 20;

const COLUMN_FILTER_DEFS: ColumnFilterDef[] = [
    { id: "fecha", label: "Fecha", type: "date", icon: "ri-calendar-line" },
];

const toIsoDate = (d?: string | Date) => {
    if (!d) return "";
    const dt = d instanceof Date ? d : new Date(d);
    return Number.isNaN(dt.getTime()) ? "" : dt.toISOString().slice(0, 10);
};

const DocumentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const limitFromUrl = normalizePageSize(Number(searchParams.get("limit")) || 20);
    const tipoFromUrl = searchParams.get("tipo_documento") ?? "";
    const prefijoFromUrl = searchParams.get("prefijo") ?? "";
    const clienteFromUrl = searchParams.get("cliente") ?? "";
    const totalFromUrl = searchParams.get("total") ?? "";
    const statusFromUrl = searchParams.get("status") ?? "";
    const hasFiltersInUrl = [tipoFromUrl, prefijoFromUrl, clienteFromUrl, totalFromUrl, statusFromUrl].some((v) => v.trim() !== "");
    const [facturas, setFacturas] = useState<Factura[]>([]);
    const [loading, setLoading] = useState(true);
    const [isPageFetching, setIsPageFetching] = useState(false);
    const [page, setPage] = useState(pageFromUrl);
    const [pageSize, setPageSize] = useState(limitFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [totalItems, setTotalItems] = useState(0);

    const [filtersOpen, setFiltersOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== "undefined" ? window.innerWidth <= 768 : false));
    const filtersDropdownRef = useRef<HTMLDivElement>(null);
    const filtersToggleRef = useRef<HTMLButtonElement>(null);
    const filtersPanelRef = useRef<HTMLDivElement>(null);
    const [filtersPanelStyle, setFiltersPanelStyle] = useState<CSSProperties>({});
    const [filterTipo, setFilterTipo] = useState(tipoFromUrl);
    const [filterPrefijo, setFilterPrefijo] = useState(prefijoFromUrl);
    const [filterCliente, setFilterCliente] = useState(clienteFromUrl);
    const [filterTotal, setFilterTotal] = useState(totalFromUrl);
    const [filterEstado, setFilterEstado] = useState(statusFromUrl);
    /** Valores aplicados a API/URL tras debounce (solo texto: prefijo, cliente, total) */
    const [committedPrefijo, setCommittedPrefijo] = useState(prefijoFromUrl);
    const [committedCliente, setCommittedCliente] = useState(clienteFromUrl);
    const [committedTotal, setCommittedTotal] = useState(totalFromUrl);

    // Ordenamiento por columna (como Excel): clic en el encabezado.
    type SortKey = "tipo" | "numero" | "cliente" | "fecha" | "total" | "estado";
    const [sortBy, setSortBy] = useState<SortKey | null>(null);
    const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
    const [viewMode, setViewMode] = useState<ViewMode>("table");
    const effectiveViewMode = useEffectiveViewMode(viewMode);

    // Exportar Excel
    const [isExportExcelOpen, setIsExportExcelOpen] = useState(false);
    const [exportMode, setExportMode] = useState<"range" | "month">("range");
    const [exportStartDate, setExportStartDate] = useState("");
    const [exportEndDate, setExportEndDate] = useState("");
    const [exportMonth, setExportMonth] = useState("");
    const [exportCliente, setExportCliente] = useState("");
    const [exportStatus, setExportStatus] = useState("");
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    const tipoDocumentoOptions: Array<{ value: string; label: string }> = [
        { value: TipoDocElectronico.FACTURA, label: "Factura Electrónica" },
        { value: TipoDocElectronico.NOTA_DEBITO, label: "Nota Débito" },
        { value: TipoDocElectronico.NOTA_CREDITO, label: "Nota Crédito" },
        { value: TipoDocElectronico.DOCUMENTO_SOPORTE, label: "Documento Soporte" },
    ];
    const statusOptions: Array<{ value: string; label: string }> = [
        { value: "APPROVED", label: "Aprobada" },
        { value: "REJECTED", label: "Rechazada" },
        { value: "SENT", label: "Enviada" },
    ];

    const openExportExcelModal = () => {
        setExportMode("range");
        setExportStartDate("");
        setExportEndDate("");
        setExportMonth("");
        setExportCliente(committedCliente);
        setExportStatus(filterEstado);
        setIsExportExcelOpen(true);
    };

    const closeExportExcelModal = () => {
        if (isExportingExcel) return;
        setIsExportExcelOpen(false);
    };

    const handleExportExcel = async () => {
        if (isExportingExcel) return;

        const cliente = exportCliente.trim();
        const status = exportStatus.trim().toUpperCase();

        if (exportMode === "range") {
            if (!exportStartDate || !exportEndDate) {
                errorToast("Debes indicar fecha de inicio y fecha final");
                return;
            }
            if (exportStartDate > exportEndDate) {
                errorToast("La fecha de inicio no puede ser mayor que la fecha final");
                return;
            }
        } else {
            if (!exportMonth) {
                errorToast("Debes indicar un mes (YYYY-MM)");
                return;
            }
        }

        setIsExportingExcel(true);
        try {
            const res = await exportInvoicesExcel({
                start_date: exportMode === "range" ? exportStartDate : undefined,
                end_date: exportMode === "range" ? exportEndDate : undefined,
                month: exportMode === "month" ? exportMonth : undefined,
                cliente: cliente || undefined,
                status: status || undefined,
            });

            if (!res) throw new Error("No se pudo exportar el Excel");

            const url = URL.createObjectURL(res.blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = res.fileName;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);

            successToast("Excel descargado exitosamente");
            setIsExportExcelOpen(false);
        } catch (error: unknown) {
            const message = error instanceof Error ? error.message : "Error al exportar Excel";
            errorToast(message);
        } finally {
            setIsExportingExcel(false);
        }
    };

    const loadInvoices = useCallback(async () => {
        const hasData = facturas.length > 0;
        if (hasData) {
            setIsPageFetching(true);
        } else {
            setLoading(true);
        }
        try {
            const response = await getAllInvoices(page, pageSize, {
                tipo_documento: filterTipo,
                prefijo: committedPrefijo,
                cliente: committedCliente,
                total: committedTotal,
                status: filterEstado,
            });
            if (response) {
                setFacturas(response.facturas);
                setTotalPages(response.pagination.totalPages);
                setTotalItems(response.pagination.total);
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al cargar facturas");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [page, pageSize, facturas.length, filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado]);

    useEffect(() => {
        loadInvoices();
    }, [loadInvoices]);

    // Tiempo real: cuando se crea/emite una factura, refrescamos en silencio la
    // página actual (sin F5 ni parpadeo). La lista está paginada y ordenada por
    // fecha desc, así que un documento nuevo solo es visible en la página 1; en
    // páginas posteriores no tocamos la vista para no reordenar bajo el usuario.
    useRealtime(RealtimeEvents.INVOICE_CHANGED, () => {
        if (page === 1) loadInvoices();
    });

    useEffect(() => {
        if (page !== pageFromUrl) {
            setPage(pageFromUrl);
        }
        if (pageSize !== limitFromUrl) setPageSize(limitFromUrl);
        if (filterTipo !== tipoFromUrl) setFilterTipo(tipoFromUrl);
        if (filterPrefijo !== prefijoFromUrl) setFilterPrefijo(prefijoFromUrl);
        if (filterCliente !== clienteFromUrl) setFilterCliente(clienteFromUrl);
        if (filterTotal !== totalFromUrl) setFilterTotal(totalFromUrl);
        if (filterEstado !== statusFromUrl) setFilterEstado(statusFromUrl);
        if (committedPrefijo !== prefijoFromUrl) setCommittedPrefijo(prefijoFromUrl);
        if (committedCliente !== clienteFromUrl) setCommittedCliente(clienteFromUrl);
        if (committedTotal !== totalFromUrl) setCommittedTotal(totalFromUrl);
        if (hasFiltersInUrl) setFiltersOpen(true);
    }, [pageFromUrl, limitFromUrl, tipoFromUrl, prefijoFromUrl, clienteFromUrl, totalFromUrl, statusFromUrl, hasFiltersInUrl]);

    useEffect(() => {
        const t = window.setTimeout(() => setCommittedPrefijo(filterPrefijo), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [filterPrefijo]);

    useEffect(() => {
        const t = window.setTimeout(() => setCommittedCliente(filterCliente), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [filterCliente]);

    useEffect(() => {
        const t = window.setTimeout(() => setCommittedTotal(filterTotal), FILTER_DEBOUNCE_MS);
        return () => window.clearTimeout(t);
    }, [filterTotal]);

    useEffect(() => {
        const matchPref = committedPrefijo.trim() === prefijoFromUrl.trim();
        const matchCli = committedCliente.trim() === clienteFromUrl.trim();
        const matchTot = committedTotal.trim() === totalFromUrl.trim();
        if (matchPref && matchCli && matchTot) return;

        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            const setOrDel = (key: "prefijo" | "cliente" | "total", val: string) => {
                const n = val.trim();
                if (!n) params.delete(key);
                else params.set(key, n);
            };
            setOrDel("prefijo", committedPrefijo);
            setOrDel("cliente", committedCliente);
            setOrDel("total", committedTotal);
            return params;
        });
        setPage(1);
    }, [committedPrefijo, committedCliente, committedTotal, prefijoFromUrl, clienteFromUrl, totalFromUrl, setSearchParams]);

    const handlePageChange = (nextPage: number) => {
        const safePage = Math.max(1, Math.min(totalPages, nextPage));
        setPage(safePage);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", String(safePage));
            return params;
        });
    };

    const handlePageSizeChange = (nextSize: number) => {
        const safeSize = normalizePageSize(nextSize);
        setPageSize(safeSize);
        setPage(1);
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.set("limit", String(safeSize));
            return params;
        });
    };

    const updateFiltersInQuery = (updates: { tipo_documento?: string; prefijo?: string; cliente?: string; total?: string; status?: string }) => {
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");

            const entries = Object.entries(updates) as Array<[keyof typeof updates, string | undefined]>;
            for (const [key, value] of entries) {
                const normalized = (value ?? "").trim();
                if (!normalized) {
                    params.delete(key);
                } else if (key === "status") {
                    params.set(key, normalized.toUpperCase());
                } else {
                    params.set(key, normalized);
                }
            }
            return params;
        });
        setPage(1);
    };

    const handleViewDetail = (id: string) => {
        navigate(`/documentos/${id}`);
    };

    // "Guardar como plantilla": marca la factura como plantilla (con recurrencia opcional).
    // Luego aparece en Ventas › Facturas de plantilla, desde donde se recrea.
    const [templateModal, setTemplateModal] = useState<{ id: string; label: string } | null>(null);
    const [templateRecurrence, setTemplateRecurrence] = useState<RecurrenceType>("none");
    const [savingTemplate, setSavingTemplate] = useState(false);

    const handleOpenTemplateModal = (factura: Factura) => {
        const num = `${factura.Encabezado.PrefijoDocumento ?? ""}${factura.Encabezado.NumeroDocumento ?? ""}`.trim();
        setTemplateModal({ id: factura._id, label: num || "factura" });
        setTemplateRecurrence("none");
    };

    const handleSaveTemplate = async () => {
        if (!templateModal) return;
        setSavingTemplate(true);
        try {
            await setInvoiceTemplate(templateModal.id, { is_template: true, recurrence: templateRecurrence });
            successToast("Factura guardada como plantilla");
            setTemplateModal(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo guardar la plantilla");
        } finally {
            setSavingTemplate(false);
        }
    };

    // "Generar remisión": crea una remisión a partir de esta factura y envía el link de firma al cliente.
    const [remisionBusyId, setRemisionBusyId] = useState<string | null>(null);
    const handleGenerateRemision = async (id: string) => {
        setRemisionBusyId(id);
        try {
            const res = await createRemision({ source: "invoice", source_id: id, send_email: true });
            successToast(res?.message || "Remisión generada y enviada al cliente para firma");
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo generar la remisión");
        } finally {
            setRemisionBusyId(null);
        }
    };

    /**
     * Clasifica el documento con etiqueta clara y color de badge. Distingue la
     * Factura POS (tipo 01 con TipoDeFactura=20) de la factura electrónica estándar,
     * y el Documento Soporte (equivalente) de los demás.
     */
    const getTipoInfo = (factura: Factura): { label: string; cls: string; icon: string } => {
        const tipo = String(factura.Encabezado?.TipoDocElectronico ?? "");
        const tipoFactura = String(factura.Encabezado?.TipoDeFactura?.Value ?? "");
        if (tipo === "01" || tipo === "1") {
            if (tipoFactura === "20") return { label: "Factura POS", cls: "doc-type--pos", icon: "ri-store-2-line" };
            return { label: "Factura Electrónica", cls: "doc-type--factura", icon: "ri-file-text-line" };
        }
        if (tipo === "02" || tipo === "2") return { label: "Nota Débito", cls: "doc-type--nd", icon: "ri-add-circle-line" };
        if (tipo === "03" || tipo === "3") return { label: "Nota Crédito", cls: "doc-type--nc", icon: "ri-subtract-line" };
        if (tipo === "11") return { label: "Documento Soporte", cls: "doc-type--soporte", icon: "ri-file-shield-2-line" };
        return { label: "Documento", cls: "doc-type--otro", icon: "ri-file-line" };
    };

    // Obtener clase CSS para el estado
    const getStatusClass = (factura: Factura) => {
        if (factura.systemInfo?.is_draft) return "status-draft";
        switch (factura.systemInfo?.facturaStatus) {
            case "APPROVED":
                return "status-paid";
            case "PENDING":
                return "status-pending";
            case "REJECTED":
                return "status-rejected";
            default:
                return "";
        }
    };

    // Obtener label del estado
    const getStatusLabel = (factura: Factura) => {
        if (factura.systemInfo?.is_draft) return "Borrador";
        switch (factura.systemInfo?.facturaStatus) {
            case "APPROVED":
                return "Aprobada";
            case "PENDING":
                return "Pendiente";
            case "REJECTED":
                return "Rechazada";
            default:
                return factura.systemInfo?.facturaStatus ?? "";
        }
    };

    const formatPrice = (price: number, currency: string | { Value?: string }) => {
        // Normalmente viene como string directo "COP"
        // Pero manejamos también el caso de objeto { Value: "COP" }
        const currencyCode = typeof currency === "string" ? currency : currency?.Value || "COP";

        // Usar toLocaleString para ser receptivo a cualquier moneda
        const localeMap: Record<string, string> = {
            COP: "es-CO",
            USD: "en-US",
            EUR: "es-ES",
            MXN: "es-MX",
            ARS: "es-AR",
            CAD: "en-CA",
            GBP: "en-GB",
        };

        const locale = localeMap[currencyCode] || "es-CO";

        return price.toLocaleString(locale, {
            style: "currency",
            currency: currencyCode,
            minimumFractionDigits: 0,
            // Pesos colombianos sin centavos: se muestra el valor redondeado, sin decimales.
            maximumFractionDigits: 0,
        });
    };

    const formatDate = (dateInput: string | Date) => {
        const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
        return date.toLocaleDateString("es-CO", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        });
    };

    const getRowFilterValue = useCallback((row: Factura, filterId: string): string => {
        if (filterId === "fecha") return toIsoDate(row.Encabezado?.FechaYHoraDocumento || row.Encabezado?.FechaYHoraEmision);
        return "";
    }, []);

    const { values: colFilterValues, setFilter: setColFilter, clearFilters: clearColFilters, hasActiveClientFilters, filterRows } =
        useColumnFilters(COLUMN_FILTER_DEFS, getRowFilterValue);

    const hasActiveFilters =
        [filterTipo, filterPrefijo, filterCliente, filterTotal, filterEstado].some((v) => v.trim() !== "") || hasActiveClientFilters;

    /** Filtros de texto (prefijo, cliente, total) aún no aplicados tras el debounce */
    const isTextFiltersDebouncing = filterPrefijo.trim() !== committedPrefijo.trim() || filterCliente.trim() !== committedCliente.trim() || filterTotal.trim() !== committedTotal.trim();

    const showListLoading = loading || isTextFiltersDebouncing;

    const clearFilters = () => {
        setFilterTipo("");
        setFilterPrefijo("");
        setFilterCliente("");
        setFilterTotal("");
        setFilterEstado("");
        setCommittedPrefijo("");
        setCommittedCliente("");
        setCommittedTotal("");
        clearColFilters();
        setSearchParams((prev) => {
            const params = new URLSearchParams(prev);
            params.set("page", "1");
            params.delete("tipo_documento");
            params.delete("prefijo");
            params.delete("cliente");
            params.delete("total");
            params.delete("status");
            return params;
        });
        setPage(1);
    };

    const updateFiltersPanelPosition = useCallback(() => {
        const toggle = filtersToggleRef.current;
        const panel = filtersPanelRef.current;
        if (!toggle) return;

        const rect = toggle.getBoundingClientRect();
        const gap = 6;
        const width = Math.min(640, window.innerWidth - 32);
        const left = Math.max(16, rect.right - width);
        const panelHeight = panel?.offsetHeight ?? 0;
        const spaceBelow = window.innerHeight - rect.bottom - gap;
        const openUp = panelHeight > 0 && spaceBelow < panelHeight && rect.top > panelHeight + gap;
        const top = openUp ? rect.top - gap - panelHeight : rect.bottom + gap;

        setFiltersPanelStyle({
            position: "fixed",
            top: Math.max(8, top),
            left,
            width,
        });
    }, []);

    useEffect(() => {
        const mq = window.matchMedia("(max-width: 768px)");
        const sync = () => setIsMobile(mq.matches);
        sync();
        mq.addEventListener("change", sync);
        return () => mq.removeEventListener("change", sync);
    }, []);

    useLayoutEffect(() => {
        if (!filtersOpen || isMobile) return;
        updateFiltersPanelPosition();
        const frame = requestAnimationFrame(updateFiltersPanelPosition);
        return () => cancelAnimationFrame(frame);
    }, [filtersOpen, isMobile, updateFiltersPanelPosition, filterTipo, filterPrefijo, filterCliente, filterTotal, filterEstado]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onReflow = () => updateFiltersPanelPosition();
        window.addEventListener("resize", onReflow);
        window.addEventListener("scroll", onReflow, true);
        return () => {
            window.removeEventListener("resize", onReflow);
            window.removeEventListener("scroll", onReflow, true);
        };
    }, [filtersOpen, isMobile, updateFiltersPanelPosition]);

    useEffect(() => {
        if (!filtersOpen || isMobile) return;
        const onPointer = (e: MouseEvent) => {
            const target = e.target as Node;
            if (filtersDropdownRef.current?.contains(target) || filtersPanelRef.current?.contains(target)) return;
            setFiltersOpen(false);
        };
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        document.addEventListener("mousedown", onPointer);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onPointer);
            document.removeEventListener("keydown", onKey);
        };
    }, [filtersOpen, isMobile]);

    useEffect(() => {
        if (!filtersOpen || !isMobile) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setFiltersOpen(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [filtersOpen, isMobile]);

    /** Al hacer clic en un encabezado: alterna asc/desc o cambia de columna. */
    const handleSort = (key: SortKey) => {
        if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        else { setSortBy(key); setSortDir("asc"); }
    };

    /** Valor comparable de una factura para una columna. */
    const sortValue = (factura: Factura, key: SortKey): string | number => {
        switch (key) {
            case "tipo": return getTipoInfo(factura).label;
            case "numero": return `${factura.Encabezado?.PrefijoDocumento ?? ""}${String(factura.Encabezado?.NumeroDocumento ?? "").padStart(12, "0")}`;
            case "cliente": return (factura.Terceros?.TerceroClienteContable?.Tercero?.NombreTercero?.[0]?.Value ?? "").toLowerCase();
            case "fecha": return new Date(factura.Encabezado?.FechaYHoraDocumento || factura.Encabezado?.FechaYHoraEmision || 0).getTime();
            case "total": return Number(factura.Totales?.TotalMonetario?.ValorAPagar?.Value ?? 0);
            case "estado": return getStatusLabel(factura);
            default: return "";
        }
    };

    const filteredFacturas = filterRows(facturas);

    // Lista ordenada según la columna elegida (sobre la página actual).
    const sortedFacturas = sortBy
        ? [...filteredFacturas].sort((a, b) => {
            const va = sortValue(a, sortBy), vb = sortValue(b, sortBy);
            let cmp: number;
            if (typeof va === "number" && typeof vb === "number") cmp = va - vb;
            else cmp = String(va).localeCompare(String(vb), "es", { numeric: true });
            return sortDir === "asc" ? cmp : -cmp;
        })
        : filteredFacturas;

    /** Indicador visual de orden en el encabezado. */
    const sortIcon = (key: SortKey) => sortBy !== key ? "ri-arrow-up-down-line" : sortDir === "asc" ? "ri-arrow-up-line" : "ri-arrow-down-line";

    const getDocNumber = (factura: Factura) =>
        factura.Encabezado.NumeroDocumento
            ? `${factura.Encabezado.PrefijoDocumento}-${factura.Encabezado.NumeroDocumento}`
            : `${factura.Encabezado.PrefijoDocumento} · por asignar`;

    const getClienteName = (factura: Factura) =>
        factura.Terceros?.TerceroClienteContable?.Tercero?.NombreTercero?.[0]?.Value || "N/A";

    const renderTipoBadge = (factura: Factura) => {
        const ti = getTipoInfo(factura);
        return (
            <span className={`doc-type-badge ${ti.cls}`} title={ti.label}>
                {factura.Parametros?.TipoAmbiente === "2" && (
                    <i className="ri-error-warning-fill" title="Ambiente de pruebas" />
                )}
                <i className={ti.icon} /> {ti.label}
            </span>
        );
    };

    const renderFacturaActions = (factura: Factura, layout: "table" | "list" | "cards" = "table") => (
        <div className={`document-actions document-actions--${layout}`}>
            <button type="button" className="btn-action" onClick={() => handleViewDetail(factura._id)}>
                <i className="ri-eye-line" />
                Ver
            </button>
            <button
                type="button"
                className="btn-action"
                onClick={() => handleOpenTemplateModal(factura)}
                title="Guardar esta factura como plantilla para reutilizarla"
            >
                <i className="ri-bookmark-line" />
                Plantilla
            </button>
            <button
                type="button"
                className="btn-action"
                onClick={() => handleGenerateRemision(factura._id)}
                disabled={remisionBusyId === factura._id}
                title="Generar remisión de entrega para que el cliente firme"
            >
                <i className={remisionBusyId === factura._id ? "ri-loader-4-line rotating" : "ri-truck-line"} />
                Remisión
            </button>
        </div>
    );

    const { start: rangeStart, end: rangeEnd } = paginationRange(page, pageSize, totalItems);

    const renderFacturaTable = () => (
        <div className="documents-table-container">
            <table className="documents-table">
                <thead>
                    <tr>
                        {([
                            { key: "tipo", label: "Tipo" },
                            { key: "numero", label: "Número" },
                            { key: "cliente", label: "Cliente" },
                            { key: "fecha", label: "Fecha" },
                            { key: "total", label: "Total" },
                            { key: "estado", label: "Estado" },
                        ] as { key: SortKey; label: string }[]).map((col) => (
                            <th
                                key={col.key}
                                className="documents-th-sort"
                                onClick={() => handleSort(col.key)}
                                title="Ordenar por esta columna"
                            >
                                {col.label}{" "}
                                <i
                                    className={sortIcon(col.key)}
                                    style={{ fontSize: ".85em", opacity: sortBy === col.key ? 1 : 0.4 }}
                                    aria-hidden
                                />
                            </th>
                        ))}
                        <th>Acciones</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedFacturas.map((factura) => (
                        <tr key={factura._id}>
                            <td data-label="Tipo" className="document-type">
                                {renderTipoBadge(factura)}
                            </td>
                            <td className="document-number" data-label="Número">
                                {getDocNumber(factura)}
                            </td>
                            <td data-label="Cliente">{getClienteName(factura)}</td>
                            <td data-label="Fecha">
                                {formatDate(factura.Encabezado.FechaYHoraDocumento || factura.Encabezado.FechaYHoraEmision || "")}
                            </td>
                            <td className="document-total" data-label="Total">
                                {formatPrice(
                                    factura.Totales.TotalMonetario.ValorAPagar.Value,
                                    factura.Totales.TotalMonetario.ValorAPagar.IdMoneda,
                                )}
                            </td>
                            <td data-label="Estado">
                                <span className={`status-badge ${getStatusClass(factura)}`}>{getStatusLabel(factura)}</span>
                            </td>
                            <td data-label="Acciones">{renderFacturaActions(factura)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );

    const renderFacturaList = () => (
        <div className="documents-list-view">
            {sortedFacturas.map((factura) => (
                <article key={factura._id} className="documents-list-item">
                    <div className="documents-list-item__body">
                        <div className="documents-list-item__head">
                            {renderTipoBadge(factura)}
                            <span className={`status-badge ${getStatusClass(factura)}`}>{getStatusLabel(factura)}</span>
                        </div>
                        <div className="documents-list-item__main">
                            <p className="documents-list-item__client">{getClienteName(factura)}</p>
                        </div>
                        <dl className="documents-list-item__fields">
                            <div className="documents-list-item__field">
                                <dt>Número</dt>
                                <dd className="documents-list-item__number">{getDocNumber(factura)}</dd>
                            </div>
                            <div className="documents-list-item__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(factura.Encabezado.FechaYHoraDocumento || factura.Encabezado.FechaYHoraEmision || "")}</dd>
                            </div>
                            <div className="documents-list-item__field">
                                <dt>Total</dt>
                                <dd className="documents-list-item__total">
                                    {formatPrice(
                                        factura.Totales.TotalMonetario.ValorAPagar.Value,
                                        factura.Totales.TotalMonetario.ValorAPagar.IdMoneda,
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="documents-list-item__actions">
                        {renderFacturaActions(factura, "list")}
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderFacturaCards = () => (
        <div className="documents-cards-view">
            {sortedFacturas.map((factura) => (
                <article key={factura._id} className="documents-card">
                    <div className="documents-card__body">
                        <div className="documents-card__header">
                            {renderTipoBadge(factura)}
                            <span className={`status-badge ${getStatusClass(factura)}`}>{getStatusLabel(factura)}</span>
                        </div>
                        <div className="documents-card__main">
                            <strong className="documents-card__number">{getDocNumber(factura)}</strong>
                            <p className="documents-card__client">{getClienteName(factura)}</p>
                        </div>
                        <dl className="documents-card__fields">
                            <div className="documents-card__field">
                                <dt>Fecha</dt>
                                <dd>{formatDate(factura.Encabezado.FechaYHoraDocumento || factura.Encabezado.FechaYHoraEmision || "")}</dd>
                            </div>
                            <div className="documents-card__field">
                                <dt>Total</dt>
                                <dd className="documents-card__total">
                                    {formatPrice(
                                        factura.Totales.TotalMonetario.ValorAPagar.Value,
                                        factura.Totales.TotalMonetario.ValorAPagar.IdMoneda,
                                    )}
                                </dd>
                            </div>
                        </dl>
                    </div>
                    <footer className="documents-card__actions">
                        {renderFacturaActions(factura, "cards")}
                    </footer>
                </article>
            ))}
        </div>
    );

    const renderFacturaView = () => {
        if (effectiveViewMode === "list") return renderFacturaList();
        if (effectiveViewMode === "cards") return renderFacturaCards();
        return renderFacturaTable();
    };

    const filterContent = (
        <>
            <div className="documents-filter-field">
                                        <label htmlFor="filter-tipo">Tipo Documento</label>
                                        <div className="documents-field-input">
                                            <span className="documents-field-input__icon" aria-hidden>
                                                <i className="ri-file-list-3-line" />
                                            </span>
                                            <select
                                                id="filter-tipo"
                                                className="documents-field-input__control"
                                                value={filterTipo}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFilterTipo(value);
                                                    updateFiltersInQuery({ tipo_documento: value });
                                                }}
                                            >
                                                <option value="">Todos</option>
                                                {tipoDocumentoOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                    <div className="documents-filter-field">
                                        <label htmlFor="filter-prefijo">Prefijo / Consecutivo</label>
                                        <div className="documents-field-input">
                                            <span className="documents-field-input__icon" aria-hidden>
                                                <i className="ri-hashtag" />
                                            </span>
                                            <input
                                                id="filter-prefijo"
                                                type="text"
                                                className="documents-field-input__control"
                                                value={filterPrefijo}
                                                onChange={(e) => setFilterPrefijo(e.target.value)}
                                                placeholder="Ej. FEM123 o 123"
                                            />
                                        </div>
                                    </div>
                                    <div className="documents-filter-field">
                                        <label htmlFor="filter-cliente">Cliente</label>
                                        <div className="documents-field-input">
                                            <span className="documents-field-input__icon" aria-hidden>
                                                <i className="ri-user-search-line" />
                                            </span>
                                            <input
                                                id="filter-cliente"
                                                type="text"
                                                className="documents-field-input__control"
                                                value={filterCliente}
                                                onChange={(e) => setFilterCliente(e.target.value)}
                                                placeholder="Nombre o documento"
                                            />
                                        </div>
                                    </div>
                                    <div className="documents-filter-field">
                                        <label htmlFor="filter-total">Total</label>
                                        <div className="documents-field-input">
                                            <span className="documents-field-input__icon" aria-hidden>
                                                <i className="ri-money-dollar-circle-line" />
                                            </span>
                                            <input
                                                id="filter-total"
                                                type="text"
                                                className="documents-field-input__control"
                                                value={filterTotal}
                                                onChange={(e) => setFilterTotal(e.target.value)}
                                                placeholder="Ej. 654500"
                                            />
                                        </div>
                                    </div>
                                    <div className="documents-filter-field">
                                        <label htmlFor="filter-estado">Estado</label>
                                        <div className="documents-field-input">
                                            <span className="documents-field-input__icon" aria-hidden>
                                                <i className="ri-checkbox-circle-line" />
                                            </span>
                                            <select
                                                id="filter-estado"
                                                className="documents-field-input__control"
                                                value={filterEstado}
                                                onChange={(e) => {
                                                    const value = e.target.value;
                                                    setFilterEstado(value);
                                                    updateFiltersInQuery({ status: value });
                                                }}
                                            >
                                                <option value="">Todos</option>
                                                {statusOptions.map((option) => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
            <ColumnFilterFields defs={COLUMN_FILTER_DEFS} values={colFilterValues} onChange={setColFilter} idPrefix="documents-col" />
        </>
    );

    const filtersPanelContent = (
        <>
            <div className="documents-filters-panel__head">
                <h2 id="documents-filters-heading" className="documents-filters-panel__title">
                    Filtrar documentos
                </h2>
                {hasActiveFilters && (
                    <button type="button" className="documents-filters-clear" onClick={clearFilters}>
                        Limpiar
                    </button>
                )}
            </div>
            <div className="documents-filters-grid">{filterContent}</div>
        </>
    );

    const filtersToolbar = (
        <div className="documents-filters-toolbar">
            {hasActiveFilters && (
                <button type="button" className="documents-filters-clear documents-filters-clear--inline" onClick={clearFilters}>
                    <i className="ri-close-circle-line" aria-hidden />
                    Limpiar
                </button>
            )}
            <div className="documents-filters-dropdown" ref={filtersDropdownRef}>
                <button
                    ref={filtersToggleRef}
                    type="button"
                    className={`documents-filters-toggle ${filtersOpen ? "open" : ""}`}
                    onClick={() => setFiltersOpen((v) => !v)}
                    aria-expanded={filtersOpen}
                    aria-haspopup="true"
                    aria-controls="documents-filters-panel"
                >
                    <i className="ri-filter-3-line" aria-hidden />
                    Filtros
                    {hasActiveFilters && <span className="documents-filters-badge" aria-hidden />}
                    <i className={`ri-arrow-down-s-line documents-filters-chevron ${filtersOpen ? "open" : ""}`} aria-hidden />
                </button>
                {filtersOpen &&
                    !isMobile &&
                    typeof document !== "undefined" &&
                    createPortal(
                        <div
                            ref={filtersPanelRef}
                            id="documents-filters-panel"
                            className="documents-filters-panel documents-filters-panel--floating"
                            style={filtersPanelStyle}
                            role="region"
                            aria-labelledby="documents-filters-heading"
                        >
                            {filtersPanelContent}
                        </div>,
                        document.body,
                    )}
            </div>
        </div>
    );

    return (
        <ListPageShell className="documents-page">
            <ListPageContainer className="documents-container">
                <div className="documents-sticky-head">
                    <ListPageHeader
                        className="documents-header"
                        title="Facturas"
                        subtitle="Gestiona tus facturas, notas crédito y débito"
                        actions={
                            <>
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={openExportExcelModal}
                                    disabled={isExportingExcel}
                                >
                                    <i className="ri-file-excel-line" />
                                    Exportar Excel
                                </button>
                                <NavLink
                                    to={PATHS.DASHBOARD_BILLING}
                                    className="btn-primary documents-new-invoice"
                                >
                                    <i className="ri-add-line" aria-hidden />
                                    Nueva factura
                                </NavLink>
                            </>
                        }
                    />
                </div>

                <FiltersMobileDrawer
    open={filtersOpen && isMobile}
    onClose={() => setFiltersOpen(false)}
    title="Filtrar documentos"
    ariaLabelledBy="documents-filters-heading-mobile"
    hasActiveFilters={hasActiveFilters}
    onClear={clearFilters}
>
    {filterContent}
</FiltersMobileDrawer>

                {isExportExcelOpen && (
                    <AppModal
                        title="Exportar Facturas a Excel"
                        titleIcon="ri-file-excel-2-line"
                        ariaLabelledBy="export-excel-title"
                        onClose={closeExportExcelModal}
                        closeDisabled={isExportingExcel}
                        footer={
                            <>
                                <button type="button" className="export-cancel" onClick={closeExportExcelModal} disabled={isExportingExcel}>
                                    Cancelar
                                </button>
                                <button type="button" className="export-submit" onClick={handleExportExcel} disabled={isExportingExcel}>
                                    <i className={isExportingExcel ? "ri-loader-4-line rotating" : "ri-download-2-line"} aria-hidden />
                                    {isExportingExcel ? "Generando..." : "Descargar Excel"}
                                </button>
                            </>
                        }
                    >
                        <FilterField label="Modo" htmlFor="export-mode" icon="ri-calendar-event-line">
                            <FieldControl
                                as="select"
                                id="export-mode"
                                value={exportMode}
                                onChange={(e) => setExportMode(e.target.value as "range" | "month")}
                                disabled={isExportingExcel}
                            >
                                <option value="range">Rango de fechas</option>
                                <option value="month">Por mes</option>
                            </FieldControl>
                        </FilterField>

                        {exportMode === "range" ? (
                            <div className="export-range">
                                <FilterField label="Inicio" htmlFor="export-start-date" icon="ri-calendar-line">
                                    <FieldControl
                                        id="export-start-date"
                                        type="date"
                                        value={exportStartDate}
                                        onChange={(e) => setExportStartDate(e.target.value)}
                                        disabled={isExportingExcel}
                                    />
                                </FilterField>
                                <FilterField label="Fin" htmlFor="export-end-date" icon="ri-calendar-check-line">
                                    <FieldControl
                                        id="export-end-date"
                                        type="date"
                                        value={exportEndDate}
                                        onChange={(e) => setExportEndDate(e.target.value)}
                                        disabled={isExportingExcel}
                                    />
                                </FilterField>
                            </div>
                        ) : (
                            <FilterField label="Mes" htmlFor="export-month" icon="ri-calendar-2-line">
                                <FieldControl
                                    id="export-month"
                                    type="month"
                                    value={exportMonth}
                                    onChange={(e) => setExportMonth(e.target.value)}
                                    disabled={isExportingExcel}
                                />
                            </FilterField>
                        )}

                        <div className="export-form-grid">
                            <FilterField label="Cliente (opcional)" htmlFor="export-cliente" icon="ri-user-search-line">
                                <FieldControl
                                    id="export-cliente"
                                    type="text"
                                    value={exportCliente}
                                    onChange={(e) => setExportCliente(e.target.value)}
                                    placeholder="Nombre o documento"
                                    disabled={isExportingExcel}
                                />
                            </FilterField>
                            <FilterField label="Estado (opcional)" htmlFor="export-status" icon="ri-checkbox-circle-line">
                                <FieldControl
                                    as="select"
                                    id="export-status"
                                    value={exportStatus}
                                    onChange={(e) => setExportStatus(e.target.value)}
                                    disabled={isExportingExcel}
                                >
                                    <option value="">Todos</option>
                                    {statusOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </FieldControl>
                            </FilterField>
                        </div>

                        <p className="export-note">
                            <i className="ri-information-line" aria-hidden />
                            El servidor puede rechazar exportaciones si el resultado supera un límite máximo para mantener el Excel &quot;manejable&quot;.
                        </p>
                    </AppModal>
                )}

                <PaginationToolbar
                    position="top"
                    page={page}
                    totalPages={totalPages}
                    totalItems={totalItems}
                    pageSize={pageSize}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    rangeStart={rangeStart}
                    rangeEnd={rangeEnd}
                    isFetching={isPageFetching || showListLoading}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    showViewToggle
                    beforeViewToggle={filtersToolbar}
                    emptyLabel={totalItems === 0 ? "Sin registros" : undefined}
                />

                {showListLoading ? (
                    <div
                        className="page-loading documents-list-loading"
                        style={{ textAlign: "center", padding: "40px" }}
                        role="status"
                        aria-live="polite"
                        aria-busy="true"
                    >
                        <i
                            className="ri-loader-4-line documents-list-loading__icon"
                            aria-hidden
                        />
                        <p>{loading ? "Cargando facturas..." : "Aplicando filtros..."}</p>
                    </div>
                ) : facturas.length === 0 ? (
                    <div
                        className="page-loading"
                        style={{ textAlign: "center", padding: "40px" }}
                    >
                        <p>No hay facturas para mostrar</p>
                    </div>
                ) : (
                    <>
                        {renderFacturaView()}
                        <PaginationToolbar
                            position="bottom"
                            page={page}
                            totalPages={totalPages}
                            totalItems={totalItems}
                            pageSize={pageSize}
                            rangeStart={rangeStart}
                            rangeEnd={rangeEnd}
                            isFetching={isPageFetching}
                            onPageChange={handlePageChange}
                            emptyLabel={totalItems === 0 ? `${facturas.length} documento(s)` : undefined}
                        />
                    </>
                )}
            </ListPageContainer>

            {templateModal && (
                <AppModal
                    title="Guardar como plantilla"
                    titleIcon="ri-bookmark-line"
                    ariaLabelledBy="template-title"
                    onClose={() => setTemplateModal(null)}
                    closeDisabled={savingTemplate}
                    footer={
                        <>
                            <button type="button" className="export-cancel" onClick={() => setTemplateModal(null)} disabled={savingTemplate}>
                                Cancelar
                            </button>
                            <button type="button" className="export-submit" onClick={handleSaveTemplate} disabled={savingTemplate}>
                                <i className={savingTemplate ? "ri-loader-4-line rotating" : "ri-bookmark-3-line"} aria-hidden />
                                {savingTemplate ? "Guardando..." : "Guardar plantilla"}
                            </button>
                        </>
                    }
                >
                    <p className="export-modal-intro">
                        La factura <strong>{templateModal.label}</strong> quedará disponible en <strong>Ventas › Facturas de plantilla</strong> para reutilizarla.
                    </p>
                    <FilterField label="Recurrencia" htmlFor="template-recurrence" icon="ri-repeat-line">
                        <FieldControl
                            as="select"
                            id="template-recurrence"
                            value={templateRecurrence}
                            onChange={(e) => setTemplateRecurrence(e.target.value as RecurrenceType)}
                            disabled={savingTemplate}
                        >
                            {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
                                <option key={value} value={value}>
                                    {label}
                                </option>
                            ))}
                        </FieldControl>
                    </FilterField>
                    <small className="export-field-hint">
                        Si eliges una recurrencia, el sistema te recordará cuándo toca volver a facturar.
                    </small>
                </AppModal>
            )}
        </ListPageShell>
    );
};

export default DocumentsPage;

import { useEffect, useState, useCallback } from "react";
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

const DocumentsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
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
    const [totalPages, setTotalPages] = useState(1);

    // Sección Filtros desplegable y valores por columna
    const [filtersOpen, setFiltersOpen] = useState(hasFiltersInUrl);
    const [filterTipo, setFilterTipo] = useState(tipoFromUrl);
    const [filterPrefijo, setFilterPrefijo] = useState(prefijoFromUrl);
    const [filterCliente, setFilterCliente] = useState(clienteFromUrl);
    const [filterTotal, setFilterTotal] = useState(totalFromUrl);
    const [filterEstado, setFilterEstado] = useState(statusFromUrl);
    /** Valores aplicados a API/URL tras debounce (solo texto: prefijo, cliente, total) */
    const [committedPrefijo, setCommittedPrefijo] = useState(prefijoFromUrl);
    const [committedCliente, setCommittedCliente] = useState(clienteFromUrl);
    const [committedTotal, setCommittedTotal] = useState(totalFromUrl);

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
            const response = await getAllInvoices(page, 20, {
                tipo_documento: filterTipo,
                prefijo: committedPrefijo,
                cliente: committedCliente,
                total: committedTotal,
                status: filterEstado,
            });
            if (response) {
                setFacturas(response.facturas);
                setTotalPages(response.pagination.totalPages);
            }
        } catch (error: unknown) {
            errorToast(error instanceof Error ? error.message : "Error al cargar facturas");
        } finally {
            setLoading(false);
            setIsPageFetching(false);
        }
    }, [page, facturas.length, filterTipo, committedPrefijo, committedCliente, committedTotal, filterEstado]);

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
        if (filterTipo !== tipoFromUrl) setFilterTipo(tipoFromUrl);
        if (filterPrefijo !== prefijoFromUrl) setFilterPrefijo(prefijoFromUrl);
        if (filterCliente !== clienteFromUrl) setFilterCliente(clienteFromUrl);
        if (filterTotal !== totalFromUrl) setFilterTotal(totalFromUrl);
        if (filterEstado !== statusFromUrl) setFilterEstado(statusFromUrl);
        if (committedPrefijo !== prefijoFromUrl) setCommittedPrefijo(prefijoFromUrl);
        if (committedCliente !== clienteFromUrl) setCommittedCliente(clienteFromUrl);
        if (committedTotal !== totalFromUrl) setCommittedTotal(totalFromUrl);
        if (hasFiltersInUrl) setFiltersOpen(true);
    }, [pageFromUrl, tipoFromUrl, prefijoFromUrl, clienteFromUrl, totalFromUrl, statusFromUrl, hasFiltersInUrl]);

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
            maximumFractionDigits: 2,
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

    const hasActiveFilters = [filterTipo, filterPrefijo, filterCliente, filterTotal, filterEstado].some((v) => v.trim() !== "");

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

    return (
        <main className="documents-page">
            <div className="documents-container">
                <div className="documents-header">
                    <div className="header-content">
                        <h1>Facturas</h1>
                        <p>Gestiona tus facturas, notas crédito y débito</p>
                    </div>
                    <div className="documents-actions">
                        <button
                            type="button"
                            className={`documents-filters-toggle ${filtersOpen ? "open" : ""}`}
                            onClick={() => setFiltersOpen((o) => !o)}
                            aria-expanded={filtersOpen}
                            aria-controls="documents-filters-panel"
                        >
                            <i className="ri-filter-line" />
                            Filtros
                            {hasActiveFilters && (
                                <span
                                    className="documents-filters-badge"
                                    aria-hidden
                                />
                            )}
                            <i
                                className={`ri-arrow-down-s-line documents-filters-chevron ${filtersOpen ? "open" : ""}`}
                                aria-hidden
                            />
                        </button>
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
                            to={PATHS.DASHBOARD}
                            className="btn-primary"
                        >
                            Nueva Factura
                        </NavLink>
                    </div>
                </div>

                {/* Sección Filtros desplegable */}
                <div
                    id="documents-filters-panel"
                    className={`documents-filters-panel ${filtersOpen ? "documents-filters-panel--open" : ""}`}
                    role="region"
                    aria-labelledby="documents-filters-heading"
                >
                    <h2
                        id="documents-filters-heading"
                        className="documents-filters-panel__title"
                    >
                        Filtros
                    </h2>
                    <div className="documents-filters-grid">
                        <div className="documents-filter-field">
                            <label htmlFor="filter-tipo">Tipo Documento</label>
                            <select
                                id="filter-tipo"
                                value={filterTipo}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFilterTipo(value);
                                    updateFiltersInQuery({ tipo_documento: value });
                                }}
                            >
                                <option value="">Todos</option>
                                {tipoDocumentoOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className="documents-filter-field">
                            <label htmlFor="filter-prefijo">Prefijo / Consecutivo</label>
                            <input
                                id="filter-prefijo"
                                type="text"
                                value={filterPrefijo}
                                onChange={(e) => setFilterPrefijo(e.target.value)}
                                placeholder="Ej. FEM123 o 123"
                            />
                        </div>
                        <div className="documents-filter-field">
                            <label htmlFor="filter-cliente">Cliente</label>
                            <input
                                id="filter-cliente"
                                type="text"
                                value={filterCliente}
                                onChange={(e) => setFilterCliente(e.target.value)}
                                placeholder="Nombre o documento"
                            />
                        </div>
                        <div className="documents-filter-field">
                            <label htmlFor="filter-total">Total</label>
                            <input
                                id="filter-total"
                                type="text"
                                value={filterTotal}
                                onChange={(e) => setFilterTotal(e.target.value)}
                                placeholder="Ej. 654500"
                            />
                        </div>
                        <div className="documents-filter-field">
                            <label htmlFor="filter-estado">Estado</label>
                            <select
                                id="filter-estado"
                                value={filterEstado}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setFilterEstado(value);
                                    updateFiltersInQuery({ status: value });
                                }}
                            >
                                <option value="">Todos</option>
                                {statusOptions.map((option) => (
                                    <option
                                        key={option.value}
                                        value={option.value}
                                    >
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                    {hasActiveFilters && (
                        <button
                            type="button"
                            className="documents-filters-clear"
                            onClick={clearFilters}
                        >
                            Limpiar filtros
                        </button>
                    )}
                </div>

                {isExportExcelOpen && (
                    <div
                        className="export-overlay"
                        onClick={closeExportExcelModal}
                        role="presentation"
                    >
                        <div
                            className="export-modal"
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="export-excel-title"
                        >
                            <div className="export-modal-header">
                                <h3 id="export-excel-title">Exportar Facturas a Excel</h3>
                                <button
                                    type="button"
                                    className="export-modal-close"
                                    onClick={closeExportExcelModal}
                                    disabled={isExportingExcel}
                                    aria-label="Cerrar"
                                >
                                    <i className="ri-close-line" />
                                </button>
                            </div>

                            <div className="export-modal-body">
                                <div className="export-field">
                                    <label htmlFor="export-mode">Modo</label>
                                    <select
                                        id="export-mode"
                                        value={exportMode}
                                        onChange={(e) => setExportMode(e.target.value as "range" | "month")}
                                        disabled={isExportingExcel}
                                    >
                                        <option value="range">Rango de fechas</option>
                                        <option value="month">Por mes</option>
                                    </select>
                                </div>

                                {exportMode === "range" ? (
                                    <div className="export-range">
                                        <div className="export-field">
                                            <label htmlFor="export-start-date">Inicio</label>
                                            <input
                                                id="export-start-date"
                                                type="date"
                                                value={exportStartDate}
                                                onChange={(e) => setExportStartDate(e.target.value)}
                                                disabled={isExportingExcel}
                                            />
                                        </div>
                                        <div className="export-field">
                                            <label htmlFor="export-end-date">Fin</label>
                                            <input
                                                id="export-end-date"
                                                type="date"
                                                value={exportEndDate}
                                                onChange={(e) => setExportEndDate(e.target.value)}
                                                disabled={isExportingExcel}
                                            />
                                        </div>
                                    </div>
                                ) : (
                                    <div className="export-field">
                                        <label htmlFor="export-month">Mes</label>
                                        <input
                                            id="export-month"
                                            type="month"
                                            value={exportMonth}
                                            onChange={(e) => setExportMonth(e.target.value)}
                                            disabled={isExportingExcel}
                                        />
                                    </div>
                                )}

                                <div className="export-form-grid">
                                    <div className="export-field">
                                        <label htmlFor="export-cliente">Cliente (opcional)</label>
                                        <input
                                            id="export-cliente"
                                            type="text"
                                            value={exportCliente}
                                            onChange={(e) => setExportCliente(e.target.value)}
                                            placeholder="Nombre o documento"
                                            disabled={isExportingExcel}
                                        />
                                    </div>
                                    <div className="export-field">
                                        <label htmlFor="export-status">Estado (opcional)</label>
                                        <select
                                            id="export-status"
                                            value={exportStatus}
                                            onChange={(e) => setExportStatus(e.target.value)}
                                            disabled={isExportingExcel}
                                        >
                                            <option value="">Todos</option>
                                            {statusOptions.map((option) => (
                                                <option
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <p className="export-note">El servidor puede rechazar exportaciones si el resultado supera un límite máximo para mantener el Excel "manejable".</p>
                            </div>

                            <div className="export-modal-actions">
                                <button
                                    type="button"
                                    className="export-cancel"
                                    onClick={closeExportExcelModal}
                                    disabled={isExportingExcel}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="button"
                                    className="export-submit"
                                    onClick={handleExportExcel}
                                    disabled={isExportingExcel}
                                >
                                    {isExportingExcel ? "Generando..." : "Descargar Excel"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                        {totalPages > 1 && (
                            <div className="pagination pagination--top">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1 || isPageFetching}
                                    aria-label="Página anterior"
                                >
                                    Anterior
                                </button>
                                <span className="pagination__info">
                                    Página {page} de {totalPages}
                                    {isPageFetching ? " - Actualizando..." : ""}
                                </span>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page === totalPages || isPageFetching}
                                    aria-label="Página siguiente"
                                >
                                    Siguiente
                                </button>
                            </div>
                        )}
                        <div className="documents-table-container">
                            <table className="documents-table">
                                <thead>
                                    <tr>
                                        <th>Tipo</th>
                                        <th>Número</th>
                                        <th>Cliente</th>
                                        <th>Fecha</th>
                                        <th>Total</th>
                                        <th>Estado</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {facturas.map((factura) => (
                                        <tr key={factura._id}>
                                            <td data-label="Tipo" className="document-type">
                                                {(() => {
                                                    const ti = getTipoInfo(factura);
                                                    return (
                                                        <span className={`doc-type-badge ${ti.cls}`} title={ti.label}>
                                                            {factura.Parametros?.TipoAmbiente === "2" && <i className="ri-error-warning-fill" title="Ambiente de pruebas"></i>}
                                                            <i className={ti.icon}></i> {ti.label}
                                                        </span>
                                                    );
                                                })()}
                                            </td>
                                            <td
                                                className="document-number"
                                                data-label="Número"
                                            >
                                                {/* Los borradores no reservan consecutivo: se asigna al enviar. */}
                                                {factura.Encabezado.NumeroDocumento
                                                    ? `${factura.Encabezado.PrefijoDocumento}-${factura.Encabezado.NumeroDocumento}`
                                                    : `${factura.Encabezado.PrefijoDocumento} · por asignar`}
                                            </td>
                                            <td data-label="Cliente">{factura.Terceros?.TerceroClienteContable?.Tercero?.NombreTercero?.[0]?.Value || "N/A"}</td>
                                            <td data-label="Fecha">{formatDate(factura.Encabezado.FechaYHoraDocumento || factura.Encabezado.FechaYHoraEmision || "")}</td>
                                            <td
                                                className="document-total"
                                                data-label="Total"
                                            >
                                                {formatPrice(factura.Totales.TotalMonetario.ValorAPagar.Value, factura.Totales.TotalMonetario.ValorAPagar.IdMoneda)}
                                            </td>
                                            <td data-label="Estado">
                                                <span className={`status-badge ${getStatusClass(factura)}`}>{getStatusLabel(factura)}</span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="document-actions">
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => handleViewDetail(factura._id)}
                                                    >
                                                        <i className="ri-eye-line"></i>
                                                        Ver
                                                    </button>
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => handleOpenTemplateModal(factura)}
                                                        title="Guardar esta factura como plantilla para reutilizarla"
                                                    >
                                                        <i className="ri-bookmark-line"></i>
                                                        Plantilla
                                                    </button>
                                                    <button
                                                        className="btn-action"
                                                        onClick={() => handleGenerateRemision(factura._id)}
                                                        disabled={remisionBusyId === factura._id}
                                                        title="Generar remisión de entrega para que el cliente firme"
                                                    >
                                                        <i className={remisionBusyId === factura._id ? "ri-loader-4-line rotating" : "ri-truck-line"}></i>
                                                        Remisión
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {totalPages > 1 && (
                            <div className="pagination pagination--bottom">
                                <button
                                    onClick={() => handlePageChange(page - 1)}
                                    disabled={page === 1 || isPageFetching}
                                    aria-label="Página anterior"
                                >
                                    Anterior
                                </button>
                                <span className="pagination__info">
                                    Página {page} de {totalPages}
                                    {isPageFetching ? " - Actualizando..." : ""}
                                </span>
                                <button
                                    onClick={() => handlePageChange(page + 1)}
                                    disabled={page === totalPages || isPageFetching}
                                    aria-label="Página siguiente"
                                >
                                    Siguiente
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {templateModal && (
                <div className="export-overlay" onClick={() => !savingTemplate && setTemplateModal(null)} role="presentation">
                    <div className="export-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="template-title">
                        <div className="export-modal-header">
                            <h3 id="template-title">Guardar como plantilla</h3>
                            <button type="button" className="export-modal-close" onClick={() => setTemplateModal(null)} disabled={savingTemplate} aria-label="Cerrar">
                                <i className="ri-close-line" />
                            </button>
                        </div>
                        <div className="export-modal-body">
                            <p style={{ color: "var(--text-muted)", fontSize: "0.9rem", margin: "0 0 1rem" }}>
                                La factura <strong>{templateModal.label}</strong> quedará disponible en <strong>Ventas › Facturas de plantilla</strong> para reutilizarla.
                            </p>
                            <div className="export-field">
                                <label htmlFor="template-recurrence">Recurrencia</label>
                                <select
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
                                </select>
                                <small style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                                    Si eliges una recurrencia, el sistema te recordará cuándo toca volver a facturar.
                                </small>
                            </div>
                        </div>
                        <div className="export-modal-actions">
                            <button type="button" className="export-cancel" onClick={() => setTemplateModal(null)} disabled={savingTemplate}>
                                Cancelar
                            </button>
                            <button type="button" className="export-submit" onClick={handleSaveTemplate} disabled={savingTemplate}>
                                {savingTemplate ? "Guardando..." : "Guardar plantilla"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
};

export default DocumentsPage;

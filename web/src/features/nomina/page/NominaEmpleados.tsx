import { useEffect, useState } from "react";
import "./NominaEmpleados.css";
import { getAllEmpleados, deleteEmpleado, type Empleado } from "../../../services/empleados.service";
import { getNominaLotes, getNominasByPeriodo, getNominaPlantilla, type Nomina, type LoteResumen, type PlantillaLote } from "../../../services/nomina.service";
import { TIPO_CONTRATO_OPTIONS, TIPO_TRABAJADOR_OPTIONS, labelFromCatalog } from "../nomina.constants";
import EmpleadoModal from "../../../components/modals/EmpleadoModal/EmpleadoModal";
import EmpleadoImportModal from "../../../components/modals/EmpleadoImportModal/EmpleadoImportModal";
import NominaModal from "../../../components/modals/NominaModal/NominaModal";
import NominaDetailModal from "../../../components/modals/NominaDetailModal/NominaDetailModal";
import NominaCertificados from "../components/NominaCertificados";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import CopyButton from "../../../components/shared/CopyButton/CopyButton";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";

type Tab = "empleados" | "nomina" | "certificados";

const PAGE_SIZE = 20;

const formatCOP = (value: number | string): string => {
    const n = typeof value === "string" ? Number(value) : value;
    return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number.isFinite(n) ? n : 0);
};

const statusLabel: Record<string, string> = {
    APPROVED: "Aprobada",
    REJECTED: "Rechazada",
    PENDING: "Borrador",
    SENT: "Enviada",
};

const NominaEmpleadosPage: React.FC = () => {
    const [tab, setTab] = useState<Tab>("empleados");

    // ── Empleados ──
    const [empleados, setEmpleados] = useState<Empleado[]>([]);
    const [empLoading, setEmpLoading] = useState(true);
    const [empPage, setEmpPage] = useState(1);
    const [empTotal, setEmpTotal] = useState(0);
    const [empRefresh, setEmpRefresh] = useState(0);
    const [isEmpModalOpen, setIsEmpModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [selectedEmpleado, setSelectedEmpleado] = useState<Empleado | null>(null);
    const [empToDelete, setEmpToDelete] = useState<Empleado | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    // ── Nómina (agrupada por lote/periodo) ──
    const [lotes, setLotes] = useState<LoteResumen[]>([]);
    const [nomLoading, setNomLoading] = useState(true);
    const [nomRefresh, setNomRefresh] = useState(0);
    const [isNominaModalOpen, setIsNominaModalOpen] = useState(false);
    const [selectedNomina, setSelectedNomina] = useState<Nomina | null>(null);
    /** Periodo expandido → sus nóminas (detalle del lote). */
    const [expandedPeriodo, setExpandedPeriodo] = useState<string | null>(null);
    const [periodoNominas, setPeriodoNominas] = useState<Record<string, Nomina[]>>({});
    const [loadingPeriodo, setLoadingPeriodo] = useState<string | null>(null);
    /** Plantilla precargada para "generar mes siguiente". */
    const [plantilla, setPlantilla] = useState<PlantillaLote | null>(null);
    const [loadingPlantilla, setLoadingPlantilla] = useState(false);

    const empTotalPages = Math.max(1, Math.ceil(empTotal / PAGE_SIZE));

    useEffect(() => {
        let ignore = false;
        setEmpLoading(true);
        (async () => {
            try {
                const res = await getAllEmpleados(empPage, PAGE_SIZE);
                if (ignore) return;
                setEmpleados(res.items);
                setEmpTotal(res.total);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar empleados");
            } finally {
                if (!ignore) setEmpLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [empPage, empRefresh]);

    useEffect(() => {
        let ignore = false;
        setNomLoading(true);
        (async () => {
            try {
                const res = await getNominaLotes();
                if (ignore) return;
                setLotes(res.lotes);
            } catch (error) {
                if (!ignore) errorToast(error instanceof Error ? error.message : "Error al cargar nóminas");
            } finally {
                if (!ignore) setNomLoading(false);
            }
        })();
        return () => { ignore = true; };
    }, [nomRefresh]);

    /** Expande/colapsa un periodo y carga sus nóminas la primera vez. */
    const togglePeriodo = async (periodoKey: string) => {
        if (expandedPeriodo === periodoKey) { setExpandedPeriodo(null); return; }
        setExpandedPeriodo(periodoKey);
        if (!periodoNominas[periodoKey]) {
            setLoadingPeriodo(periodoKey);
            try {
                const res = await getNominasByPeriodo(periodoKey);
                setPeriodoNominas((prev) => ({ ...prev, [periodoKey]: res.items }));
            } catch (error) {
                errorToast(error instanceof Error ? error.message : "Error al cargar el detalle del periodo");
            } finally {
                setLoadingPeriodo(null);
            }
        }
    };

    /** Trae la plantilla del último lote y abre el modal precargado. */
    const handleGenerarMesSiguiente = async (fromPeriodoKey?: string) => {
        setLoadingPlantilla(true);
        try {
            const tpl = await getNominaPlantilla(fromPeriodoKey);
            if (!tpl.items.length) {
                errorToast("No hay un lote anterior para usar como plantilla. Emite la primera nómina del periodo.");
                return;
            }
            setPlantilla(tpl);
            setIsNominaModalOpen(true);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al generar la plantilla");
        } finally {
            setLoadingPlantilla(false);
        }
    };

    const handleConfirmDeleteEmpleado = async () => {
        if (!empToDelete) return;
        setIsDeleting(true);
        try {
            await deleteEmpleado(empToDelete._id);
            successToast("Empleado eliminado correctamente");
            if (empleados.length === 1 && empPage > 1) setEmpPage((p) => p - 1);
            else setEmpRefresh((k) => k + 1);
            setEmpToDelete(null);
        } catch (error) {
            errorToast(error instanceof Error ? error.message : "Error al eliminar el empleado");
        } finally {
            setIsDeleting(false);
        }
    };

    const renderPagination = (page: number, totalPages: number, setPage: (n: number) => void, loading: boolean, position: "top" | "bottom") => (
        <div className={`pagination pagination--${position}`}>
            <button onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1 || loading} aria-label="Página anterior">Anterior</button>
            <span className="pagination__info">Página {page} de {totalPages}</span>
            <button onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page >= totalPages || loading} aria-label="Página siguiente">Siguiente</button>
        </div>
    );

    return (
        <main className="nomina-page">
            <div className="nomina-container">
                <div className="nomina-header">
                    <div className="header-content">
                        <h1>Nómina y empleados</h1>
                        <p>Gestiona tus empleados y emite la nómina electrónica a la DIAN</p>
                    </div>
                    <div className="nomina-actions">
                        {tab === "empleados" ? (
                            <>
                                <button className="btn-secondary" onClick={() => setIsImportModalOpen(true)} title="Cargar o actualizar empleados desde un archivo CSV/Excel">
                                    <i className="ri-file-excel-2-line"></i> Importar / Plantilla
                                </button>
                                <button className="btn-primary" onClick={() => { setSelectedEmpleado(null); setIsEmpModalOpen(true); }}>
                                    <i className="ri-user-add-line"></i> Nuevo empleado
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn-secondary" onClick={() => handleGenerarMesSiguiente()} disabled={loadingPlantilla || lotes.length === 0} title="Clona el último periodo emitido para el mes siguiente">
                                    {loadingPlantilla ? (<><i className="ri-loader-4-line rotating"></i> Generando...</>) : (<><i className="ri-file-copy-line"></i> Generar mes siguiente</>)}
                                </button>
                                <button className="btn-primary" onClick={() => { setPlantilla(null); setIsNominaModalOpen(true); }}>
                                    <i className="ri-add-line"></i> Emitir nómina
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="nomina-tabs" role="tablist">
                    <button className={`nomina-tab ${tab === "empleados" ? "active" : ""}`} role="tab" aria-selected={tab === "empleados"} onClick={() => setTab("empleados")}>
                        <i className="ri-team-line"></i> Empleados
                    </button>
                    <button className={`nomina-tab ${tab === "nomina" ? "active" : ""}`} role="tab" aria-selected={tab === "nomina"} onClick={() => setTab("nomina")}>
                        <i className="ri-wallet-3-line"></i> Nómina
                    </button>
                    <button className={`nomina-tab ${tab === "certificados" ? "active" : ""}`} role="tab" aria-selected={tab === "certificados"} onClick={() => setTab("certificados")}>
                        <i className="ri-file-text-line"></i> Certificados
                    </button>
                </div>

                {/* ── Tab Empleados ── */}
                {tab === "empleados" && (
                    empLoading ? (
                        <div className="page-loading"><p>Cargando empleados...</p></div>
                    ) : empleados.length === 0 ? (
                        <div className="page-loading"><p>No hay empleados registrados. Crea el primero con "Nuevo empleado".</p></div>
                    ) : (
                        <>
                            {renderPagination(empPage, empTotalPages, setEmpPage, empLoading, "top")}
                            <div className="nomina-table-container">
                                <table className="nomina-table">
                                    <thead>
                                        <tr>
                                            <th>Nombre</th>
                                            <th>Documento</th>
                                            <th>Tipo trabajador</th>
                                            <th>Contrato</th>
                                            <th>Sueldo</th>
                                            <th>Acciones</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {empleados.map((emp) => (
                                            <tr key={emp._id}>
                                                <td className="cell-strong" data-label="Nombre">{emp.primer_nombre} {emp.otros_nombres} {emp.primer_apellido} {emp.segundo_apellido}</td>
                                                <td data-label="Documento">{emp.numero_documento}<CopyButton value={emp.numero_documento} label="documento" /></td>
                                                <td data-label="Tipo trabajador">{labelFromCatalog(TIPO_TRABAJADOR_OPTIONS, emp.tipo_trabajador)}</td>
                                                <td data-label="Contrato">{labelFromCatalog(TIPO_CONTRATO_OPTIONS, emp.tipo_contrato)}</td>
                                                <td data-label="Sueldo">{formatCOP(emp.sueldo)}</td>
                                                <td data-label="Acciones">
                                                    <div className="action-buttons">
                                                        <button className="btn-icon" title="Editar" onClick={() => { setSelectedEmpleado(emp); setIsEmpModalOpen(true); }}>
                                                            <i className="ri-edit-line"></i>
                                                        </button>
                                                        <button className="btn-icon btn-icon-danger" title="Eliminar" onClick={() => setEmpToDelete(emp)}>
                                                            <i className="ri-delete-bin-line"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {renderPagination(empPage, empTotalPages, setEmpPage, empLoading, "bottom")}
                        </>
                    )
                )}

                {/* ── Tab Nómina (agrupada por periodo/lote) ── */}
                {tab === "nomina" && (
                    nomLoading ? (
                        <div className="page-loading"><p>Cargando nóminas...</p></div>
                    ) : lotes.length === 0 ? (
                        <div className="page-loading"><p>Aún no has emitido nóminas. Usa "Emitir nómina" para crear la primera.</p></div>
                    ) : (
                        <div className="lote-group-list">
                            {lotes.map((lote) => {
                                const open = expandedPeriodo === lote.periodo_key;
                                const detalle = periodoNominas[lote.periodo_key] ?? [];
                                return (
                                    <div className={`lote-group ${open ? "open" : ""}`} key={lote.periodo_key}>
                                        <div className="lote-group-head" role="button" tabIndex={0} aria-expanded={open}
                                            onClick={() => togglePeriodo(lote.periodo_key)}
                                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); togglePeriodo(lote.periodo_key); } }}
                                        >
                                            <i className={`ri-arrow-right-s-line lote-chevron ${open ? "rot" : ""}`}></i>
                                            <span className="lote-group-title">{lote.periodo_label}</span>
                                            <span className="lote-group-meta">{lote.trabajadores} trabajador(es)</span>
                                            <span className="lote-group-badges">
                                                {lote.aprobadas > 0 && <span className="status-badge status-approved">{lote.aprobadas} aprob.</span>}
                                                {lote.rechazadas > 0 && <span className="status-badge status-rejected">{lote.rechazadas} rech.</span>}
                                                {lote.pendientes > 0 && <span className="status-badge status-sent">{lote.pendientes} pend.</span>}
                                            </span>
                                            <span className="lote-group-total">{formatCOP(lote.total)}</span>
                                            <button
                                                type="button"
                                                className="btn-icon"
                                                title="Generar el mes siguiente a partir de este periodo"
                                                onClick={(e) => { e.stopPropagation(); handleGenerarMesSiguiente(lote.periodo_key); }}
                                            >
                                                <i className="ri-file-copy-line"></i>
                                            </button>
                                        </div>

                                        {open && (
                                            loadingPeriodo === lote.periodo_key ? (
                                                <div className="lote-group-body"><p className="field-hint">Cargando detalle...</p></div>
                                            ) : (
                                                <div className="lote-group-body">
                                                    <div className="nomina-table-container">
                                                        <table className="nomina-table">
                                                            <thead>
                                                                <tr>
                                                                    <th>Número</th>
                                                                    <th>Empleado</th>
                                                                    <th>Total</th>
                                                                    <th>Estado</th>
                                                                    <th>CUNE</th>
                                                                    <th>Acciones</th>
                                                                </tr>
                                                            </thead>
                                                            <tbody>
                                                                {detalle.map((nom) => {
                                                                    const t = nom.NominaElectronica?.Trabajador;
                                                                    const status = nom.systemInfo?.nominaStatus ?? "PENDING";
                                                                    return (
                                                                        <tr key={nom._id} className="row-clickable" onClick={() => setSelectedNomina(nom)}>
                                                                            <td className="cell-strong" data-label="Número">{nom.NominaElectronica?.NumeroSecuenciaXML?.Numero ?? "—"}</td>
                                                                            <td data-label="Empleado">{t ? `${t.PrimerNombre ?? ""} ${t.PrimerApellido ?? ""}` : "—"}</td>
                                                                            <td data-label="Total">{formatCOP(nom.NominaElectronica?.ComprobanteTotal ?? 0)}</td>
                                                                            <td data-label="Estado"><span className={`status-badge status-${status.toLowerCase()}`}>{statusLabel[status] ?? status}</span></td>
                                                                            <td data-label="CUNE" className="cell-cune" title={nom.systemInfo?.cune ?? nom.systemInfo?.dianStatusDescr ?? ""}>
                                                                                {nom.systemInfo?.cune ? `${nom.systemInfo.cune.slice(0, 16)}…` : (status === "REJECTED" ? "—" : "Pendiente")}
                                                                            </td>
                                                                            <td data-label="Acciones">
                                                                                <button className="btn-icon" title="Ver detalle" onClick={(e) => { e.stopPropagation(); setSelectedNomina(nom); }}>
                                                                                    <i className="ri-eye-line"></i>
                                                                                </button>
                                                                            </td>
                                                                        </tr>
                                                                    );
                                                                })}
                                                            </tbody>
                                                        </table>
                                                    </div>
                                                </div>
                                            )
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )
                )}

                {/* ── Tab Certificados (Formulario 220) ── */}
                {tab === "certificados" && <NominaCertificados />}
            </div>

            <EmpleadoModal
                isOpen={isEmpModalOpen}
                onClose={() => { setIsEmpModalOpen(false); setSelectedEmpleado(null); }}
                onSuccess={() => setEmpRefresh((k) => k + 1)}
                empleado={selectedEmpleado}
            />
            <EmpleadoImportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
                onSuccess={() => { setEmpPage(1); setEmpRefresh((k) => k + 1); }}
            />
            <NominaModal
                isOpen={isNominaModalOpen}
                onClose={() => { setIsNominaModalOpen(false); setPlantilla(null); }}
                onSuccess={() => {
                    setNomRefresh((k) => k + 1);
                    // Fuerza recarga del detalle del periodo abierto la próxima vez que se expanda.
                    setPeriodoNominas({});
                }}
                plantilla={plantilla}
            />
            <NominaDetailModal
                isOpen={!!selectedNomina}
                onClose={() => setSelectedNomina(null)}
                nomina={selectedNomina}
                onUpdated={(updated) => {
                    setSelectedNomina(updated);
                    setPeriodoNominas((prev) => {
                        const next: Record<string, Nomina[]> = {};
                        for (const [k, list] of Object.entries(prev)) next[k] = list.map((n) => (n._id === updated._id ? updated : n));
                        return next;
                    });
                }}
            />
            <ConfirmModal
                isOpen={!!empToDelete}
                onClose={() => setEmpToDelete(null)}
                onConfirm={handleConfirmDeleteEmpleado}
                title="¿Eliminar empleado?"
                message={`¿Seguro que deseas eliminar a "${empToDelete?.primer_nombre ?? ""} ${empToDelete?.primer_apellido ?? ""}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                cancelText="Cancelar"
                type="danger"
                loading={isDeleting}
            />
        </main>
    );
};

export default NominaEmpleadosPage;

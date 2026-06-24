import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "../../purchases/page/Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getTerceros, deleteTercero, migrateTerceros, backfillTerceros } from "../terceros.service";
import type { Tercero, TerceroRole } from "../terceros.types";
import { ROLE_LABELS } from "../terceros.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import TerceroModal from "../components/TerceroModal";

const ROLE_BADGE: Record<TerceroRole, string> = { cliente: "status-paid", proveedor: "status-pending", empleado: "status-paid", otro: "" };

const TercerosPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const [terceros, setTerceros] = useState<Tercero[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [rol, setRol] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Tercero | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [migrating, setMigrating] = useState(false);
    const [linking, setLinking] = useState(false);

    const handleBackfill = async () => {
        if (!confirm("¿Vincular tus clientes, proveedores y empleados con el maestro de terceros? Es seguro y se puede repetir.")) return;
        setLinking(true);
        try {
            const res = await backfillTerceros();
            successToast(res.message);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al vincular");
        } finally {
            setLinking(false);
        }
    };

    useRealtime(RealtimeEvents.TERCERO_CHANGED, (payload) => setTerceros((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getTerceros(page, 20, debounced.trim(), rol);
            setTerceros(res.terceros);
            setTotalPages(res.pagination.totalPages);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar terceros");
        } finally {
            setLoading(false);
        }
    }, [page, debounced, rol, refreshKey]);

    useEffect(() => { load(); }, [load]);

    const handlePage = (next: number) => {
        const safe = Math.max(1, Math.min(totalPages, next));
        setPage(safe);
        setSearchParams((prev) => { const p = new URLSearchParams(prev); p.set("page", String(safe)); return p; });
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteTercero(toDelete.id);
            successToast("Tercero eliminado");
            setToDelete(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const handleMigrate = async () => {
        if (!confirm("¿Importar clientes y proveedores existentes al maestro de terceros? Es seguro y se puede repetir (no duplica).")) return;
        setMigrating(true);
        try {
            const res = await migrateTerceros();
            successToast(res.message);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error en la migración");
        } finally {
            setMigrating(false);
        }
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Terceros</h1>
                        <p>Maestro unificado de clientes, proveedores y empleados con sus datos fiscales</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar nombre, NIT, correo..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <select value={rol} onChange={(e) => { setRol(e.target.value); setPage(1); }} style={{ padding: "8px 12px", borderRadius: 8, border: "1px solid var(--border-light)" }}>
                            <option value="">Todos los roles</option>
                            <option value="cliente">Clientes</option>
                            <option value="proveedor">Proveedores</option>
                            <option value="empleado">Empleados</option>
                        </select>
                        <button className="btn-secondary" onClick={handleMigrate} disabled={migrating} title="Importar clientes y proveedores existentes">
                            <i className="ri-refresh-line" /> {migrating ? "Importando..." : "Importar existentes"}
                        </button>
                        <button className="btn-secondary" onClick={handleBackfill} disabled={linking} title="Vincular clientes/proveedores/empleados con su tercero canónico">
                            <i className="ri-links-line" /> {linking ? "Vinculando..." : "Vincular IDs"}
                        </button>
                        <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
                            <i className="ri-add-line"></i> Nuevo tercero
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando terceros...</div>
                ) : terceros.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-contacts-book-line"></i>
                        <p>No hay terceros. Crea uno nuevo o importa tus clientes y proveedores existentes.</p>
                        <button className="btn-primary" onClick={handleMigrate} disabled={migrating}><i className="ri-refresh-line" /> Importar existentes</button>
                    </div>
                ) : (
                    <>
                        <div className="purchases-table-container">
                            <table className="purchases-table">
                                <thead>
                                    <tr><th>Tercero</th><th>NIT / Doc.</th><th>Roles</th><th>Correo</th><th>Resp. IVA</th><th></th><th>Acciones</th></tr>
                                </thead>
                                <tbody>
                                    {terceros.map((t) => (
                                        <tr key={t._id}>
                                            <td data-label="Tercero">{t.name}{t.conflicto_revision && <span title="Revisar: posible duplicado" style={{ color: "var(--tertiary-color)", marginLeft: 6 }}><i className="ri-error-warning-line" /></span>}</td>
                                            <td data-label="NIT / Doc.">{t.doc_number}{t.doc_number_dv ? `-${t.doc_number_dv}` : ""}</td>
                                            <td data-label="Roles">
                                                {t.roles.map((r) => <span key={r} className={`status-badge ${ROLE_BADGE[r]}`} style={{ marginRight: 4 }}>{ROLE_LABELS[r]}</span>)}
                                            </td>
                                            <td data-label="Correo">{t.email || "—"}</td>
                                            <td data-label="Resp. IVA">{t.responsable_iva ? "Sí" : "No"}</td>
                                            <td>{t.gran_contribuyente && <span className="status-badge status-paid" title="Gran contribuyente">GC</span>} {t.autorretenedor && <span className="status-badge status-pending" title="Autorretenedor">AR</span>}</td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button className="btn-icon" title="Editar" onClick={() => { setEditing(t); setModalOpen(true); }}><i className="ri-edit-line"></i></button>
                                                    <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: t._id, name: t.name })}><i className="ri-delete-bin-line"></i></button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {totalPages > 1 && (
                            <div className="pagination pagination--bottom">
                                <button onClick={() => handlePage(page - 1)} disabled={page === 1}>Anterior</button>
                                <span className="pagination__info">Página {page} de {totalPages}</span>
                                <button onClick={() => handlePage(page + 1)} disabled={page === totalPages}>Siguiente</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <TerceroModal
                isOpen={modalOpen}
                tercero={editing}
                onClose={() => { setModalOpen(false); setEditing(null); }}
                onSaved={() => { setModalOpen(false); setEditing(null); setRefreshKey((k) => k + 1); }}
            />
            <ConfirmModal isOpen={!!toDelete} title="Eliminar tercero" message={`¿Eliminar a "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={handleDelete} loading={deleting} />
        </main>
    );
};

export default TercerosPage;

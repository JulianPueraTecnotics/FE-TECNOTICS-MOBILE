import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import "./Purchases.css";
import { FILTER_DEBOUNCE_MS, useDebouncedValue } from "../../../utils/useDebouncedValue";
import { getAllSuppliers, createSupplier, updateSupplier, deleteSupplier } from "../purchases.service";
import type { Supplier } from "../purchases.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";
import SupplierModal from "../components/SupplierModal";

const SuppliersPage: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const pageFromUrl = Math.max(1, Number(searchParams.get("page")) || 1);
    const [suppliers, setSuppliers] = useState<Supplier[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(pageFromUrl);
    const [totalPages, setTotalPages] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const debounced = useDebouncedValue(search, FILTER_DEBOUNCE_MS);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Supplier | null>(null);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    useRealtime(RealtimeEvents.SUPPLIER_CHANGED, (payload) => setSuppliers((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getAllSuppliers(page, 20, debounced.trim());
            setSuppliers(res.suppliers);
            setTotalPages(res.pagination.totalPages);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar proveedores");
        } finally {
            setLoading(false);
        }
    }, [page, debounced, refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const handlePageChange = (next: number) => {
        const safe = Math.max(1, Math.min(totalPages, next));
        setPage(safe);
        setSearchParams((prev) => {
            const p = new URLSearchParams(prev);
            p.set("page", String(safe));
            return p;
        });
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteSupplier(toDelete.id);
            successToast("Proveedor eliminado");
            if (suppliers.length === 1 && page > 1) handlePageChange(page - 1);
            else setRefreshKey((k) => k + 1);
            setToDelete(null);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const handleSave = async (payload: Partial<Supplier>) => {
        if (editing) await updateSupplier(editing._id, payload);
        else await createSupplier(payload);
        successToast(editing ? "Proveedor actualizado" : "Proveedor creado");
        setModalOpen(false);
        setEditing(null);
        setRefreshKey((k) => k + 1);
    };

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Proveedores</h1>
                        <p>Gestiona la agenda de proveedores de compras y gastos</p>
                    </div>
                    <div className="purchases-actions">
                        <div className="search-box">
                            <i className="ri-search-line"></i>
                            <input type="text" placeholder="Buscar proveedor, NIT..." value={search} onChange={(e) => setSearch(e.target.value)} />
                        </div>
                        <button className="btn-primary" onClick={() => { setEditing(null); setModalOpen(true); }}>
                            <i className="ri-add-line"></i> Nuevo proveedor
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando proveedores...</div>
                ) : suppliers.length === 0 ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>No hay proveedores para mostrar</div>
                ) : (
                    <>
                        <div className="purchases-table-container">
                            <table className="purchases-table">
                                <thead>
                                    <tr>
                                        <th>Proveedor</th>
                                        <th>NIT / Documento</th>
                                        <th>Correo</th>
                                        <th>Teléfono</th>
                                        <th>Origen</th>
                                        <th>Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {suppliers.map((s) => (
                                        <tr key={s._id}>
                                            <td data-label="Proveedor">{s.name}</td>
                                            <td data-label="NIT / Documento">{s.doc_number}</td>
                                            <td data-label="Correo">{s.email || "—"}</td>
                                            <td data-label="Teléfono">{s.phone || "—"}</td>
                                            <td data-label="Origen">
                                                <span className={`status-badge ${s.source === "import" ? "status-pending" : "status-paid"}`}>
                                                    {s.source === "import" ? "Importado" : "Manual"}
                                                </span>
                                            </td>
                                            <td data-label="Acciones">
                                                <div className="action-buttons">
                                                    <button className="btn-icon" title="Editar" onClick={() => { setEditing(s); setModalOpen(true); }}>
                                                        <i className="ri-edit-line"></i>
                                                    </button>
                                                    <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: s._id, name: s.name })}>
                                                        <i className="ri-delete-bin-line"></i>
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
                                <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}>Anterior</button>
                                <span className="pagination__info">Página {page} de {totalPages}</span>
                                <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}>Siguiente</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            <SupplierModal
                isOpen={modalOpen}
                supplier={editing}
                onClose={() => { setModalOpen(false); setEditing(null); }}
                onSave={handleSave}
            />
            <ConfirmModal
                isOpen={!!toDelete}
                title="Eliminar proveedor"
                message={`¿Eliminar a "${toDelete?.name}"? Esta acción no se puede deshacer.`}
                confirmText="Eliminar"
                onClose={() => setToDelete(null)}
                onConfirm={handleDelete}
                loading={deleting}
            />
        </main>
    );
};

export default SuppliersPage;

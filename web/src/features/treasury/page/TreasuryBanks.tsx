import { useCallback, useEffect, useState } from "react";
import "../../purchases/page/Purchases.css";
import "../../purchases/components/PurchaseModals.css";
import { getBanks, createBank, updateBank, deleteBank } from "../treasury.service";
import type { Bank } from "../treasury.types";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useRealtime, applyRealtimeChange } from "../../../hooks/useRealtime";
import { RealtimeEvents } from "../../../services/socket";
import ConfirmModal from "../../../components/modals/ConfirmModal/ConfirmModal";

const empty = { nombre_banco: "", numero_cuenta: "", tipo_cuenta: "corriente", identificador: "6", validacion_id: "V", descripcion_lote: "PROVEEDOR" };

const TreasuryBanksPage: React.FC = () => {
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Bank | null>(null);
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);
    const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
    const [deleting, setDeleting] = useState(false);

    useRealtime(RealtimeEvents.BANK_CHANGED, (payload) => setBanks((prev) => applyRealtimeChange(prev, payload)));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await getBanks();
            setBanks(res.banks);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "Error al cargar bancos");
        } finally {
            setLoading(false);
        }
    }, [refreshKey]);

    useEffect(() => {
        load();
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        setForm(empty);
        setModalOpen(true);
    };
    const openEdit = (b: Bank) => {
        setEditing(b);
        setForm({
            nombre_banco: b.nombre_banco,
            numero_cuenta: b.numero_cuenta,
            tipo_cuenta: b.tipo_cuenta,
            identificador: b.identificador,
            validacion_id: b.validacion_id,
            descripcion_lote: b.descripcion_lote,
        });
        setModalOpen(true);
    };

    const save = async () => {
        if (!form.nombre_banco.trim() || !form.numero_cuenta.trim()) {
            errorToast("Banco y número de cuenta son obligatorios");
            return;
        }
        setSaving(true);
        try {
            if (editing) await updateBank(editing._id, form as Partial<Bank>);
            else await createBank(form as Partial<Bank>);
            successToast(editing ? "Banco actualizado" : "Banco creado");
            setModalOpen(false);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!toDelete) return;
        setDeleting(true);
        try {
            await deleteBank(toDelete.id);
            successToast("Banco eliminado");
            setToDelete(null);
            setRefreshKey((k) => k + 1);
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo eliminar");
        } finally {
            setDeleting(false);
        }
    };

    const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

    return (
        <main className="purchases-page">
            <div className="purchases-container">
                <div className="purchases-header">
                    <div className="header-content">
                        <h1>Bancos</h1>
                        <p>Cuentas bancarias de la empresa desde las que se paga a los proveedores</p>
                    </div>
                    <div className="purchases-actions">
                        <button className="btn-primary" onClick={openCreate}>
                            <i className="ri-add-line"></i> Nuevo banco
                        </button>
                    </div>
                </div>

                {loading ? (
                    <div className="page-loading" style={{ textAlign: "center", padding: 40 }}>Cargando bancos...</div>
                ) : banks.length === 0 ? (
                    <div className="purchases-empty">
                        <i className="ri-bank-card-line"></i>
                        <p>No hay bancos configurados. Agrega la cuenta desde la que pagarás a tus proveedores.</p>
                        <button className="btn-primary" onClick={openCreate}><i className="ri-add-line"></i> Nuevo banco</button>
                    </div>
                ) : (
                    <div className="purchases-table-container">
                        <table className="purchases-table">
                            <thead>
                                <tr><th>Banco</th><th>Cuenta</th><th>Tipo</th><th>Descripción lote</th><th>Estado</th><th>Acciones</th></tr>
                            </thead>
                            <tbody>
                                {banks.map((b) => (
                                    <tr key={b._id}>
                                        <td data-label="Banco">{b.nombre_banco}</td>
                                        <td data-label="Cuenta">{b.numero_cuenta}</td>
                                        <td data-label="Tipo">{b.tipo_cuenta === "ahorros" ? "Ahorros" : "Corriente"}</td>
                                        <td data-label="Descripción lote">{b.descripcion_lote}</td>
                                        <td data-label="Estado"><span className={`status-badge ${b.active ? "status-paid" : "status-pending"}`}>{b.active ? "Activo" : "Inactivo"}</span></td>
                                        <td data-label="Acciones">
                                            <div className="action-buttons">
                                                <button className="btn-icon" title="Editar" onClick={() => openEdit(b)}><i className="ri-edit-line"></i></button>
                                                <button className="btn-icon" title="Eliminar" onClick={() => setToDelete({ id: b._id, name: b.nombre_banco })}><i className="ri-delete-bin-line"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {modalOpen && (
                <div className="pm-overlay" onClick={() => !saving && setModalOpen(false)} role="presentation">
                    <div className="pm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                        <div className="pm-header">
                            <h3>{editing ? "Editar banco" : "Nuevo banco"}</h3>
                            <button className="pm-close" onClick={() => setModalOpen(false)} disabled={saving}><i className="ri-close-line" /></button>
                        </div>
                        <div className="pm-body">
                            <div className="pm-grid">
                                <div className="pm-field pm-col-2"><label>Banco *</label><input value={form.nombre_banco} onChange={(e) => set("nombre_banco", e.target.value)} placeholder="Bancolombia" /></div>
                                <div className="pm-field"><label>Número de cuenta *</label><input value={form.numero_cuenta} onChange={(e) => set("numero_cuenta", e.target.value)} /></div>
                                <div className="pm-field"><label>Tipo de cuenta</label>
                                    <select value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)}>
                                        <option value="corriente">Corriente</option>
                                        <option value="ahorros">Ahorros</option>
                                    </select>
                                </div>
                                <div className="pm-field"><label>Identificador (ACH)</label><input value={form.identificador} onChange={(e) => set("identificador", e.target.value)} /></div>
                                <div className="pm-field"><label>Validación (ACH)</label><input value={form.validacion_id} onChange={(e) => set("validacion_id", e.target.value)} /></div>
                                <div className="pm-field pm-col-2"><label>Descripción del lote</label><input value={form.descripcion_lote} onChange={(e) => set("descripcion_lote", e.target.value)} /></div>
                            </div>
                            <p className="pm-hint">Identificador, validación y descripción son campos del archivo plano del banco (ACH). Usa los valores por defecto si no estás seguro.</p>
                        </div>
                        <div className="pm-actions">
                            <button className="pm-cancel" onClick={() => setModalOpen(false)} disabled={saving}>Cancelar</button>
                            <button className="pm-submit" onClick={save} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                        </div>
                    </div>
                </div>
            )}

            <ConfirmModal isOpen={!!toDelete} title="Eliminar banco" message={`¿Eliminar "${toDelete?.name}"?`} confirmText="Eliminar" onClose={() => setToDelete(null)} onConfirm={handleDelete} loading={deleting} />
        </main>
    );
};

export default TreasuryBanksPage;

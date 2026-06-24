import { useEffect, useState } from "react";
import type { Supplier } from "../purchases.types";
import { errorToast } from "../../../components/shared/toast/toasts";
import "./PurchaseModals.css";

interface Props {
    isOpen: boolean;
    supplier: Supplier | null;
    onClose: () => void;
    onSave: (payload: Partial<Supplier>) => Promise<void>;
}

const empty = { name: "", doc_number: "", email: "", phone: "", address: "", banco: "", tipo_cuenta: "", numero_cuenta: "" };

const SupplierModal: React.FC<Props> = ({ isOpen, supplier, onClose, onSave }) => {
    const [form, setForm] = useState(empty);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!isOpen) return;
        if (supplier) {
            setForm({
                name: supplier.name ?? "",
                doc_number: supplier.doc_number ?? "",
                email: supplier.email ?? "",
                phone: supplier.phone ?? "",
                address: supplier.address?.value ?? "",
                banco: supplier.bank?.banco ?? "",
                tipo_cuenta: supplier.bank?.tipo_cuenta ?? "",
                numero_cuenta: supplier.bank?.numero_cuenta ?? "",
            });
        } else {
            setForm(empty);
        }
    }, [isOpen, supplier]);

    if (!isOpen) return null;

    const set = (k: keyof typeof empty, v: string) => setForm((f) => ({ ...f, [k]: v }));

    const submit = async () => {
        if (!form.name.trim() || !form.doc_number.trim()) {
            errorToast("Nombre y NIT/documento son obligatorios");
            return;
        }
        setSaving(true);
        try {
            await onSave({
                name: form.name.trim(),
                doc_number: form.doc_number.trim(),
                email: form.email.trim() || undefined,
                phone: form.phone.trim() || undefined,
                address: form.address.trim() ? { value: form.address.trim() } : undefined,
                bank: form.banco || form.numero_cuenta ? { banco: form.banco, tipo_cuenta: form.tipo_cuenta, numero_cuenta: form.numero_cuenta } : undefined,
            });
        } catch (e) {
            errorToast(e instanceof Error ? e.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="pm-overlay" onClick={() => !saving && onClose()} role="presentation">
            <div className="pm-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                <div className="pm-header">
                    <h3>{supplier ? "Editar proveedor" : "Nuevo proveedor"}</h3>
                    <button className="pm-close" onClick={onClose} disabled={saving} aria-label="Cerrar"><i className="ri-close-line" /></button>
                </div>
                <div className="pm-body">
                    <div className="pm-grid">
                        <div className="pm-field pm-col-2">
                            <label>Nombre / Razón social *</label>
                            <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Proveedor S.A.S" />
                        </div>
                        <div className="pm-field">
                            <label>NIT / Documento *</label>
                            <input value={form.doc_number} onChange={(e) => set("doc_number", e.target.value)} placeholder="900123456" />
                        </div>
                        <div className="pm-field">
                            <label>Teléfono</label>
                            <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                        </div>
                        <div className="pm-field pm-col-2">
                            <label>Correo</label>
                            <input value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="proveedor@correo.com" />
                        </div>
                        <div className="pm-field pm-col-2">
                            <label>Dirección</label>
                            <input value={form.address} onChange={(e) => set("address", e.target.value)} />
                        </div>
                        <div className="pm-field">
                            <label>Banco</label>
                            <input value={form.banco} onChange={(e) => set("banco", e.target.value)} placeholder="Bancolombia" />
                        </div>
                        <div className="pm-field">
                            <label>Tipo de cuenta</label>
                            <select value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)}>
                                <option value="">—</option>
                                <option value="ahorros">Ahorros</option>
                                <option value="corriente">Corriente</option>
                            </select>
                        </div>
                        <div className="pm-field pm-col-2">
                            <label>Número de cuenta</label>
                            <input value={form.numero_cuenta} onChange={(e) => set("numero_cuenta", e.target.value)} />
                        </div>
                    </div>
                    <p className="pm-hint">Los datos bancarios se usarán más adelante en el proceso de tesorería (pago a proveedores).</p>
                </div>
                <div className="pm-actions">
                    <button className="pm-cancel" onClick={onClose} disabled={saving}>Cancelar</button>
                    <button className="pm-submit" onClick={submit} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</button>
                </div>
            </div>
        </div>
    );
};

export default SupplierModal;

import { useEffect, useState } from "react";
import type { Supplier } from "../purchases.types";
import { errorToast } from "../../../components/shared/toast/toasts";
import { AppDrawer, FilterField, FieldControl } from "../../../components/design-system";
import { useBodyScrollLock } from "../../../hooks/useBodyScrollLock";
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
    const isEditMode = Boolean(supplier);

    useBodyScrollLock(isOpen);

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

    const submit = async (e?: React.FormEvent) => {
        e?.preventDefault();
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
        } catch (err) {
            errorToast(err instanceof Error ? err.message : "No se pudo guardar");
        } finally {
            setSaving(false);
        }
    };

    return (
        <AppDrawer
            title={isEditMode ? "Editar proveedor" : "Nuevo proveedor"}
            titleIcon={isEditMode ? "ri-edit-line" : "ri-store-2-line"}
            wide
            closeDisabled={saving}
            onClose={onClose}
            footer={
                <>
                    <button type="button" className="export-cancel" onClick={onClose} disabled={saving}>
                        Cancelar
                    </button>
                    <button type="submit" form="supplier-form" className="export-submit" disabled={saving}>
                        {saving ? (
                            <>
                                <i className="ri-loader-4-line rotating" aria-hidden />
                                Guardando…
                            </>
                        ) : (
                            "Guardar"
                        )}
                    </button>
                </>
            }
        >
            <form id="supplier-form" className="supplier-drawer-form" onSubmit={(e) => void submit(e)}>
                <div className="led-form-grid">
                    <FilterField className="led-form-grid__full" label="Nombre / Razón social *" htmlFor="supplier-name" icon="ri-building-line">
                        <FieldControl
                            id="supplier-name"
                            value={form.name}
                            onChange={(e) => set("name", e.target.value)}
                            placeholder="Proveedor S.A.S"
                            disabled={saving}
                            required
                        />
                    </FilterField>
                    <FilterField label="NIT / Documento *" htmlFor="supplier-doc" icon="ri-id-card-line">
                        <FieldControl
                            id="supplier-doc"
                            value={form.doc_number}
                            onChange={(e) => set("doc_number", e.target.value)}
                            placeholder="900123456"
                            disabled={saving}
                            required
                        />
                    </FilterField>
                    <FilterField label="Teléfono" htmlFor="supplier-phone" icon="ri-phone-line">
                        <FieldControl id="supplier-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} disabled={saving} />
                    </FilterField>
                    <FilterField label="Correo" htmlFor="supplier-email" icon="ri-mail-line">
                        <FieldControl
                            id="supplier-email"
                            type="email"
                            value={form.email}
                            onChange={(e) => set("email", e.target.value)}
                            placeholder="proveedor@correo.com"
                            disabled={saving}
                        />
                    </FilterField>
                    <FilterField className="led-form-grid__full" label="Dirección" htmlFor="supplier-address" icon="ri-map-pin-line">
                        <FieldControl id="supplier-address" value={form.address} onChange={(e) => set("address", e.target.value)} disabled={saving} />
                    </FilterField>
                    <FilterField label="Banco" htmlFor="supplier-bank" icon="ri-bank-line">
                        <FieldControl
                            id="supplier-bank"
                            value={form.banco}
                            onChange={(e) => set("banco", e.target.value)}
                            placeholder="Bancolombia"
                            disabled={saving}
                        />
                    </FilterField>
                    <FilterField label="Tipo de cuenta" htmlFor="supplier-account-type" icon="ri-wallet-3-line">
                        <FieldControl as="select" id="supplier-account-type" value={form.tipo_cuenta} onChange={(e) => set("tipo_cuenta", e.target.value)} disabled={saving}>
                            <option value="">—</option>
                            <option value="ahorros">Ahorros</option>
                            <option value="corriente">Corriente</option>
                        </FieldControl>
                    </FilterField>
                    <FilterField label="Número de cuenta" htmlFor="supplier-account-number" icon="ri-bank-card-line">
                        <FieldControl
                            id="supplier-account-number"
                            value={form.numero_cuenta}
                            onChange={(e) => set("numero_cuenta", e.target.value)}
                            disabled={saving}
                        />
                    </FilterField>
                </div>
                <p className="pm-hint" style={{ marginTop: "0.75rem" }}>
                    Los datos bancarios se usarán más adelante en el proceso de tesorería (pago a proveedores).
                </p>
            </form>
        </AppDrawer>
    );
};

export default SupplierModal;

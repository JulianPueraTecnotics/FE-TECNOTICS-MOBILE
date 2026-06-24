import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { createItem, updateItem, fetchItemsByCodes } from '../../../services/items.service';
import type { ItemData, CreateItemRequest } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import SearchableSelect, { type SearchableSelectOption } from '../../../components/shared/SearchableSelect';
import unidadesMedida from '../../../utils/unidades_medida.json';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useFormDraft, isFormDirty } from '../../../hooks/useFormDraft';
import UnsavedChangesModal from '../UnsavedChangesModal/UnsavedChangesModal';
import './ItemModal.css';

const CODE_DUPLICATE_DEBOUNCE_MS = 450;
const ITEM_DRAFT_KEY = 'tecnotics:draft:item-modal';

const createEmptyItemForm = (): CreateItemRequest => ({
  code: '',
  name: '',
  price: 0,
  cost_price: 0,
  quantity: 1,
  description: '',
  kind: 'product',
  taxes: {
    iva: 0,
    other: 0,
  },
  unidad_medida: '',
});

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  item?: ItemData | null;
}

const ItemModal: React.FC<ItemModalProps> = ({ isOpen, onClose, onSuccess, item }) => {
  const { user } = useContext(AuthContext);
  const isEditMode = !!item;
  const [loading, setLoading] = useState(false);
  const [codeDuplicate, setCodeDuplicate] = useState(false);
  const codeDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentCodeRef = useRef('');
  const [formData, setFormData] = useState<CreateItemRequest>(createEmptyItemForm);

  // Borrador en localStorage: solo en modo creación (en edición se cierra directo para no pisar el item).
  const draftEnabled = !isEditMode;
  const { loadDraft, saveDraft, clearDraft } = useFormDraft<CreateItemRequest>(ITEM_DRAFT_KEY, draftEnabled);
  const [showUnsaved, setShowUnsaved] = useState(false);

  const unidadesMedidaOptions: SearchableSelectOption[] = useMemo(
    () => unidadesMedida.map((u: { codigo: string; descripcion: string }) => ({ value: u.codigo, label: `${u.codigo} - ${u.descripcion}` })),
    []
  );

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (item) {
      setFormData({
        code: item.code || '',
        name: item.name,
        price: item.price,
        cost_price: item.cost_price ?? 0,
        quantity: item.quantity,
        description: item.description,
        kind: item.kind,
        taxes: {
          iva: item.taxes?.iva || 0,
          other: item.taxes?.other || 0,
        },
        unidad_medida: item.unidad_medida || '',
      });
    } else {
      // Al abrir en modo creación, restauramos el borrador guardado (si existe) o arrancamos vacío.
      setFormData(loadDraft() ?? createEmptyItemForm());
    }
  }, [item, isOpen, loadDraft]);

  currentCodeRef.current = formData.code ?? '';

  useEffect(() => {
    if (!isOpen) {
      if (codeDebounceRef.current) {
        clearTimeout(codeDebounceRef.current);
        codeDebounceRef.current = null;
      }
      setCodeDuplicate(false);
      return;
    }

    const trimmed = (formData.code ?? '').trim();
    if (!trimmed) {
      setCodeDuplicate(false);
      return;
    }

    if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    codeDebounceRef.current = setTimeout(async () => {
      codeDebounceRef.current = null;
      const codeChecked = trimmed;
      if (currentCodeRef.current.trim() !== codeChecked) return;

      try {
        const results = await fetchItemsByCodes([codeChecked]);
        if (currentCodeRef.current.trim() !== codeChecked) return;

        const editingId = item?._id;
        const conflict = results.some(
          (row) =>
            (row.code?.trim() ?? '') === codeChecked &&
            row._id !== editingId
        );
        setCodeDuplicate(conflict);
      } catch {
        if (currentCodeRef.current.trim() === codeChecked) {
          setCodeDuplicate(false);
        }
      }
    }, CODE_DUPLICATE_DEBOUNCE_MS);

    return () => {
      if (codeDebounceRef.current) clearTimeout(codeDebounceRef.current);
    };
  }, [formData.code, item?._id, isOpen]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    if (name === 'iva' || name === 'other') {
      setFormData((prev) => ({
        ...prev,
        taxes: {
          ...prev.taxes,
          [name]: parseFloat(value) || 0,
        },
      }));
    } else if (name === 'price' || name === 'quantity' || name === 'cost_price') {
      setFormData((prev) => ({
        ...prev,
        [name]: parseFloat(value) || 0,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formData.name || !formData.description) {
      toast.error('Nombre y descripción son requeridos');
      return;
    }

    if (formData.price <= 0) {
      toast.error('El precio debe ser mayor a 0');
      return;
    }

    if (formData.quantity <= 0) {
      toast.error('La cantidad debe ser mayor a 0');
      return;
    }

    const codeTrimmed = (formData.code ?? '').trim();
    if (codeTrimmed && codeDuplicate) {
      toast.error('Ese código ya existe. Usa otro código.');
      return;
    }

    setLoading(true);

    try {
      if (isEditMode && item?._id) {
        await updateItem(item._id, formData);
        toast.success('Item actualizado exitosamente');
      } else {
        await createItem({
          ...formData,
          executed_by: user?.razon_social,
        });
        toast.success('Item creado exitosamente');
      }
      clearDraft();
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar el item'
      );
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    const subtotal = formData.price * formData.quantity;
    const ivaAmount = (subtotal * formData.taxes.iva) / 100;
    const otherAmount = (subtotal * formData.taxes.other) / 100;
    return subtotal + ivaAmount + otherAmount;
  };

  // Intercepta el cierre: si en modo creación hay datos sin guardar, pregunta por el borrador.
  const requestClose = () => {
    if (loading) return;
    if (draftEnabled && isFormDirty(formData, createEmptyItemForm())) {
      setShowUnsaved(true);
      return;
    }
    onClose();
  };

  const handleSaveDraft = () => {
    saveDraft(formData);
    setShowUnsaved(false);
    onClose();
  };

  const handleDiscardDraft = () => {
    clearDraft();
    setShowUnsaved(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
    <div
      className="modal-overlay item-modal-drawer"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-modal-title"
    >
      <div className="modal-container item-modal-drawer-panel">
        <div className="modal-header">
          <h2 id="item-modal-title">{isEditMode ? 'Editar Item' : 'Crear Nuevo Item'}</h2>
          <button className="modal-close" onClick={requestClose} disabled={loading}>
            <i className="ri-close-line"></i>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-grid">
            {/* Tipo */}
            <div className="form-group">
              <label htmlFor="kind">Tipo *</label>
              <select
                id="kind"
                name="kind"
                value={formData.kind}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </select>
            </div>

            {/* Código */}
            <div className="form-group">
              <label htmlFor="code">Código</label>
              <input
                type="text"
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Ej: PROD-001"
                disabled={loading}
                aria-invalid={codeDuplicate}
                aria-describedby={codeDuplicate ? 'code-duplicate-hint' : undefined}
              />
              {codeDuplicate && (
                <p id="code-duplicate-hint" className="item-code-duplicate-hint" role="alert">
                  Este código ya existe. Debes usar otro.
                </p>
              )}
            </div>

            {/* Nombre */}
            <div className="form-group full-width">
              <label htmlFor="name">Nombre *</label>
              <input
                type="text"
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Nombre del producto o servicio"
                disabled={loading}
              />
            </div>

            {/* Descripción */}
            <div className="form-group full-width">
              <label htmlFor="description">Descripción *</label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                required
                placeholder="Descripción detallada"
                rows={3}
                disabled={loading}
              />
            </div>

            {/* Precio */}
            <div className="form-group">
              <label htmlFor="price">Precio Unitario *</label>
              <input
                type="number"
                id="price"
                name="price"
                value={formData.price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>

            {/* Costo unitario (solo productos): base del costo de ventas */}
            {formData.kind === 'product' && (
              <div className="form-group">
                <label htmlFor="cost_price">Costo unitario</label>
                <input
                  type="number"
                  id="cost_price"
                  name="cost_price"
                  value={formData.cost_price ?? 0}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={loading}
                  title="Costo del producto. Se usa para registrar el costo de ventas al facturar."
                />
              </div>
            )}

            {/* Cantidad */}
            <div className="form-group">
              <label htmlFor="quantity">Cantidad *</label>
              <input
                type="number"
                id="quantity"
                name="quantity"
                value={formData.quantity}
                onChange={handleInputChange}
                required
                min="1"
                step="1"
                placeholder="1"
                disabled={loading}
              />
            </div>

            {/* Unidad de medida */}
            <div className="form-group">
              <label htmlFor="unidad_medida">Unidad de medida</label>
              <SearchableSelect
                id="unidad_medida"
                options={unidadesMedidaOptions}
                value={formData.unidad_medida ?? ''}
                onChange={(value) => setFormData((prev) => ({ ...prev, unidad_medida: value }))}
                placeholder="Buscar unidad de medida..."
                disabled={loading}
                aria-label="Unidad de medida"
              />
            </div>

            {/* IVA */}
            <div className="form-group">
              <label htmlFor="iva">IVA (%) *</label>
              <select
                id="iva"
                name="iva"
                value={formData.taxes.iva}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="0">0% - Exento</option>
                <option value="5">5%</option>
                <option value="19">19%</option>
              </select>
            </div>

            {/* Otros Impuestos */}
            <div className="form-group">
              <label htmlFor="other">Otros Impuestos (%)</label>
              <input
                type="number"
                id="other"
                name="other"
                value={formData.taxes.other}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </div>
          </div>

          {/* Total Preview */}
          <div className="total-preview">
            <div className="total-row">
              <span>Subtotal:</span>
              <strong>${(formData.price * formData.quantity).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
            </div>
            <div className="total-row">
              <span>IVA ({formData.taxes.iva}%):</span>
              <strong>${((formData.price * formData.quantity * formData.taxes.iva) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
            </div>
            {formData.taxes.other > 0 && (
              <div className="total-row">
                <span>Otros ({formData.taxes.other}%):</span>
                <strong>${((formData.price * formData.quantity * formData.taxes.other) / 100).toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
              </div>
            )}
            <div className="total-row total-final">
              <span>Total:</span>
              <strong>${calculateTotal().toLocaleString('es-CO', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn-secondary"
              onClick={requestClose}
              disabled={loading}
            >
              Cancelar
            </button>
            <button type="submit" className="btn-primary" disabled={loading || codeDuplicate}>
              {loading ? (
                <>
                  <i className="ri-loader-4-line rotating"></i>
                  {isEditMode ? 'Actualizando...' : 'Creando...'}
                </>
              ) : (
                isEditMode ? 'Actualizar' : 'Crear'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
    <UnsavedChangesModal
      isOpen={showUnsaved}
      onSaveDraft={handleSaveDraft}
      onDiscard={handleDiscardDraft}
      onKeepEditing={() => setShowUnsaved(false)}
    />
    </>
  );
};

export default ItemModal;


import React, { useState, useEffect, useContext, useMemo, useRef } from 'react';
import toast from 'react-hot-toast';
import { createItem, updateItem, fetchItemsByCodes } from '../../../services/items.service';
import type { ItemData, CreateItemRequest } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import SearchableSelect, { type SearchableSelectOption } from '../../../components/shared/SearchableSelect';
import unidadesMedida from '../../../utils/unidades_medida.json';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useFormDraft, isFormDirty } from '../../../hooks/useFormDraft';
import { AppDrawer, FilterField, FieldControl } from '../../../components/design-system';
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
  controla_inventario: false,
  costeo: 'promedio',
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
        controla_inventario: item.controla_inventario ?? false,
        costeo: item.costeo ?? 'promedio',
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

  const titleId = 'item-modal-title';

  return (
    <>
    <AppDrawer
      title={isEditMode ? 'Editar item' : 'Crear nuevo item'}
      titleIcon={isEditMode ? 'ri-edit-line' : 'ri-add-box-line'}
      wide
      closeDisabled={loading}
      onClose={requestClose}
      ariaLabelledBy={titleId}
      footer={
        <>
          <button type="button" className="export-cancel" onClick={requestClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="item-form" className="export-submit" disabled={loading || codeDuplicate}>
            {loading ? (
              <>
                <i className="ri-loader-4-line rotating" aria-hidden />
                {isEditMode ? 'Actualizando…' : 'Creando…'}
              </>
            ) : (
              isEditMode ? 'Actualizar' : 'Crear'
            )}
          </button>
        </>
      }
    >
        <form id="item-form" onSubmit={handleSubmit} className="item-modal-form">
          <div className="led-form-grid">
            <FilterField label="Tipo *" htmlFor="kind" icon="ri-price-tag-3-line">
              <FieldControl
                id="kind"
                name="kind"
                as="select"
                value={formData.kind}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="product">Producto</option>
                <option value="service">Servicio</option>
              </FieldControl>
            </FilterField>
            <FilterField
              label="Código"
              htmlFor="code"
              icon="ri-barcode-line"
              hint={
                codeDuplicate ? (
                  <span id="code-duplicate-hint" className="ds-field-hint" role="alert">
                    Este código ya existe. Debes usar otro.
                  </span>
                ) : undefined
              }
            >
              <FieldControl
                id="code"
                name="code"
                value={formData.code}
                onChange={handleInputChange}
                placeholder="Ej: PROD-001"
                disabled={loading}
                aria-invalid={codeDuplicate}
                aria-describedby={codeDuplicate ? 'code-duplicate-hint' : undefined}
              />
            </FilterField>
            <FilterField className="led-form-grid__full" label="Nombre *" htmlFor="name" icon="ri-box-3-line">
              <FieldControl
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="Nombre del producto o servicio"
                disabled={loading}
              />
            </FilterField>
            <FilterField className="led-form-grid__full" label="Descripción *" htmlFor="description" icon="ri-file-text-line">
              <FieldControl
                id="description"
                name="description"
                as="textarea"
                value={formData.description}
                onChange={handleInputChange}
                required
                placeholder="Descripción detallada"
                rows={3}
                disabled={loading}
              />
            </FilterField>
            <FilterField label="Precio Unitario *" htmlFor="price" icon="ri-money-dollar-circle-line">
              <FieldControl
                id="price"
                name="price"
                type="number"
                value={formData.price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </FilterField>
            {formData.kind === 'product' && (
              <FilterField
                label="Costo unitario"
                htmlFor="cost_price"
                icon="ri-money-dollar-box-line"
                hint={
                  <span className="ds-field-hint">
                    Costo del producto. Se usa para registrar el costo de ventas al facturar.
                  </span>
                }
              >
                <FieldControl
                  id="cost_price"
                  name="cost_price"
                  type="number"
                  value={formData.cost_price ?? 0}
                  onChange={handleInputChange}
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  disabled={loading}
                />
              </FilterField>
            )}
            {formData.kind === 'product' && (
              <div className="checkbox-row">
                <input
                  type="checkbox"
                  id="controla_inventario"
                  name="controla_inventario"
                  checked={!!formData.controla_inventario}
                  onChange={(e) => setFormData((prev) => ({ ...prev, controla_inventario: e.target.checked }))}
                  disabled={loading}
                />
                <label htmlFor="controla_inventario">Controla existencias (kardex y costo de ventas real)</label>
              </div>
            )}
            {formData.kind === 'product' && formData.controla_inventario && (
              <FilterField label="Método de costeo" htmlFor="costeo" icon="ri-calculator-line">
                <FieldControl
                  id="costeo"
                  name="costeo"
                  as="select"
                  value={formData.costeo ?? 'promedio'}
                  onChange={(e) => setFormData((prev) => ({ ...prev, costeo: e.target.value as 'promedio' | 'peps' | 'estandar' }))}
                  disabled={loading}
                >
                  <option value="promedio">Promedio ponderado</option>
                  <option value="peps">PEPS</option>
                  <option value="estandar">Costo estándar</option>
                </FieldControl>
              </FilterField>
            )}
            <FilterField label="Cantidad *" htmlFor="quantity" icon="ri-hashtag">
              <FieldControl
                id="quantity"
                name="quantity"
                type="number"
                value={formData.quantity}
                onChange={handleInputChange}
                required
                min="1"
                step="1"
                placeholder="1"
                disabled={loading}
              />
            </FilterField>
            <FilterField label="Unidad de medida" htmlFor="unidad_medida" icon="ri-ruler-line">
              <SearchableSelect
                id="unidad_medida"
                embedded
                options={unidadesMedidaOptions}
                value={formData.unidad_medida ?? ''}
                onChange={(value) => setFormData((prev) => ({ ...prev, unidad_medida: value }))}
                placeholder="Buscar unidad de medida..."
                disabled={loading}
                aria-label="Unidad de medida"
                displayValueOnly
              />
            </FilterField>
            <FilterField label="IVA (%) *" htmlFor="iva" icon="ri-percent-line">
              <FieldControl
                id="iva"
                name="iva"
                as="select"
                value={formData.taxes.iva}
                onChange={handleInputChange}
                required
                disabled={loading}
              >
                <option value="0">0% - Exento</option>
                <option value="5">5%</option>
                <option value="19">19%</option>
              </FieldControl>
            </FilterField>
            <FilterField label="Otros Impuestos (%)" htmlFor="other" icon="ri-percent-line">
              <FieldControl
                id="other"
                name="other"
                type="number"
                value={formData.taxes.other}
                onChange={handleInputChange}
                min="0"
                max="100"
                step="0.01"
                placeholder="0.00"
                disabled={loading}
              />
            </FilterField>
          </div>

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
        </form>
    </AppDrawer>
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


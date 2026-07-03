import React, { useState, useEffect, useMemo, useContext, useRef, useCallback } from 'react';
import toast from 'react-hot-toast';
import { createClient, updateClient, findDian, type FindDianResponse } from '../../../services/clients.service';
import type { IExternUser, CreateClientRequest, TipoPersona } from '../../../types';
import { AuthContext } from '../../../store/auth.context';
import SearchableSelect, { type SearchableSelectOption } from '../../../components/shared/SearchableSelect';
import departamentos from '../../../utils/departamentos.json';
import municipios from '../../../utils/municipios.json';
import paises from '../../../utils/paises.json';
import { useBodyScrollLock } from '../../../hooks/useBodyScrollLock';
import { useFormDraft, isFormDirty } from '../../../hooks/useFormDraft';
import { AppDrawer, FilterField, FieldControl } from '../../../components/design-system';
import UnsavedChangesModal from '../UnsavedChangesModal/UnsavedChangesModal';
import './ClientModal.css';

const CLIENT_DRAFT_KEY = 'tecnotics:draft:client-modal';

const defaultAddress = {
  value: '',
  ciudad_codigo: '',
  departamento_codigo: '',
  pais_codigo: '',
  zip_code: '',
};

const createEmptyClientForm = (): CreateClientRequest => ({
  name: '',
  email: '',
  phone: '',
  doc_type: 'Cc',
  doc_number: '',
  address: { ...defaultAddress },
  tipoPersona: '2' as TipoPersona,
});

interface ClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  client?: IExternUser | null;
}

function getAddressFromClient(address: IExternUser['address']): typeof defaultAddress {
  if (address == null) return { ...defaultAddress };
  if (typeof address === 'string') {
    return { ...defaultAddress, value: address };
  }
  const o = address as { value?: string; ciudad_codigo?: string; departamento_codigo?: string; pais_codigo?: string; zip_code?: string };
  return {
    value: o.value ?? '',
    ciudad_codigo: o.ciudad_codigo ?? '',
    departamento_codigo: o.departamento_codigo ?? '',
    pais_codigo: o.pais_codigo ?? '',
    zip_code: o.zip_code ?? '',
  };
}

const DIAN_DEBOUNCE_MS = 400;
const NIT_MIN_DIGITS = 9;
const JURIDICA_PREFIXES = new Set(['8', '9']);

const inferTipoPersonaFromDocNumber = (docNumber: string): TipoPersona => {
  const firstDigit = docNumber.trim().charAt(0);
  return JURIDICA_PREFIXES.has(firstDigit) ? ('1' as TipoPersona) : ('2' as TipoPersona);
};

const sanitizeNumericInput = (value: string) => value.replace(/\D/g, '');

const sanitizeDocNumberInput = (value: string, docType: string) => {
  const raw = value.replace(/\s/g, '');
  if (docType === 'Nit') {
    const withoutInvalidChars = raw.replace(/[^\d-]/g, '');
    const parts = withoutInvalidChars.split('-');
    if (parts.length === 1) return parts[0];
    const main = parts[0].replace(/\D/g, '');
    const dv = parts.slice(1).join('').replace(/\D/g, '').slice(0, 1);
    return dv ? `${main}-${dv}` : main;
  }
  return sanitizeNumericInput(raw);
};

const ClientModal: React.FC<ClientModalProps> = ({ isOpen, onClose, onSuccess, client }) => {
  const { user } = useContext(AuthContext);
  const isEditMode = !!client;
  const [loading, setLoading] = useState(false);
  const [dianSearching, setDianSearching] = useState(false);
  const [dianResult, setDianResult] = useState<FindDianResponse | null>(null);
  const [docTypeManuallyChanged, setDocTypeManuallyChanged] = useState(false);
  const dianDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentDocNumberRef = useRef<string>('');
  const [formData, setFormData] = useState<CreateClientRequest>(createEmptyClientForm);

  // Borrador en localStorage: solo en modo creación (en edición se cierra directo para no pisar el cliente).
  const draftEnabled = !isEditMode;
  const { loadDraft, saveDraft, clearDraft } = useFormDraft<CreateClientRequest>(CLIENT_DRAFT_KEY, draftEnabled);
  const [showUnsaved, setShowUnsaved] = useState(false);

  const paisesOptions: SearchableSelectOption[] = useMemo(
    () => paises.map((p) => ({ value: p.codigo, label: p.descripcion })),
    []
  );
  const departamentosOptions: SearchableSelectOption[] = useMemo(
    () => departamentos.map((d) => ({ value: d.codigo, label: d.nombre })),
    []
  );
  const municipiosOptions: SearchableSelectOption[] = useMemo(() => {
    const dept = formData.address.departamento_codigo;
    if (!dept) return [];
    return municipios
      .filter((m) => m.code.startsWith(dept))
      .map((m) => ({ value: m.code, label: m.name }));
  }, [formData.address.departamento_codigo]);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    if (client) {
      setDocTypeManuallyChanged(false);
      setFormData({
        name: client.name,
        email: client.email,
        phone: client.phone,
        doc_type: client.doc_type,
        doc_number: client.doc_number,
        address: getAddressFromClient(client.address),
        tipoPersona: client.tipoPersona as TipoPersona,
      });
      setDianResult(null);
    } else {
      setDocTypeManuallyChanged(false);
      // Al abrir en modo creación, restauramos el borrador guardado (si existe) o arrancamos vacío.
      setFormData(loadDraft() ?? createEmptyClientForm());
      setDianResult(null);
    }
  }, [client, isOpen, loadDraft]);

  currentDocNumberRef.current = formData.doc_number;

  // Búsqueda DIAN al escribir (solo creación, con debounce). Envía smaid según tipo de documento.
  useEffect(() => {
    if (isEditMode || !formData.doc_number.trim()) {
      setDianResult(null);
      return;
    }
    const raw = formData.doc_number.replace(/\s/g, '');
    const digitsOnly = raw.replace(/-/g, '');
    if (digitsOnly.length < NIT_MIN_DIGITS || !/^\d+(-?\d*)?$/.test(raw)) {
      setDianResult(null);
      return;
    }
    if (dianDebounceRef.current) clearTimeout(dianDebounceRef.current);
    dianDebounceRef.current = setTimeout(async () => {
      dianDebounceRef.current = null;
      const nitToSearch = raw;
      const docType = formData.doc_type;
      setDianSearching(true);
      setDianResult(null);
      try {
        const res = await findDian(nitToSearch, docType);
        const currentRaw = currentDocNumberRef.current.replace(/\s/g, '');
        if (currentRaw === nitToSearch && res && (res.ReceiverName || res.ReceiverEmail)) {
          setDianResult(res);
        }
      } catch {
        setDianResult(null);
      } finally {
        setDianSearching(false);
      }
    }, DIAN_DEBOUNCE_MS);
    return () => {
      if (dianDebounceRef.current) clearTimeout(dianDebounceRef.current);
    };
  }, [formData.doc_number, formData.doc_type, isEditMode]);

  const applyDianResult = useCallback(() => {
    if (!dianResult) return;
    setFormData((prev) => ({
      ...prev,
      doc_number: prev.doc_number.replace(/\s/g, ''),
      name: dianResult.ReceiverName || prev.name,
      email: dianResult.ReceiverEmail || prev.email,
      doc_type: 'Nit',
      tipoPersona: '1' as TipoPersona,
    }));
    setDianResult(null);
  }, [dianResult]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === 'address_value') {
      setFormData((prev) => ({
        ...prev,
        address: { ...prev.address, value },
      }));
      return;
    }
    if (name === 'doc_type') {
      setDocTypeManuallyChanged(true);
      setFormData((prev) => ({
        ...prev,
        doc_type: value,
      }));
      return;
    }
    if (name === 'doc_number') {
      const sanitizedDocNumber = sanitizeDocNumberInput(value, formData.doc_type);
      const inferredTipoPersona = inferTipoPersonaFromDocNumber(sanitizedDocNumber.replace(/-/g, ''));
      const shouldSuggestNit = !isEditMode && !docTypeManuallyChanged && inferredTipoPersona === '1';
      setFormData((prev) => ({
        ...prev,
        doc_number: sanitizedDocNumber,
        tipoPersona: inferredTipoPersona,
        doc_type: shouldSuggestNit ? 'Nit' : prev.doc_type,
      }));
      return;
    }
    if (name === 'phone') {
      setFormData((prev) => ({
        ...prev,
        phone: value,
      }));
      return;
    }
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleAddressCodeChange = (field: 'pais_codigo' | 'departamento_codigo' | 'ciudad_codigo') => (code: string) => {
    setFormData((prev) => {
      const next = { ...prev, address: { ...prev.address, [field]: code } };
      if (field === 'departamento_codigo') next.address.ciudad_codigo = '';
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones
    if (!formData.name || !formData.email || !formData.phone || !formData.doc_number) {
      toast.error('Todos los campos marcados con * son requeridos');
      return;
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      toast.error('El email no es válido');
      return;
    }

    // Validar NIT si es persona jurídica (el back calcula el dígito de verificación)
    if (formData.doc_type === 'Nit') {
      const nitRegex = /^\d{9,10}(-\d)?$/;
      if (!nitRegex.test(formData.doc_number.replace(/\s/g, ''))) {
        toast.error('El NIT debe tener 9 o 10 dígitos (opcional: dígito de verificación, ej: 900123456-7)');
        return;
      }
    }

    setLoading(true);

    try {
      if (isEditMode && client) {
        await updateClient(client._id, {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: {
            value: formData.address.value,
            ciudad_codigo: formData.address.ciudad_codigo,
            departamento_codigo: formData.address.departamento_codigo,
            pais_codigo: formData.address.pais_codigo,
            zip_code: formData.address.zip_code,
          },
        });
        toast.success('Cliente actualizado exitosamente');
      } else {
        await createClient({
          ...formData,
          executed_by: user?.razon_social,
        });
        toast.success('Cliente creado exitosamente');
      }
      clearDraft();
      onSuccess();
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Error al guardar el cliente'
      );
    } finally {
      setLoading(false);
    }
  };

  // Intercepta el cierre: si en modo creación hay datos sin guardar, pregunta por el borrador.
  const requestClose = () => {
    if (loading) return;
    if (draftEnabled && isFormDirty(formData, createEmptyClientForm())) {
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

  const titleId = 'client-modal-title';

  return (
    <>
    <AppDrawer
      title={isEditMode ? 'Editar Cliente' : 'Crear Nuevo Cliente'}
      titleIcon={isEditMode ? 'ri-edit-line' : 'ri-user-add-line'}
      wide
      closeDisabled={loading}
      onClose={requestClose}
      ariaLabelledBy={titleId}
      footer={
        <>
          <button type="button" className="export-cancel" onClick={requestClose} disabled={loading}>
            Cancelar
          </button>
          <button type="submit" form="client-form" className="export-submit" disabled={loading}>
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
        <form id="client-form" onSubmit={handleSubmit} className="client-modal-form">
          <div className="led-form-grid">
            <FilterField label="Tipo de Documento *" htmlFor="doc_type" icon="ri-id-card-line">
              <FieldControl
                id="doc_type"
                name="doc_type"
                as="select"
                value={formData.doc_type}
                onChange={handleInputChange}
                required
                disabled={loading || isEditMode}
              >
                <option value="Nit">NIT</option>
                <option value="Cc">Cédula de Ciudadanía</option>
                <option value="Ce">Cédula de Extranjería</option>
                <option value="Ti">Tarjeta de Identidad</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Nuip">NUIP</option>
                <option value="Rc">Registro Civil</option>
                <option value="Te">Tarjeta de Extranjería</option>
                <option value="Psp">Psp</option>
                <option value="DiExtranjero">Documento Identidad Extranjero</option>
                <option value="Pep">PEP</option>
                <option value="NitExtranjero">NIT Extranjero</option>
              </FieldControl>
            </FilterField>
            <FilterField
              label="Número de Documento *"
              htmlFor="doc_number"
              icon="ri-barcode-line"
              hint={
                !isEditMode && dianSearching ? (
                  <span className="ds-field-hint">
                    <i className="ri-loader-4-line rotating" aria-hidden /> Buscando en la DIAN...
                  </span>
                ) : undefined
              }
            >
              <FieldControl
                type="text"
                id="doc_number"
                name="doc_number"
                value={formData.doc_number}
                onChange={handleInputChange}
                required
                placeholder={formData.doc_type === 'Nit' ? '900123456-7' : '1234567890'}
                disabled={loading || isEditMode}
                autoComplete="off"
                inputMode="numeric"
              />
            </FilterField>
          </div>

          {!isEditMode && dianResult && (dianResult.ReceiverName || dianResult.ReceiverEmail) && (
            <div className="dian-result-card">
              <p className="dian-result-title">Encontrado en la DIAN</p>
              <p className="dian-result-info">
                {dianResult.ReceiverName && <span>{dianResult.ReceiverName}</span>}
                {dianResult.ReceiverEmail && (
                  <span className="dian-result-email">{dianResult.ReceiverEmail}</span>
                )}
              </p>
              <button
                type="button"
                className="btn-dian-apply"
                onClick={applyDianResult}
                disabled={loading}
              >
                <i className="ri-check-line"></i> Usar estos datos (persona jurídica)
              </button>
            </div>
          )}

          <div className="led-form-grid">
            <FilterField
              className="led-form-grid__full"
              label={formData.tipoPersona === '1' ? 'Razón Social *' : 'Nombre Completo *'}
              htmlFor="name"
              icon={formData.tipoPersona === '1' ? 'ri-building-line' : 'ri-user-line'}
            >
              <FieldControl
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder={formData.tipoPersona === '1' ? 'EMPRESA SAS' : 'Juan Pérez'}
                disabled={loading}
              />
            </FilterField>
            <FilterField label="Correo Electrónico *" htmlFor="email" icon="ri-mail-line">
              <FieldControl
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="correo@ejemplo.com"
                disabled={loading}
                inputMode="email"
                autoComplete="email"
              />
            </FilterField>
            <FilterField label="Teléfono *" htmlFor="phone" icon="ri-phone-line">
              <FieldControl
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder="+573001234567"
                disabled={loading}
                inputMode="numeric"
              />
            </FilterField>
            <FilterField className="led-form-grid__full" label="Dirección (descripción)" htmlFor="address_value" icon="ri-map-pin-line">
              <FieldControl
                id="address_value"
                name="address_value"
                value={formData.address.value}
                onChange={handleInputChange}
                placeholder="Calle 123 #45-67"
                disabled={loading}
              />
            </FilterField>
            <FilterField label="País" htmlFor="address_pais" icon="ri-global-line">
              <SearchableSelect
                id="address_pais"
                embedded
                options={paisesOptions}
                value={formData.address.pais_codigo}
                onChange={handleAddressCodeChange('pais_codigo')}
                placeholder="Buscar país..."
                disabled={loading}
                aria-label="País"
              />
            </FilterField>
            <FilterField label="Departamento" htmlFor="address_departamento" icon="ri-map-2-line">
              <SearchableSelect
                id="address_departamento"
                embedded
                options={departamentosOptions}
                value={formData.address.departamento_codigo}
                onChange={handleAddressCodeChange('departamento_codigo')}
                placeholder="Buscar departamento..."
                disabled={loading}
                aria-label="Departamento"
              />
            </FilterField>
            <FilterField label="Ciudad / Municipio" htmlFor="address_ciudad" icon="ri-building-2-line">
              <SearchableSelect
                id="address_ciudad"
                embedded
                options={municipiosOptions}
                value={formData.address.ciudad_codigo}
                onChange={handleAddressCodeChange('ciudad_codigo')}
                placeholder="Buscar ciudad..."
                disabled={loading || !formData.address.departamento_codigo}
                aria-label="Ciudad o municipio"
              />
            </FilterField>
            <FilterField label="Código Postal" htmlFor="address_zip_code" icon="ri-mail-send-line">
              <FieldControl
                id="address_zip_code"
                name="address_zip_code"
                value={formData.address.zip_code}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    address: { ...prev.address, zip_code: e.target.value },
                  }))
                }
                placeholder="Ej: 110111"
                disabled={loading}
                inputMode="numeric"
              />
            </FilterField>
          </div>

          {isEditMode && (
            <div className="info-box">
              <i className="ri-information-line"></i>
              <p>
                El tipo de documento y número de documento no se pueden modificar una vez creado el cliente.
              </p>
            </div>
          )}
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

export default ClientModal;


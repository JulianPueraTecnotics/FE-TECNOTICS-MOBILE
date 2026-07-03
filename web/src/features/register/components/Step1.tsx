import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { signupStep1 } from '../../../services/register.service';
import type { SignupStep1Request } from '../../../types';
import departamentos from '../../../utils/departamentos.json';
import municipios from '../../../utils/municipios.json';
import paises from '../../../utils/paises.json';
import './Step1.css';
import { FilterField, FieldControl } from '../../../components/design-system';

interface Step1Props {
  onComplete: (companyId: string, email: string, razonSocial: string) => void;
  onBackToLogin: () => void;
}

const Step1: React.FC<Step1Props> = ({ onComplete, onBackToLogin }) => {
  const [loading, setLoading] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SignupStep1Request>({
    razon_social: '',
    doc_type: 'Nit',
    doc_number: '',
    email: '',
    password: '',
    phone: '',
    website: '',
    address: '',
    ciudad_codigo: '',
    departamento_codigo: '',
    pais_codigo: '169',
    zip_code: '',
    legal_representative: {
      name: '',
      doc_type: 'Cc',
      doc_number: '',
    },
  });

  const validateField = (name: string, value: string) => {
    let error = '';
    switch (name) {
      case 'email':
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = 'Correo electrónico inválido';
        }
        break;
      case 'password':
        if (value.length < 8) {
          error = 'La contraseña debe tener al menos 8 caracteres';
        }
        break;
      case 'phone':
        if (!/^\d+$/.test(value)) {
          error = 'El teléfono solo debe contener números';
        }
        break;
      case 'doc_number':
      case 'legal_representative_doc_number':
        if (!/^\d+$/.test(value)) {
          error = 'El número de documento solo debe contener números';
        }
        break;
    }
    return error;
  };

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;

    // Validación específica para teléfono (solo números)
    if (name === 'phone' && value && !/^\d*$/.test(value)) {
      return;
    }

    let newErrors = { ...errors };
    const error = validateField(name, value);
    if (error) {
      newErrors[name] = error;
    } else {
      delete newErrors[name];
    }

    // Manejar campos de legal_representative
    if (name.startsWith('legal_representative_')) {
      const field = name.replace('legal_representative_', '') as 'name' | 'doc_type' | 'doc_number';

      // Validar campos anidados
      const nestedError = validateField(`legal_representative_${field}`, value);
      if (nestedError) {
        newErrors[name] = nestedError;
      } else {
        delete newErrors[name];
      }

      setFormData((prev) => ({
        ...prev,
        legal_representative: {
          ...prev.legal_representative,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
    setErrors(newErrors);
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      if (!['image/png', 'image/jpg', 'image/jpeg', 'image/webp'].includes(file.type)) {
        toast.error('Solo se permiten imágenes PNG, JPG, JPEG o WebP');
        return;
      }

      // Validar tamaño (5MB máximo)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('El logo no debe superar los 5MB');
        return;
      }

      setLogoFile(file);
      const newErrors = { ...errors };
      delete newErrors['logo'];
      setErrors(newErrors);

      // Crear preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('Formulario enviado:', formData);
    console.log('Logo file:', logoFile);
    console.log('Logo preview:', logoPreview);

    // Validar formulario completo antes de enviar
    const newErrors: Record<string, string> = {};
    if (!formData.razon_social) newErrors.razon_social = 'Requerido';
    if (!formData.doc_number) newErrors.doc_number = 'Requerido';
    if (!formData.email) newErrors.email = 'Requerido';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Correo inválido';
    if (!formData.password) newErrors.password = 'Requerido';
    else if (formData.password.length < 8) newErrors.password = 'Mínimo 8 caracteres';
    if (!formData.phone) newErrors.phone = 'Requerido';
    if (!formData.address) newErrors.address = 'Requerido';
    if (!formData.pais_codigo) newErrors.pais_codigo = 'Requerido';
    if (!formData.departamento_codigo) newErrors.departamento_codigo = 'Requerido';
    if (!formData.ciudad_codigo) newErrors.ciudad_codigo = 'Requerido';
    if (!formData.legal_representative.name) newErrors.legal_representative_name = 'Requerido';
    if (!formData.legal_representative.doc_number) newErrors.legal_representative_doc_number = 'Requerido';

    if (!logoFile) {
      console.log('❌ Logo no está presente, abortando...');
      toast.error('El logo es requerido');
      newErrors.logo = 'El logo es requerido';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error('Por favor corrige los errores antes de continuar');
      return;
    }

    console.log('✅ Logo presente, continuando...');
    setLoading(true);

    try {
      console.log('Enviando a la API...');
      const response = await signupStep1(formData, logoFile!);
      console.log('Respuesta de la API:', response);
      toast.success(`¡Empresa registrada! Se ha enviado un código de verificación a ${response.data.email}`);
      onComplete(response.data.company_id, response.data.email, response.data.razon_social);
    } catch (error) {
      console.error('Error en Step1:', error);
      toast.error(error instanceof Error ? error.message : 'Error al registrar la empresa');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="step1-container">
      <form onSubmit={handleSubmit} className="step1-form">
        {/* Logo Upload */}
        <div className="form-section">
          <h3>Logo de la Empresa</h3>
          <div className="logo-upload">
            <div className="logo-preview">
              {logoPreview ? (
                <img src={logoPreview} alt="Logo preview" />
              ) : (
                <div className="logo-placeholder">
                  <i className="ri-image-add-line"></i>
                  <p>Haz clic para subir el logo</p>
                </div>
              )}
            </div>
            <input
              type="file"
              id="logo"
              accept="image/png,image/jpg,image/jpeg,image/webp"
              onChange={handleLogoChange}
              className="logo-input"
            />
            <label htmlFor="logo" className="logo-label">
              <i className="ri-upload-cloud-line"></i>
              {logoFile ? 'Cambiar Logo' : 'Seleccionar Logo'}
            </label>
            <p className="logo-hint">PNG, JPG, JPEG o WebP - Máx 5MB</p>
            {errors.logo && <span className="error-text">{errors.logo}</span>}
          </div>
        </div>

        {/* Información de la Empresa */}
        <div className="form-section">
          <h3>Información de la Empresa</h3>
          <div className="led-form-grid">
            <FilterField
              label="Razón Social *"
              htmlFor="razon_social"
              icon="ri-building-line"
              hint={errors.razon_social ? <span className="error-text">{errors.razon_social}</span> : undefined}
            >
              <FieldControl
                type="text"
                id="razon_social"
                name="razon_social"
                value={formData.razon_social}
                onChange={handleInputChange}
                required
                placeholder="Ej: TECNOTICS SAS"
                className={errors.razon_social ? "input-error" : ""}
              />
            </FilterField>

            <FilterField label="Tipo de Documento *" htmlFor="doc_type" icon="ri-id-card-line">
              <FieldControl id="doc_type" name="doc_type" as="select" value={formData.doc_type} onChange={handleInputChange} required>
                <option value="Nit">NIT</option>
                <option value="Cc">Cédula de Ciudadanía</option>
                <option value="Ce">Cédula de Extranjería</option>
                <option value="Pasaporte">Pasaporte</option>
              </FieldControl>
            </FilterField>

            <FilterField
              label="Número de Documento * (sin digito de verificación)"
              htmlFor="doc_number"
              icon="ri-hashtag"
              hint={errors.doc_number ? <span className="error-text">{errors.doc_number}</span> : undefined}
            >
              <FieldControl
                type="text"
                id="doc_number"
                name="doc_number"
                value={formData.doc_number}
                onChange={handleInputChange}
                required
                placeholder={formData.doc_type === "Nit" ? "900123456" : "1234567890"}
                className={errors.doc_number ? "input-error" : ""}
              />
            </FilterField>

            <FilterField
              label="Correo Electrónico *"
              htmlFor="email"
              icon="ri-mail-line"
              hint={errors.email ? <span className="error-text">{errors.email}</span> : undefined}
            >
              <FieldControl
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                placeholder="admin@empresa.com"
                className={errors.email ? "input-error" : ""}
              />
            </FilterField>

            <FilterField
              label="Contraseña *"
              htmlFor="password"
              icon="ri-lock-line"
              hint={errors.password ? <span className="error-text">{errors.password}</span> : undefined}
            >
              <div className="step1-password-wrap">
                <FieldControl
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  className={errors.password ? "input-error" : ""}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex={-1}
                >
                  <i className={showPassword ? "ri-eye-off-line" : "ri-eye-line"}></i>
                </button>
              </div>
            </FilterField>

            <FilterField
              label="Teléfono *"
              htmlFor="phone"
              icon="ri-phone-line"
              hint={errors.phone ? <span className="error-text">{errors.phone}</span> : undefined}
            >
              <FieldControl
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                placeholder="3001234567"
                className={errors.phone ? "input-error" : ""}
              />
            </FilterField>

            <FilterField label="Sitio Web" htmlFor="website" icon="ri-global-line">
              <FieldControl
                type="url"
                id="website"
                name="website"
                value={formData.website}
                onChange={handleInputChange}
                placeholder="https://www.empresa.com"
              />
            </FilterField>

            <FilterField
              label="Dirección *"
              htmlFor="address"
              icon="ri-map-pin-line"
              className="led-form-grid__full"
              hint={errors.address ? <span className="error-text">{errors.address}</span> : undefined}
            >
              <FieldControl
                type="text"
                id="address"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                placeholder="Calle 123 #45-67"
                className={errors.address ? "input-error" : ""}
              />
            </FilterField>

            <FilterField
              label="País *"
              htmlFor="pais_codigo"
              icon="ri-earth-line"
              hint={errors.pais_codigo ? <span className="error-text">{errors.pais_codigo}</span> : undefined}
            >
              <FieldControl id="pais_codigo" name="pais_codigo" as="select" value={formData.pais_codigo} onChange={handleInputChange} required disabled={loading}>
                <option value="">Seleccione un país</option>
                {paises.map((pais) => (
                  <option key={pais.codigo} value={pais.codigo}>
                    {pais.descripcion}
                  </option>
                ))}
              </FieldControl>
            </FilterField>

            <FilterField
              label="Departamento *"
              htmlFor="departamento_codigo"
              icon="ri-map-2-line"
              hint={errors.departamento_codigo ? <span className="error-text">{errors.departamento_codigo}</span> : undefined}
            >
              <FieldControl
                id="departamento_codigo"
                name="departamento_codigo"
                as="select"
                value={formData.departamento_codigo}
                onChange={(e) => {
                  handleInputChange(e);
                  setFormData((prev) => ({ ...prev, ciudad_codigo: "" }));
                }}
                required
                disabled={loading}
              >
                <option value="">Seleccione un departamento</option>
                {departamentos.map((depto) => (
                  <option key={depto.codigo} value={depto.codigo}>
                    {depto.nombre}
                  </option>
                ))}
              </FieldControl>
            </FilterField>

            <FilterField
              label="Ciudad/Municipio *"
              htmlFor="ciudad_codigo"
              icon="ri-building-2-line"
              hint={errors.ciudad_codigo ? <span className="error-text">{errors.ciudad_codigo}</span> : undefined}
            >
              <FieldControl
                id="ciudad_codigo"
                name="ciudad_codigo"
                as="select"
                value={formData.ciudad_codigo}
                onChange={handleInputChange}
                required
                disabled={loading || !formData.departamento_codigo}
                className={errors.ciudad_codigo ? "input-error" : ""}
              >
                <option value="">Seleccione una ciudad</option>
                {municipios
                  .filter((mun) => mun.code.startsWith(formData.departamento_codigo))
                  .map((mun) => (
                    <option key={mun.code} value={mun.code}>
                      {mun.name}
                    </option>
                  ))}
              </FieldControl>
            </FilterField>

            <FilterField label="Código Postal" htmlFor="zip_code" icon="ri-mail-send-line">
              <FieldControl
                type="text"
                id="zip_code"
                name="zip_code"
                value={formData.zip_code || ""}
                onChange={handleInputChange}
                placeholder="Ej: 110111"
                disabled={loading}
              />
            </FilterField>
          </div>
        </div>

        {/* Representante Legal */}
        <div className="form-section">
          <h3>Representante Legal</h3>
          <div className="led-form-grid">
            <FilterField
              label="Nombre Completo *"
              htmlFor="legal_representative_name"
              icon="ri-user-line"
              className="led-form-grid__full"
              hint={errors.legal_representative_name ? <span className="error-text">{errors.legal_representative_name}</span> : undefined}
            >
              <FieldControl
                type="text"
                id="legal_representative_name"
                name="legal_representative_name"
                value={formData.legal_representative.name}
                onChange={handleInputChange}
                required
                placeholder="Juan Pérez"
                className={errors.legal_representative_name ? "input-error" : ""}
              />
            </FilterField>

            <FilterField label="Tipo de Documento *" htmlFor="legal_representative_doc_type" icon="ri-id-card-line">
              <FieldControl
                id="legal_representative_doc_type"
                name="legal_representative_doc_type"
                as="select"
                value={formData.legal_representative.doc_type}
                onChange={handleInputChange}
                required
              >
                <option value="Cc">Cédula de Ciudadanía</option>
                <option value="Ce">Cédula de Extranjería</option>
                <option value="Pasaporte">Pasaporte</option>
                <option value="Ti">Tarjeta de Identidad</option>
              </FieldControl>
            </FilterField>

            <FilterField
              label="Número de Documento *"
              htmlFor="legal_representative_doc_number"
              icon="ri-hashtag"
              hint={errors.legal_representative_doc_number ? <span className="error-text">{errors.legal_representative_doc_number}</span> : undefined}
            >
              <FieldControl
                type="text"
                id="legal_representative_doc_number"
                name="legal_representative_doc_number"
                value={formData.legal_representative.doc_number}
                onChange={handleInputChange}
                required
                placeholder="1234567890"
                className={errors.legal_representative_doc_number ? "input-error" : ""}
              />
            </FilterField>
          </div>
        </div>

        {/* Buttons */}
        <div className="form-actions">
          <button
            type="button"
            className="btn-primary"
            onClick={() => {
              onBackToLogin();
            }}
            disabled={loading}
          >
            <i className="ri-arrow-left-line"></i>
            Volver al Login
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || Object.keys(errors).length > 0}
            onClick={(e) => {
              console.log('Botón "Siguiente" clickeado');
              console.log('Tipo de botón:', e.currentTarget.type);
              console.log('Loading:', loading);
            }}
          >
            {loading ? (
              <>
                <i className="ri-loader-4-line rotating"></i>
                Registrando...
              </>
            ) : (
              <>
                Siguiente
                <i className="ri-arrow-right-line"></i>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default Step1;


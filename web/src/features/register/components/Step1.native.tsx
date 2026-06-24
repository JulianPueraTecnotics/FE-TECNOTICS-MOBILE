import { useCallback, useMemo, useState } from "react";
import {
  Pressable,
  Text,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import type { SignupStep1Request } from "../../../types";
import { signupStep1, type RegisterUploadFile } from "../../../services/register.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import departamentos from "../../../utils/departamentos.json";
import municipios from "../../../utils/municipios.json";
import paises from "../../../utils/paises.json";
import {
  RegisterField,
  RegisterPicker,
  PasswordField,
  createRegisterStyles,
  RegisterSectionHeader,
  RegisterFormActions,
} from "./registerForm.native";
import LogoUploadNative from "./LogoUpload.native";

type Props = {
  onComplete: (companyId: string, email: string, razonSocial: string) => void;
  onBackToLogin: () => void;
};

const DOC_TYPES = [
  { label: "NIT", value: "Nit" },
  { label: "Cédula de Ciudadanía", value: "Cc" },
  { label: "Cédula de Extranjería", value: "Ce" },
  { label: "Pasaporte", value: "Pasaporte" },
];

const LEGAL_DOC_TYPES = [
  { label: "Cédula de Ciudadanía", value: "Cc" },
  { label: "Cédula de Extranjería", value: "Ce" },
  { label: "Pasaporte", value: "Pasaporte" },
];

const PAIS_ITEMS = [{ label: "Seleccione un país", value: "" }].concat(
  paises.map((p) => ({ label: p.descripcion, value: p.codigo }))
);

const DEPTO_ITEMS = [{ label: "Seleccione un departamento", value: "" }].concat(
  departamentos.map((d) => ({ label: d.nombre, value: d.codigo }))
);

export default function Step1Native({ onComplete, onBackToLogin }: Props) {
  const colors = useThemeColors();
  const styles = createRegisterStyles(colors);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<RegisterUploadFile | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState<SignupStep1Request>({
    razon_social: "",
    doc_type: "Nit",
    doc_number: "",
    email: "",
    password: "",
    phone: "",
    website: "",
    address: "",
    ciudad_codigo: "",
    departamento_codigo: "",
    pais_codigo: "169",
    zip_code: "",
    legal_representative: { name: "", doc_type: "Cc", doc_number: "" },
  });

  const ciudadItems = useMemo(() => {
    const base = [{ label: "Seleccione una ciudad", value: "" }];
    if (!formData.departamento_codigo) return base;
    return base.concat(
      municipios
        .filter((mun) => mun.code.startsWith(formData.departamento_codigo))
        .map((mun) => ({ label: mun.name, value: mun.code }))
    );
  }, [formData.departamento_codigo]);

  const pickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      errorToast("Se necesita permiso para acceder a la galería");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    const mime = asset.mimeType ?? "image/jpeg";
    if (!["image/png", "image/jpg", "image/jpeg", "image/webp"].includes(mime)) {
      errorToast("Solo se permiten imágenes PNG, JPG, JPEG o WebP");
      return;
    }
    if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
      errorToast("El logo no debe superar los 5MB");
      return;
    }

    const name = asset.fileName ?? `logo.${mime.split("/")[1] ?? "jpg"}`;
    setLogoPreview(asset.uri);
    setLogoFile({ uri: asset.uri, name, type: mime });
    setErrors((prev) => {
      const next = { ...prev };
      delete next.logo;
      return next;
    });
  };

  const setField = useCallback((name: string, value: string) => {
    if (name === "phone" && value && !/^\d*$/.test(value)) return;
    if ((name === "doc_number" || name === "legal_representative_doc_number") && value && !/^\d*$/.test(value)) {
      return;
    }

    if (name.startsWith("legal_representative_")) {
      const field = name.replace("legal_representative_", "") as "name" | "doc_type" | "doc_number";
      setFormData((prev) => ({
        ...prev,
        legal_representative: { ...prev.legal_representative, [field]: value },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }

    setErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }, []);

  const onRazonSocialChange = useCallback((v: string) => setField("razon_social", v), [setField]);
  const onDocTypeChange = useCallback((v: string) => setField("doc_type", v), [setField]);
  const onDocNumberChange = useCallback((v: string) => setField("doc_number", v), [setField]);
  const onEmailChange = useCallback((v: string) => setField("email", v), [setField]);
  const onPasswordChange = useCallback((v: string) => setField("password", v), [setField]);
  const onPhoneChange = useCallback((v: string) => setField("phone", v), [setField]);
  const onWebsiteChange = useCallback((v: string) => setField("website", v), [setField]);
  const onAddressChange = useCallback((v: string) => setField("address", v), [setField]);
  const onPaisChange = useCallback((v: string) => setField("pais_codigo", v), [setField]);
  const onDeptoChange = useCallback(
    (v: string) => {
      setField("departamento_codigo", v);
      setField("ciudad_codigo", "");
    },
    [setField]
  );
  const onCiudadChange = useCallback((v: string) => setField("ciudad_codigo", v), [setField]);
  const onZipChange = useCallback((v: string) => setField("zip_code", v), [setField]);
  const onLegalNameChange = useCallback(
    (v: string) => setField("legal_representative_name", v),
    [setField]
  );
  const onLegalDocTypeChange = useCallback(
    (v: string) => setField("legal_representative_doc_type", v),
    [setField]
  );
  const onLegalDocNumberChange = useCallback(
    (v: string) => setField("legal_representative_doc_number", v),
    [setField]
  );
  const onTogglePassword = useCallback(() => setShowPassword((p) => !p), []);

  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    if (!formData.razon_social) newErrors.razon_social = "Requerido";
    if (!formData.doc_number) newErrors.doc_number = "Requerido";
    if (!formData.email) newErrors.email = "Requerido";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = "Correo inválido";
    if (!formData.password) newErrors.password = "Requerido";
    else if (formData.password.length < 8) newErrors.password = "Mínimo 8 caracteres";
    if (!formData.phone) newErrors.phone = "Requerido";
    if (!formData.address) newErrors.address = "Requerido";
    if (!formData.pais_codigo) newErrors.pais_codigo = "Requerido";
    if (!formData.departamento_codigo) newErrors.departamento_codigo = "Requerido";
    if (!formData.ciudad_codigo) newErrors.ciudad_codigo = "Requerido";
    if (!formData.legal_representative.name) newErrors.legal_representative_name = "Requerido";
    if (!formData.legal_representative.doc_number) newErrors.legal_representative_doc_number = "Requerido";
    if (!logoFile) {
      newErrors.logo = "El logo es requerido";
      errorToast("El logo es requerido");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      errorToast("Por favor corrige los errores antes de continuar");
      return;
    }

    setLoading(true);
    try {
      const response = await signupStep1(formData, logoFile!);
      successToast(`Se envió un código de verificación a ${response.data.email}`);
      onComplete(response.data.company_id, response.data.email, response.data.razon_social);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al registrar la empresa");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <View style={styles.section}>
        <RegisterSectionHeader title="Logo de la Empresa" colors={colors} />
        <LogoUploadNative
          previewUri={logoPreview}
          hasFile={!!logoFile}
          error={errors.logo}
          onPress={() => void pickLogo()}
        />
      </View>

      <View style={styles.section}>
        <RegisterSectionHeader title="Información de la Empresa" colors={colors} />
        <RegisterField
          label="Razón Social *"
          icon="business-outline"
          value={formData.razon_social}
          onChangeText={onRazonSocialChange}
          placeholder="Ej: TECNOTICS SAS"
          error={errors.razon_social}
        />
        <RegisterPicker
          label="Tipo de Documento *"
          icon="document-text-outline"
          value={formData.doc_type}
          onValueChange={onDocTypeChange}
          items={DOC_TYPES}
        />
        <RegisterField
          label="Número de Documento * (sin dígito de verificación)"
          icon="card-outline"
          value={formData.doc_number}
          onChangeText={onDocNumberChange}
          keyboardType="number-pad"
          placeholder={formData.doc_type === "Nit" ? "900123456" : "1234567890"}
          error={errors.doc_number}
        />
        <RegisterField
          label="Correo Electrónico *"
          icon="mail-outline"
          value={formData.email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="admin@empresa.com"
          error={errors.email}
        />
        <PasswordField
          label="Contraseña *"
          value={formData.password}
          onChangeText={onPasswordChange}
          placeholder="Mínimo 8 caracteres"
          error={errors.password}
          showPassword={showPassword}
          onTogglePassword={onTogglePassword}
        />
        <RegisterField
          label="Teléfono *"
          icon="phone-portrait-outline"
          value={formData.phone}
          onChangeText={onPhoneChange}
          keyboardType="phone-pad"
          placeholder="3001234567"
          error={errors.phone}
        />
        <RegisterField
          label="Sitio Web"
          icon="globe-outline"
          value={formData.website ?? ""}
          onChangeText={onWebsiteChange}
          autoCapitalize="none"
          placeholder="https://www.empresa.com"
        />
        <RegisterField
          label="Dirección *"
          icon="location-outline"
          value={formData.address}
          onChangeText={onAddressChange}
          placeholder="Calle 123 #45-67"
          error={errors.address}
        />
        <RegisterPicker
          label="País *"
          icon="earth-outline"
          value={formData.pais_codigo}
          onValueChange={onPaisChange}
          items={PAIS_ITEMS}
          error={errors.pais_codigo}
        />
        <RegisterPicker
          label="Departamento *"
          icon="map-outline"
          value={formData.departamento_codigo}
          onValueChange={onDeptoChange}
          items={DEPTO_ITEMS}
          error={errors.departamento_codigo}
        />
        <RegisterPicker
          label="Ciudad/Municipio *"
          icon="navigate-outline"
          value={formData.ciudad_codigo}
          onValueChange={onCiudadChange}
          items={ciudadItems}
          enabled={!!formData.departamento_codigo}
          error={errors.ciudad_codigo}
        />
        <RegisterField
          label="Código Postal"
          icon="pin-outline"
          value={formData.zip_code ?? ""}
          onChangeText={onZipChange}
          placeholder="Ej: 110111"
        />
      </View>

      <View style={styles.section}>
        <RegisterSectionHeader title="Representante Legal" colors={colors} />
        <RegisterField
          label="Nombre Completo *"
          icon="person-outline"
          value={formData.legal_representative.name}
          onChangeText={onLegalNameChange}
          placeholder="Juan Pérez"
          error={errors.legal_representative_name}
        />
        <RegisterPicker
          label="Tipo de Documento *"
          icon="id-card-outline"
          value={formData.legal_representative.doc_type}
          onValueChange={onLegalDocTypeChange}
          items={LEGAL_DOC_TYPES}
        />
        <RegisterField
          label="Número de Documento *"
          icon="finger-print-outline"
          value={formData.legal_representative.doc_number}
          onChangeText={onLegalDocNumberChange}
          keyboardType="number-pad"
          placeholder="1234567890"
          error={errors.legal_representative_doc_number}
        />
      </View>

      <RegisterFormActions
        onBack={onBackToLogin}
        onNext={() => void handleSubmit()}
        nextLabel="Siguiente"
        nextDisabled={loading}
        nextLoading={loading}
        nextLoadingLabel="Registrando..."
        backDisabled={loading}
      />
    </View>
  );
}

import { API_ROUTES } from '../utils/global';
import type {
  SignupStep1Request,
  SignupStep1Response,
  SignupStep2Request,
  SignupStep2Response,
  SignupStep3Response,
  SignupStep4Request,
  SignupStep4Response,
  UploadSignedMandatoResponse,
  ContratoMandatoUrlResponse,
} from '../types';

/** Archivo web (File) o asset nativo para FormData en React Native. */
export type RegisterUploadFile =
  | File
  | { uri: string; name: string; type: string };

// ============================================
// PASO 1: Registro inicial con logo
// ============================================
export const signupStep1 = async (
  data: SignupStep1Request,
  logo: RegisterUploadFile
): Promise<SignupStep1Response> => {
  const formData = new FormData();

  // Agregar todos los campos de texto (excepto legal_representative)
  Object.entries(data).forEach(([key, value]) => {
    if (key !== 'legal_representative' && value !== undefined && value !== null && value !== '') {
      formData.append(key, value.toString());
    }
  });

  // Agregar los campos de legal_representative como campos planos
  if (data.legal_representative) {
    formData.append('legal_representative_name', data.legal_representative.name);
    formData.append('legal_representative_doc_type', data.legal_representative.doc_type);
    formData.append('legal_representative_doc_number', data.legal_representative.doc_number);
  }

  formData.append('logo', logo);

  const response = await fetch(API_ROUTES.SIGNUP_STEP1, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result as SignupStep1Response;
};

// ============================================
// PASO 2: Verificar OTP y generar contrato
// ============================================
export const signupStep2VerifyOTP = async (
  data: SignupStep2Request
): Promise<SignupStep2Response> => {
  const response = await fetch(API_ROUTES.SIGNUP_STEP2_VERIFY_OTP, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result as SignupStep2Response;
};

// ============================================
// PASO 3: Subir documentos legales (sin contrato mandato firmado)
// ============================================
export const signupStep3UploadDocs = async (
  companyId: string,
  files: {
    rut: RegisterUploadFile;
    camara_comercio: RegisterUploadFile;
    cedula_front: RegisterUploadFile;
    cedula_back: RegisterUploadFile;
  }
): Promise<SignupStep3Response> => {
  const formData = new FormData();
  formData.append('companyId', companyId);
  formData.append('rut', files.rut);
  formData.append('camara_comercio', files.camara_comercio);
  formData.append('cedula_front', files.cedula_front);
  formData.append('cedula_back', files.cedula_back);

  const response = await fetch(API_ROUTES.SIGNUP_STEP3_UPLOAD_DOCS, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result as SignupStep3Response;
};

// ============================================
// Subir contrato mandato firmado (enlace del correo)
// ============================================
export const uploadSignedMandato = async (
  companyId: string,
  signedFile: File
): Promise<UploadSignedMandatoResponse> => {
  const formData = new FormData();
  formData.append('companyId', companyId);
  formData.append('signed_contrato_mandato', signedFile);

  const response = await fetch(API_ROUTES.UPLOAD_SIGNED_MANDATO, {
    method: 'POST',
    body: formData,
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result as UploadSignedMandatoResponse;
};

// ============================================
// Obtener contrato mandato para la pantalla de firma (GET contrato-mandato/:companyId)
// ============================================
export const getContratoMandatoForSigning = async (
  companyId: string
): Promise<ContratoMandatoUrlResponse> => {
  const response = await fetch(API_ROUTES.SIGNUP_CONTRATO_MANDATO(companyId), {
    method: 'GET',
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message || 'Error al obtener el contrato');
  }

  return result as ContratoMandatoUrlResponse;
};

// ============================================
// PASO 4: Enviar a SIMBA
// ============================================
export const signupStep4SendToSimba = async (
  data: SignupStep4Request
): Promise<SignupStep4Response> => {
  const response = await fetch(API_ROUTES.SIGNUP_STEP4_SEND_TO_SIMBA, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data),
  });

  const result = await response.json();

  if (!response.ok) {
    throw new Error(result.message);
  }

  return result as SignupStep4Response;
};



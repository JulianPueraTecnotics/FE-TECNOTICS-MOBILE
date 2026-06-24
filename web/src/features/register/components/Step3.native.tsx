import { useState } from "react";
import {
  Image,
  Pressable,
  Text,
  View,
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { signupStep3UploadDocs, type RegisterUploadFile } from "../../../services/register.service";
import { useThemeColors } from "../../../theme/useThemeColors";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { createRegisterStyles, RegisterPrimaryButton } from "./registerForm.native";

type DocKey = "rut" | "camara_comercio" | "cedula_front" | "cedula_back";

type FileState = {
  file: RegisterUploadFile | null;
  preview: string | null;
  name: string | null;
};

type Props = {
  companyId: string;
  onComplete: () => void;
};

const DOC_FIELDS: { key: DocKey; label: string; isImage: boolean }[] = [
  { key: "rut", label: "RUT (Registro Único Tributario)", isImage: false },
  { key: "camara_comercio", label: "Certificado de Cámara de Comercio", isImage: false },
  { key: "cedula_front", label: "Cédula del Representante Legal (Frente)", isImage: true },
  { key: "cedula_back", label: "Cédula del Representante Legal (Reverso)", isImage: true },
];

const emptyFiles = (): Record<DocKey, FileState> => ({
  rut: { file: null, preview: null, name: null },
  camara_comercio: { file: null, preview: null, name: null },
  cedula_front: { file: null, preview: null, name: null },
  cedula_back: { file: null, preview: null, name: null },
});

export default function Step3Native({ companyId, onComplete }: Props) {
  const colors = useThemeColors();
  const styles = createRegisterStyles(colors);
  const [loading, setLoading] = useState(false);
  const [step3Done, setStep3Done] = useState(false);
  const [files, setFiles] = useState<Record<DocKey, FileState>>(emptyFiles());

  const pickDocument = async (fieldName: DocKey, isImage: boolean) => {
    if (isImage) {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        errorToast("Se necesita permiso para acceder a la galería");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.9,
      });
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const mime = asset.mimeType ?? "image/jpeg";
      if (!["image/png", "image/jpg", "image/jpeg", "image/webp"].includes(mime)) {
        errorToast("Solo se permiten imágenes PNG, JPG, JPEG o WebP");
        return;
      }
      if (asset.fileSize && asset.fileSize > 5 * 1024 * 1024) {
        errorToast("El archivo no debe superar los 5MB");
        return;
      }
      const name = asset.fileName ?? `cedula.${mime.split("/")[1] ?? "jpg"}`;
      setFiles((prev) => ({
        ...prev,
        [fieldName]: {
          file: { uri: asset.uri, name, type: mime },
          preview: asset.uri,
          name,
        },
      }));
      return;
    }

    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.mimeType && asset.mimeType !== "application/pdf") {
      errorToast("Solo se permiten archivos PDF");
      return;
    }
    if (asset.size && asset.size > 5 * 1024 * 1024) {
      errorToast("El archivo no debe superar los 5MB");
      return;
    }
    const name = asset.name ?? "documento.pdf";
    setFiles((prev) => ({
      ...prev,
      [fieldName]: {
        file: {
          uri: asset.uri,
          name,
          type: asset.mimeType ?? "application/pdf",
        },
        preview: null,
        name,
      },
    }));
  };

  const removeFile = (fieldName: DocKey) => {
    setFiles((prev) => ({
      ...prev,
      [fieldName]: { file: null, preview: null, name: null },
    }));
  };

  const handleSubmit = async () => {
    const missing = DOC_FIELDS.filter(({ key }) => !files[key].file).map(({ label }) => label);
    if (missing.length > 0) {
      errorToast("Por favor sube todos los documentos requeridos");
      return;
    }

    setLoading(true);
    try {
      const response = await signupStep3UploadDocs(companyId, {
        rut: files.rut.file!,
        camara_comercio: files.camara_comercio.file!,
        cedula_front: files.cedula_front.file!,
        cedula_back: files.cedula_back.file!,
      });
      successToast(response.message || "Documentos subidos correctamente");
      setStep3Done(true);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al subir documentos");
    } finally {
      setLoading(false);
    }
  };

  if (step3Done) {
    return (
      <View>
        <Text style={styles.sectionTitle}>Documentos subidos correctamente</Text>
        <Text style={styles.infoText}>Revisa tu correo para completar el registro.</Text>
        <View style={styles.infoBox}>
          <Text style={styles.infoTitle}>Revisa tu correo electrónico</Text>
          <Text style={styles.infoText}>
            Te hemos enviado un enlace para que el representante legal firme el contrato de mandato.
            Después de firmar podrás continuar con el envío a SIMBA y finalizar el registro.
          </Text>
        </View>
        <RegisterPrimaryButton
          label="Continuar al paso final"
          iconRight="arrow-forward"
          onPress={onComplete}
          style={{ marginTop: 12 }}
        />
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.sectionTitle}>Documentos legales</Text>
      <Text style={[styles.infoText, { marginBottom: 16 }]}>
        Sube los documentos requeridos. El contrato de mandato se firmará mediante el enlace que te
        enviaremos por correo.
      </Text>

      {DOC_FIELDS.map(({ key, label, isImage }) => {
        const state = files[key];
        return (
          <View key={key} style={styles.card}>
            <Text style={styles.cardTitle}>{label}</Text>
            {state.file ? (
              <View>
                {isImage && state.preview ? (
                  <Image
                    source={{ uri: state.preview }}
                    style={{ width: "100%", height: 140, borderRadius: 8, marginBottom: 8 }}
                    resizeMode="cover"
                  />
                ) : (
                  <Text style={styles.infoText}>{state.name}</Text>
                )}
                <Pressable onPress={() => removeFile(key)} disabled={loading}>
                  <Text style={[styles.secondaryBtnText, { marginTop: 8 }]}>Quitar archivo</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => void pickDocument(key, isImage)}
                disabled={loading}
              >
                <Text style={styles.secondaryBtnText}>
                  {isImage ? "Seleccionar imagen" : "Seleccionar PDF"}
                </Text>
              </Pressable>
            )}
          </View>
        );
      })}

      <RegisterPrimaryButton
        label="Continuar"
        iconRight="arrow-forward"
        onPress={() => void handleSubmit()}
        disabled={loading || DOC_FIELDS.some(({ key }) => !files[key].file)}
        loading={loading}
        loadingLabel="Subiendo Documentos..."
        style={{ marginTop: 24 }}
      />
    </View>
  );
}

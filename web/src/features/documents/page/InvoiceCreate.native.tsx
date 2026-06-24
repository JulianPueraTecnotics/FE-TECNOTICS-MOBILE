import BillingNativeScreen from "../../billing/BillingNativeScreen.native";

/** Crear factura desde Documentos → Nueva (formulario nativo). */
export default function InvoiceCreateNative() {
  return <BillingNativeScreen variant="document" />;
}

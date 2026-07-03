import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import { DsModuleScreen } from "../../../components/design-system-native";
import { LedgerPrimaryBtn } from "../../../components/native/ledger/LedgerUi.native";
import { PATHS } from "../../../router/paths.contants";
import {
  discardDraftInvoice,
  downloadInvoiceById,
  getInvoiceById,
  resendInvoiceEmail,
  submitDraftInvoice,
} from "../../../services/invoices.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import type { Factura } from "../../../types";
import { sharePdfFromResponse } from "../../../utils/sharePdf.native";
import { printPdfFromResponse } from "../../../utils/printPdf.native";
import {
  formatDocumentClient,
  formatDocumentDate,
  formatDocumentNumber,
  formatDocumentPrice,
  getDocumentStatus,
  getDocumentTipoInfo,
} from "../documents.shared";

const PDF_ACTIONS_DELAY_MS = 30 * 1000;

function getEmissionTimeMs(factura: Factura): number | null {
  const raw = factura.Encabezado?.FechaYHoraDocumento ?? factura.Encabezado?.FechaYHoraEmision;
  if (raw == null || raw === "") return null;
  const d = raw instanceof Date ? raw : new Date(String(raw));
  const t = d.getTime();
  return Number.isNaN(t) ? null : t;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const colors = useThemeColors();
  return (
    <View style={[styles.section, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
      <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>{title}</Text>
      {children}
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  const colors = useThemeColors();
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.infoValue, { color: colors.primaryText }]}>{value}</Text>
    </View>
  );
}

export default function DocumentDetailNative() {
  const colors = useThemeColors();
  const { id } = useParams();
  const navigate = useNavigate();

  const [factura, setFactura] = useState<Factura | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [printingPdf, setPrintingPdf] = useState(false);
  const [pdfCooldownTick, setPdfCooldownTick] = useState(0);
  const [submittingDraft, setSubmittingDraft] = useState(false);
  const [discardingDraft, setDiscardingDraft] = useState(false);
  const [resendingEmail, setResendingEmail] = useState(false);

  const isDraft = !!factura?.systemInfo?.is_draft;

  useEffect(() => {
    if (id === "nueva") {
      navigate(PATHS.DOCUMENT_CREATE, { replace: true });
    }
  }, [id, navigate]);

  useEffect(() => {
    if (!factura) return;
    const t0 = getEmissionTimeMs(factura);
    if (t0 === null) return;
    const until = t0 + PDF_ACTIONS_DELAY_MS;
    if (Date.now() >= until) return;
    const timer = setInterval(() => setPdfCooldownTick((n) => n + 1), 1000);
    return () => clearInterval(timer);
  }, [factura]);

  const { pdfActionsBlocked, pdfCooldownSecondsRemaining } = useMemo(() => {
    if (!factura) return { pdfActionsBlocked: false, pdfCooldownSecondsRemaining: 0 };
    const t0 = getEmissionTimeMs(factura);
    if (t0 === null) return { pdfActionsBlocked: false, pdfCooldownSecondsRemaining: 0 };
    const until = t0 + PDF_ACTIONS_DELAY_MS;
    const remainingMs = Math.max(0, until - Date.now());
    void pdfCooldownTick;
    return {
      pdfActionsBlocked: remainingMs > 0,
      pdfCooldownSecondsRemaining: Math.ceil(remainingMs / 1000),
    };
  }, [factura, pdfCooldownTick]);

  useEffect(() => {
    if (!id || id === "nueva") return;
    let ignore = false;
    (async () => {
      setLoading(true);
      try {
        const response = await getInvoiceById(id);
        if (!ignore) setFactura(response?.factura || null);
      } catch (error) {
        if (!ignore) {
          errorToast(error instanceof Error ? error.message : "Error al cargar la factura");
          navigate(-1);
        }
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, navigate]);

  const tipoInfo = factura ? getDocumentTipoInfo(factura) : null;
  const statusInfo = factura ? getDocumentStatus(factura) : null;
  const currency = factura?.Encabezado?.CodigoMoneda ?? "COP";

  const handleSharePdf = async () => {
    if (!id || pdfActionsBlocked) return;
    setDownloadingPdf(true);
    try {
      const res = await downloadInvoiceById(id);
      await sharePdfFromResponse(res, `factura-${id}.pdf`);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo descargar el PDF");
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrintPdf = async () => {
    if (!id || pdfActionsBlocked) return;
    setPrintingPdf(true);
    try {
      const res = await downloadInvoiceById(id);
      await printPdfFromResponse(res, `factura-${id}.pdf`);
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "No se pudo imprimir el PDF");
    } finally {
      setPrintingPdf(false);
    }
  };

  const handleResendEmail = () => {
    if (!id || pdfActionsBlocked) return;
    Alert.alert(
      "Reenviar por correo",
      "Estás a punto de reenviar esta factura al cliente. No se trata de una nueva factura ni genera una nueva obligación de pago.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Enviar",
          onPress: async () => {
            setResendingEmail(true);
            try {
              const res = await resendInvoiceEmail(id);
              successToast(res?.message?.trim() || "Correo reenviado correctamente.");
            } catch (error) {
              errorToast(error instanceof Error ? error.message : "No se pudo reenviar el correo");
            } finally {
              setResendingEmail(false);
            }
          },
        },
      ],
    );
  };

  const handleSubmitDraft = () => {
    if (!id) return;
    Alert.alert("Enviar a la DIAN", "¿Enviar este borrador a la DIAN?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Enviar",
        onPress: async () => {
          setSubmittingDraft(true);
          try {
            const res = await submitDraftInvoice(id);
            successToast(res?.message?.trim() || "Borrador enviado a la DIAN.");
            if (res?.factura) setFactura(res.factura);
            else {
              const response = await getInvoiceById(id);
              setFactura(response?.factura || null);
            }
          } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo enviar el borrador");
          } finally {
            setSubmittingDraft(false);
          }
        },
      },
    ]);
  };

  const handleDiscardDraft = () => {
    if (!id) return;
    Alert.alert("Borrar borrador", "¿Descartar este borrador? Esta acción no se puede deshacer.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Borrar",
        style: "destructive",
        onPress: async () => {
          setDiscardingDraft(true);
          try {
            const res = await discardDraftInvoice(id);
            successToast(res?.message?.trim() || "Borrador descartado.");
            navigate(PATHS.DOCUMENTS);
          } catch (error) {
            errorToast(error instanceof Error ? error.message : "No se pudo descartar el borrador");
          } finally {
            setDiscardingDraft(false);
          }
        },
      },
    ]);
  };

  const handleNavigateToNota = (option: "credito" | "debito") => {
    if (!factura) return;
    const ref = factura.systemInfo?.dianDocKey?.trim();
    if (!ref) {
      errorToast("No se encontró la referencia DIAN del documento.");
      return;
    }
    navigate(PATHS.DASHBOARD_BILLING, { state: { is_nota: { option, ref } } });
  };

  if (loading) {
    return <DsModuleScreen title="Documento" loading />;
  }

  if (!factura) {
    return (
      <DsModuleScreen title="Documento" subtitle="No encontrado">
        <Text style={{ color: colors.textMuted, textAlign: "center", marginTop: 24 }}>No se encontró el documento</Text>
      </DsModuleScreen>
    );
  }

  const emissionRaw =
    factura.Encabezado?.FechaYHoraDocumento || factura.Encabezado?.FechaYHoraEmision;
  const emissionDate = emissionRaw
    ? formatDocumentDate(emissionRaw instanceof Date ? emissionRaw.toISOString() : String(emissionRaw))
    : "N/A";

  const company = factura.Terceros?.TerceroEmisorContable?.Tercero;
  const clientDoc =
    factura.Terceros?.TerceroClienteContable?.Tercero?.NumeroIdentificacion?.[0]?.Value ?? "N/A";

  return (
    <DsModuleScreen
      title={tipoInfo?.label ?? "Documento"}
      subtitle={formatDocumentNumber(factura)}
      headerActions={
        <>
          <Pressable onPress={() => navigate(-1)} hitSlop={8} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.primaryText} />
          </Pressable>
          {statusInfo ? (
            <View style={[styles.badge, { backgroundColor: statusInfo.bg }]}>
              <Text style={[styles.badgeText, { color: statusInfo.color }]}>{statusInfo.label}</Text>
            </View>
          ) : null}
        </>
      }
    >
        {factura.Parametros?.TipoAmbiente === "2" ? (
          <View style={styles.testBanner}>
            <Text style={styles.testBannerText}>DOCUMENTO EMITIDO EN MODO DE PRUEBA</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          {isDraft ? (
            <>
              <LedgerPrimaryBtn label="Enviar a la DIAN" icon="send-outline" onPress={handleSubmitDraft} loading={submittingDraft} />
              <LedgerPrimaryBtn label="Borrar borrador" icon="trash-outline" variant="danger" onPress={handleDiscardDraft} loading={discardingDraft} />
            </>
          ) : (
            <>
              <LedgerPrimaryBtn
                label={downloadingPdf ? "Preparando…" : "Compartir PDF"}
                icon="share-outline"
                variant="secondary"
                onPress={handleSharePdf}
                loading={downloadingPdf}
                disabled={pdfActionsBlocked}
              />
              <LedgerPrimaryBtn
                label={printingPdf ? "Imprimiendo…" : "Imprimir"}
                icon="print-outline"
                variant="secondary"
                onPress={handlePrintPdf}
                loading={printingPdf}
                disabled={pdfActionsBlocked}
              />
              <LedgerPrimaryBtn
                label="Enviar email"
                icon="mail-outline"
                variant="secondary"
                onPress={handleResendEmail}
                loading={resendingEmail}
                disabled={pdfActionsBlocked}
              />
              <LedgerPrimaryBtn label="Nota débito" icon="document-text-outline" variant="secondary" onPress={() => handleNavigateToNota("debito")} />
              <LedgerPrimaryBtn label="Nota crédito" icon="checkmark-circle-outline" onPress={() => handleNavigateToNota("credito")} />
            </>
          )}
        </View>

        {pdfActionsBlocked ? (
          <Text style={[styles.cooldownHint, { color: colors.textMuted }]}>
            PDF disponible en {pdfCooldownSecondsRemaining}s tras la emisión
          </Text>
        ) : null}

        <Section title="Cliente">
          <InfoRow label="Nombre" value={formatDocumentClient(factura)} />
          <InfoRow label="Documento" value={clientDoc} />
        </Section>

        <Section title="Documento">
          <InfoRow label="Fecha emisión" value={emissionDate} />
          <InfoRow label="Estado DIAN" value={factura.systemInfo?.dianStatusDescr ? "Procesado" : "Pendiente"} />
          <InfoRow label="Moneda" value={typeof currency === "string" ? currency : currency?.Value ?? "COP"} />
        </Section>

        {company ? (
          <Section title="Emisor">
            <InfoRow label="Empresa" value={company.NombreTercero?.[0]?.Value ?? "N/A"} />
            <InfoRow label="NIT" value={company.NumeroIdentificacion?.[0]?.Value ?? "N/A"} />
          </Section>
        ) : null}

        <View style={[styles.section, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primaryText }]}>Líneas</Text>
          {factura.Lineas?.map((linea, idx) => {
            const lineImpuestos = linea?.TotalImpuesto ?? linea?.TotalImpusto;
            const ivaPercent = lineImpuestos?.[0]?.SubTotalImpuesto?.[0]?.CategoriaImpuesto?.Porcentaje ?? 0;
            const unitPrice = linea?.Item?.Precio?.ValorPrecio;
            return (
              <View key={linea?.Id?.Value ?? idx} style={[styles.lineCard, { borderColor: colors.border }]}>
                <Text style={[styles.lineName, { color: colors.primaryText }]}>
                  {linea?.Item?.Nombre?.Value || "Sin nombre"}
                </Text>
                <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                  Cant: {linea?.Cantidad?.Value ?? 0} · IVA {String(ivaPercent)}%
                </Text>
                <Text style={[styles.lineTotal, { color: colors.primaryText }]}>
                  {linea?.ValorNeto
                    ? formatDocumentPrice(linea.ValorNeto.Value, linea.ValorNeto.IdMoneda)
                    : unitPrice
                      ? formatDocumentPrice(unitPrice.Value, unitPrice.IdMoneda)
                      : "N/A"}
                </Text>
              </View>
            );
          })}
        </View>

        {factura.Totales?.TotalMonetario?.ValorAPagar ? (
          <View style={[styles.totalRow, { borderColor: colors.border }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Total</Text>
            <Text style={[styles.totalValue, { color: colors.primaryText }]}>
              {formatDocumentPrice(
                factura.Totales.TotalMonetario.ValorAPagar.Value,
                factura.Totales.TotalMonetario.ValorAPagar.IdMoneda ?? currency,
              )}
            </Text>
          </View>
        ) : null}
    </DsModuleScreen>
  );
}

const styles = StyleSheet.create({
  backBtn: { padding: 4 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: SHELL_RADIUS.button },
  badgeText: { fontSize: 12, fontWeight: "700" },
  testBanner: { marginBottom: 8, backgroundColor: "#fef3c7", padding: 8, borderRadius: SHELL_RADIUS.button },
  testBannerText: { color: "#92400e", fontSize: 12, fontWeight: "700", textAlign: "center" },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 8 },
  cooldownHint: { fontSize: 12, marginBottom: 8 },
  section: { marginBottom: 12, borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 10 },
  infoRow: { marginBottom: 6 },
  infoLabel: { fontSize: 12 },
  infoValue: { fontSize: 14, fontWeight: "500" },
  lineCard: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 10 },
  lineName: { fontWeight: "600", fontSize: 14 },
  lineMeta: { fontSize: 12, marginTop: 2 },
  lineTotal: { fontSize: 15, fontWeight: "700", marginTop: 4 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 2,
    paddingTop: 12,
    marginTop: 4,
  },
  totalLabel: { fontSize: 14, fontWeight: "600" },
  totalValue: { fontSize: 20, fontWeight: "800" },
});

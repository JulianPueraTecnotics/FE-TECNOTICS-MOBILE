import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import { DsButton, DsField, DsModuleScreen, DsSideModal } from "../../../components/design-system-native";
import { PATHS } from "../../../router/paths.contants";
import { getAllClients, searchClients } from "../../../services/clients.service";
import { getAllItems, searchItems } from "../../../services/items.service";
import { createQuote, getQuoteById, updateQuote } from "../../../services/quotes.service";
import { errorToast, successToast } from "../../../components/shared/toast/toasts";
import { AuthContext } from "../../../store/auth.context";
import { useThemeColors } from "../../../theme/useThemeColors";
import type { CreateQuoteRequest, IExternUser, ItemData, QuoteLine } from "../../../types";
import { calcQuoteTotals, formatCOP } from "../quotes.utils";

function defaultVencimiento(): string {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const PAYMENT_FORMS = ["Contado", "Crédito"] as const;
const PAYMENT_METHODS = ["Efectivo", "Transferencia", "Tarjeta", "Cheque", "Otro"];

export default function QuoteEditorNative() {
  const { id } = useParams<{ id: string }>();
  const isEdit = !!id;
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [bootLoading, setBootLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);
  const [lines, setLines] = useState<QuoteLine[]>([]);
  const [paymentForm, setPaymentForm] = useState<(typeof PAYMENT_FORMS)[number]>("Contado");
  const [paymentMethod, setPaymentMethod] = useState("Efectivo");
  const [retenciones, setRetenciones] = useState("0");
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState(defaultVencimiento());
  const [clientEmail, setClientEmail] = useState("");

  const [clientModalOpen, setClientModalOpen] = useState(false);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<IExternUser[]>([]);
  const [clientLoading, setClientLoading] = useState(false);

  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemQuery, setItemQuery] = useState("");
  const [itemResults, setItemResults] = useState<ItemData[]>([]);
  const [itemLoading, setItemLoading] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [manualQty, setManualQty] = useState("1");
  const [manualIva, setManualIva] = useState("19");

  const retPct = parseFloat(retenciones) || 0;
  const totals = useMemo(() => calcQuoteTotals(lines, retPct), [lines, retPct]);

  useEffect(() => {
    if (!isEdit || !id) return;
    let ignore = false;
    (async () => {
      try {
        const res = await getQuoteById(id);
        const q = res?.quote;
        if (!q || ignore) return;
        setClientId(q.client_id);
        setLines(q.lines ?? []);
        setPaymentForm((q.payment_form as (typeof PAYMENT_FORMS)[number]) ?? "Contado");
        setPaymentMethod(q.payment_method ?? "Efectivo");
        setRetenciones(String(q.totals?.retenciones ?? 0));
        setNotes(q.notes ?? "");
        setValidUntil(q.valid_until ? q.valid_until.slice(0, 10) : defaultVencimiento());
        setClientEmail(q.client_email ?? "");
        setSelectedClient({
          _id: q.client_id,
          name: q.client_name ?? "",
          doc_number: q.client_doc ?? "",
          email: q.client_email ?? "",
          phone: q.client_phone ?? "",
        } as IExternUser);
      } catch (e) {
        errorToast(e instanceof Error ? e.message : "No se pudo cargar la cotización");
        navigate(PATHS.SALES_COTIZACIONES);
      } finally {
        if (!ignore) setBootLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id, isEdit, navigate]);

  const searchClientsList = useCallback(async (q: string) => {
    setClientLoading(true);
    try {
      const res = q.trim() ? await searchClients(q.trim(), 1, 30) : await getAllClients(1, 30);
      setClientResults(res?.clients ?? []);
    } catch {
      setClientResults([]);
    } finally {
      setClientLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!clientModalOpen) return;
    const t = setTimeout(() => void searchClientsList(clientQuery), 300);
    return () => clearTimeout(t);
  }, [clientModalOpen, clientQuery, searchClientsList]);

  const searchItemsList = useCallback(async (q: string) => {
    setItemLoading(true);
    try {
      const res = q.trim() ? await searchItems(q.trim(), 1, 30) : await getAllItems(1, 30);
      setItemResults(res?.items ?? []);
    } catch {
      setItemResults([]);
    } finally {
      setItemLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!itemModalOpen) return;
    const t = setTimeout(() => void searchItemsList(itemQuery), 300);
    return () => clearTimeout(t);
  }, [itemModalOpen, itemQuery, searchItemsList]);

  const pickClient = (c: IExternUser) => {
    setSelectedClient(c);
    setClientId(c._id);
    setClientEmail(c.email ?? "");
    setClientModalOpen(false);
    setClientQuery("");
  };

  const addCatalogItem = (product: ItemData) => {
    const qty = product.quantity && product.quantity > 0 ? product.quantity : 1;
    setLines((prev) => [
      ...prev,
      {
        item_id: product._id,
        code: product.code || product.external_id,
        name: product.name,
        description: product.description || product.name,
        quantity: qty,
        price: product.price,
        iva: product.taxes?.iva ?? 19,
        unidad_medida: product.unidad_medida,
      },
    ]);
    setItemModalOpen(false);
    setItemQuery("");
  };

  const addManualItem = () => {
    const price = parseFloat(manualPrice);
    const qty = parseFloat(manualQty);
    const iva = parseFloat(manualIva);
    if (!manualName.trim()) {
      errorToast("Indica el nombre del ítem");
      return;
    }
    if (Number.isNaN(price) || price < 0) {
      errorToast("Precio inválido");
      return;
    }
    if (Number.isNaN(qty) || qty <= 0) {
      errorToast("Cantidad inválida");
      return;
    }
    setLines((prev) => [
      ...prev,
      {
        name: manualName.trim(),
        description: manualName.trim(),
        quantity: qty,
        price,
        iva: Number.isNaN(iva) ? 19 : iva,
      },
    ]);
    setManualName("");
    setManualPrice("");
    setManualQty("1");
    setManualIva("19");
    setItemModalOpen(false);
  };

  const buildPayload = (sendEmail?: boolean): CreateQuoteRequest => ({
    client_id: clientId,
    lines,
    payment_form: paymentForm,
    payment_method: paymentMethod,
    retenciones: retPct,
    notes: notes.trim() || undefined,
    valid_until: validUntil.trim() || undefined,
    client_email: clientEmail.trim() || undefined,
    send_email: sendEmail,
    executed_by: user?.razon_social,
  });

  const handleSave = async (sendEmail = false) => {
    if (!clientId) {
      errorToast("Selecciona un cliente");
      return;
    }
    if (lines.length === 0) {
      errorToast("Agrega al menos un ítem");
      return;
    }
    setSubmitting(true);
    try {
      const payload = buildPayload(sendEmail);
      if (isEdit && id) {
        await updateQuote(id, payload);
        successToast(sendEmail ? "Cotización actualizada y enviada" : "Cotización actualizada");
      } else {
        await createQuote(payload);
        successToast(sendEmail ? "Cotización creada y enviada" : "Cotización creada");
      }
      navigate(PATHS.SALES_COTIZACIONES);
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  if (bootLoading) {
    return <DsModuleScreen title={isEdit ? "Editar cotización" : "Nueva cotización"} loading />;
  }

  return (
    <>
      <DsModuleScreen
        title={isEdit ? "Editar cotización" : "Nueva cotización"}
        headerActions={
          <Pressable onPress={() => navigate(PATHS.SALES_COTIZACIONES)} hitSlop={8}>
            <Ionicons name="arrow-back" size={22} color={colors.headerAccent} />
          </Pressable>
        }
        footer={
          <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.paddingBottom + 8, backgroundColor: colors.cardBg }]}>
            <DsButton label="Guardar" variant="secondary" onPress={() => handleSave(false)} loading={submitting} style={{ flex: 1 }} />
            <DsButton label="Guardar y enviar" onPress={() => handleSave(true)} loading={submitting} style={{ flex: 1 }} />
          </View>
        }
        contentStyle={{ gap: 12, paddingBottom: 8 }}
      >
        <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Cliente</Text>
          <Pressable
            style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}
            onPress={() => setClientModalOpen(true)}
          >
            <Ionicons name="person-outline" size={18} color={colors.headerAccent} />
            <Text style={[styles.selectText, { color: colors.primaryText }]}>
              {selectedClient ? `${selectedClient.name}` : "Seleccionar cliente"}
            </Text>
          </Pressable>
          <View style={{ marginTop: 8 }}>
            <DsField
              label="Correo de envío"
              icon="mail-outline"
              value={clientEmail}
              onChangeText={setClientEmail}
              placeholder="cliente@correo.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>
        </View>

        <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Ítems</Text>
            <Pressable onPress={() => setItemModalOpen(true)} style={[styles.addBtn, { backgroundColor: colors.headerAccent }]}>
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addBtnText}>Agregar</Text>
            </Pressable>
          </View>
          {lines.length === 0 ? (
            <Text style={{ color: colors.textMuted, marginTop: 8 }}>Sin ítems</Text>
          ) : (
            lines.map((line, idx) => (
              <View key={`${line.name}-${idx}`} style={[styles.lineItem, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: "600", color: colors.primaryText }}>{line.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>
                    {line.quantity} × {formatCOP(line.price)} · IVA {line.iva}%
                  </Text>
                </View>
                <Pressable onPress={() => setLines((prev) => prev.filter((_, i) => i !== idx))}>
                  <Ionicons name="close-circle" size={22} color="#dc2626" />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Condiciones</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {PAYMENT_FORMS.map((pf) => (
              <Pressable
                key={pf}
                onPress={() => setPaymentForm(pf)}
                style={[styles.chip, paymentForm === pf ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: paymentForm === pf ? "#fff" : colors.primaryText, fontWeight: "600" }}>{pf}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
            {PAYMENT_METHODS.map((pm) => (
              <Pressable
                key={pm}
                onPress={() => setPaymentMethod(pm)}
                style={[styles.chip, paymentMethod === pm ? { backgroundColor: colors.headerAccent } : { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: paymentMethod === pm ? "#fff" : colors.primaryText, fontSize: 13 }}>{pm}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <View style={{ gap: 8 }}>
            <DsField
              label="Vencimiento (AAAA-MM-DD)"
              icon="calendar-outline"
              value={validUntil}
              onChangeText={setValidUntil}
              placeholder="2026-07-22"
            />
            <DsField
              label="Retención (%)"
              icon="pricetag-outline"
              value={retenciones}
              onChangeText={setRetenciones}
              keyboardType="decimal-pad"
            />
            <DsField
              label="Observaciones"
              icon="document-text-outline"
              value={notes}
              onChangeText={setNotes}
              multiline
            />
          </View>
        </View>

        <View style={[styles.totalsBox, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted }}>Subtotal: {formatCOP(totals.subtotal)}</Text>
          <Text style={{ color: colors.textMuted }}>IVA: {formatCOP(totals.iva)}</Text>
          <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 18, marginTop: 4 }}>Total: {formatCOP(totals.total)}</Text>
        </View>
      </DsModuleScreen>

      <DsSideModal
        visible={clientModalOpen}
        onClose={() => setClientModalOpen(false)}
        title="Cliente"
        icon="person-outline"
      >
        <DsField
          icon="search-outline"
          value={clientQuery}
          onChangeText={setClientQuery}
          placeholder="Buscar cliente..."
        />
        {clientLoading ? (
          <ActivityIndicator color={colors.headerAccent} style={{ marginTop: 24 }} />
        ) : (
          clientResults.map((c) => (
            <Pressable
              key={c._id}
              onPress={() => pickClient(c)}
              style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
            >
              <Text style={{ fontWeight: "600", color: colors.primaryText }}>{c.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.doc_type} {c.doc_number}</Text>
            </Pressable>
          ))
        )}
      </DsSideModal>

      <DsSideModal
        visible={itemModalOpen}
        onClose={() => setItemModalOpen(false)}
        title="Producto o servicio"
        icon="cube-outline"
      >
        <DsField
          icon="search-outline"
          value={itemQuery}
          onChangeText={setItemQuery}
          placeholder="Buscar en catálogo..."
        />
        <View style={{ gap: 8 }}>
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Captura manual</Text>
          <DsField icon="cube-outline" value={manualName} onChangeText={setManualName} placeholder="Nombre" />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <DsField icon="cash-outline" value={manualPrice} onChangeText={setManualPrice} placeholder="Precio" keyboardType="decimal-pad" />
            </View>
            <View style={{ width: 110 }}>
              <DsField icon="layers-outline" value={manualQty} onChangeText={setManualQty} placeholder="Cant." keyboardType="decimal-pad" />
            </View>
          </View>
          <Pressable onPress={addManualItem} style={[styles.addBtn, { backgroundColor: colors.headerAccent, alignSelf: "flex-start" }]}>
            <Text style={styles.addBtnText}>Agregar manual</Text>
          </Pressable>
        </View>
        {itemLoading ? (
          <ActivityIndicator color={colors.headerAccent} />
        ) : (
          itemResults.map((item) => (
            <Pressable
              key={item._id}
              onPress={() => addCatalogItem(item)}
              style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
            >
              <Text style={{ fontWeight: "600", color: colors.primaryText }}>{item.name}</Text>
              <Text style={{ color: colors.textMuted, fontSize: 13 }}>{formatCOP(item.price)}</Text>
            </Pressable>
          ))
        )}
      </DsSideModal>
    </>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  selectBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: SHELL_RADIUS.input, padding: 12 },
  selectText: { flex: 1, fontSize: 14 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  lineItem: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  totalsBox: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 4 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  pickRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, padding: 12, marginBottom: 8 },
});

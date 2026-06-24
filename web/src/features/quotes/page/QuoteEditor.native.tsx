import { Ionicons } from "@expo/vector-icons";
import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useNavigate, useParams } from "react-router-dom";
import { useNativePrivateInsets } from "../../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../../components/mobile/shellStyles.native";
import LoadingScreen from "../../../router/LoadingScreen";
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

  if (bootLoading) return <LoadingScreen />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigate(PATHS.SALES_COTIZACIONES)} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={colors.accent} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.primary }]}>{isEdit ? "Editar cotización" : "Nueva cotización"}</Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.paddingBottom + 100 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Cliente</Text>
          <Pressable
            style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}
            onPress={() => setClientModalOpen(true)}
          >
            <Ionicons name="person-outline" size={18} color={colors.accent} />
            <Text style={[styles.selectText, { color: colors.primaryText }]}>
              {selectedClient ? `${selectedClient.name}` : "Seleccionar cliente"}
            </Text>
          </Pressable>
          <TextInput
            value={clientEmail}
            onChangeText={setClientEmail}
            placeholder="Correo de envío"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle, marginTop: 8 }]}
          />
        </View>

        <View style={[styles.card, getSoftCardShadow(colors), { backgroundColor: colors.cardBg, borderColor: colors.border }]}>
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Ítems</Text>
            <Pressable onPress={() => setItemModalOpen(true)} style={[styles.addBtn, { backgroundColor: colors.accent }]}>
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
                style={[styles.chip, paymentForm === pf ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 }]}
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
                style={[styles.chip, paymentMethod === pm ? { backgroundColor: colors.accent } : { borderColor: colors.border, borderWidth: 1 }]}
              >
                <Text style={{ color: paymentMethod === pm ? "#fff" : colors.primaryText, fontSize: 13 }}>{pm}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Text style={[styles.label, { color: colors.textMuted }]}>Vencimiento (AAAA-MM-DD)</Text>
          <TextInput
            value={validUntil}
            onChangeText={setValidUntil}
            placeholder="2026-07-22"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
          />
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>Retención (%)</Text>
          <TextInput
            value={retenciones}
            onChangeText={setRetenciones}
            keyboardType="decimal-pad"
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle }]}
          />
          <Text style={[styles.label, { color: colors.textMuted, marginTop: 8 }]}>Observaciones</Text>
          <TextInput
            value={notes}
            onChangeText={setNotes}
            multiline
            style={[styles.input, { borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.bgSubtle, minHeight: 72 }]}
          />
        </View>

        <View style={[styles.totalsBox, { backgroundColor: colors.bgSubtle, borderColor: colors.border }]}>
          <Text style={{ color: colors.textMuted }}>Subtotal: {formatCOP(totals.subtotal)}</Text>
          <Text style={{ color: colors.textMuted }}>IVA: {formatCOP(totals.iva)}</Text>
          <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 18, marginTop: 4 }}>Total: {formatCOP(totals.total)}</Text>
        </View>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, paddingBottom: insets.paddingBottom + 8, backgroundColor: colors.cardBg }]}>
        <Pressable
          style={[styles.footerBtn, { borderColor: colors.border }]}
          onPress={() => handleSave(false)}
          disabled={submitting}
        >
          {submitting ? <ActivityIndicator color={colors.accent} /> : <Text style={{ color: colors.primaryText, fontWeight: "600" }}>Guardar</Text>}
        </Pressable>
        <Pressable style={[styles.footerBtn, { backgroundColor: colors.accent }]} onPress={() => handleSave(true)} disabled={submitting}>
          <Text style={{ color: "#fff", fontWeight: "700" }}>Guardar y enviar</Text>
        </Pressable>
      </View>

      <Modal visible={clientModalOpen} animationType="slide" onRequestClose={() => setClientModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setClientModalOpen(false)}>
              <Ionicons name="close" size={26} color={colors.primaryText} />
            </Pressable>
            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 17 }}>Cliente</Text>
            <View style={{ width: 26 }} />
          </View>
          <TextInput
            value={clientQuery}
            onChangeText={setClientQuery}
            placeholder="Buscar cliente..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { margin: 16, borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
          />
          {clientLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}>
              {clientResults.map((c) => (
                <Pressable
                  key={c._id}
                  onPress={() => pickClient(c)}
                  style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                >
                  <Text style={{ fontWeight: "600", color: colors.primaryText }}>{c.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{c.doc_type} {c.doc_number}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal visible={itemModalOpen} animationType="slide" onRequestClose={() => setItemModalOpen(false)}>
        <View style={{ flex: 1, backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setItemModalOpen(false)}>
              <Ionicons name="close" size={26} color={colors.primaryText} />
            </Pressable>
            <Text style={{ fontWeight: "700", color: colors.primary, fontSize: 17 }}>Producto o servicio</Text>
            <View style={{ width: 26 }} />
          </View>
          <TextInput
            value={itemQuery}
            onChangeText={setItemQuery}
            placeholder="Buscar en catálogo..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, { margin: 16, borderColor: colors.border, color: colors.primaryText, backgroundColor: colors.cardBg }]}
          />
          <View style={{ paddingHorizontal: 16, gap: 8, marginBottom: 8 }}>
            <Text style={{ color: colors.textMuted, fontSize: 13 }}>Captura manual</Text>
            <TextInput value={manualName} onChangeText={setManualName} placeholder="Nombre" placeholderTextColor={colors.textMuted} style={[styles.input, { borderColor: colors.border, color: colors.primaryText }]} />
            <View style={{ flexDirection: "row", gap: 8 }}>
              <TextInput value={manualPrice} onChangeText={setManualPrice} placeholder="Precio" keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={[styles.input, { flex: 1, borderColor: colors.border, color: colors.primaryText }]} />
              <TextInput value={manualQty} onChangeText={setManualQty} placeholder="Cant." keyboardType="decimal-pad" placeholderTextColor={colors.textMuted} style={[styles.input, { width: 72, borderColor: colors.border, color: colors.primaryText }]} />
            </View>
            <Pressable onPress={addManualItem} style={[styles.addBtn, { backgroundColor: colors.accent, alignSelf: "flex-start" }]}>
              <Text style={styles.addBtnText}>Agregar manual</Text>
            </Pressable>
          </View>
          {itemLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: insets.paddingBottom }}>
              {itemResults.map((item) => (
                <Pressable
                  key={item._id}
                  onPress={() => addCatalogItem(item)}
                  style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                >
                  <Text style={{ fontWeight: "600", color: colors.primaryText }}>{item.name}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 13 }}>{formatCOP(item.price)}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 18, fontWeight: "700" },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginBottom: 8 },
  selectBtn: { flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderRadius: SHELL_RADIUS.input, padding: 12 },
  selectText: { flex: 1, fontSize: 14 },
  input: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  label: { fontSize: 12, marginBottom: 4 },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  addBtn: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: SHELL_RADIUS.button },
  addBtnText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  lineItem: { flexDirection: "row", alignItems: "center", gap: 8, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  totalsBox: { borderWidth: 1, borderRadius: SHELL_RADIUS.card, padding: 14, marginTop: 4 },
  footer: { flexDirection: "row", gap: 10, paddingHorizontal: 16, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  footerBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 12, borderRadius: SHELL_RADIUS.button, borderWidth: 1 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pickRow: { borderWidth: 1, borderRadius: SHELL_RADIUS.input, padding: 12, marginBottom: 8 },
});

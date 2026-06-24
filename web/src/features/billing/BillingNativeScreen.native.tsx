import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useLocation, useNavigate } from "react-router-dom";
import PrefixSetupGateNative from "../../components/native/PrefixSetupGate.native";
import { useNativePrivateInsets } from "../../components/mobile/useNativePrivateInsets.native";
import { SHELL_RADIUS, getSoftCardShadow } from "../../components/mobile/shellStyles.native";
import LoadingScreen from "../../router/LoadingScreen";
import { PATHS } from "../../router/paths.contants";
import { errorToast, successToast } from "../../components/shared/toast/toasts";
import { getAllClients, searchClients } from "../../services/clients.service";
import { createBillingInvoice, getInvoiceById } from "../../services/invoices.service";
import { getAllItems, searchItems } from "../../services/items.service";
import { getClientById } from "../../services/clients.service";
import { useThemeColors } from "../../theme/useThemeColors";
import type { IExternUser, ItemData, LineasHeader } from "../../types";
import { getProfileService } from "../profile/page/services/get_profile";
import { parseBillingNavigateState } from "./billing.types";
import {
  getInvoiceBillingPrefixes,
  hasUsableInvoicePrefixes,
  normalizeTipoDocElectronico,
  normalizeTipoFactura,
  pickDefaultInvoicePrefix,
} from "../profile/prefix/prefix.shared";

type LineItem = {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  iva: number;
  code?: string;
  kind?: string;
  unidad_medida?: string;
};

type Props = {
  /** dashboard = menú Facturar; document = Documentos → Nueva */
  variant?: "dashboard" | "document";
};

const PAYMENT_OPTIONS = [
  { value: "1", label: "Contado" },
  { value: "2", label: "Crédito" },
];

function formatIsoDate(d = new Date()) {
  return d.toISOString();
}

function calcLineTotal(price: number, qty: number, iva: number) {
  const sub = price * qty;
  return sub + (sub * iva) / 100;
}

function calcTotals(items: LineItem[]) {
  let valorBruto = 0;
  let subtotal = 0;
  for (const item of items) {
    const line = item.price * item.quantity;
    valorBruto += line;
    subtotal += line;
  }
  const totalTax = items.reduce((acc, item) => {
    const line = item.price * item.quantity;
    return acc + (line * item.iva) / 100;
  }, 0);
  const total = subtotal + totalTax;
  return { valorBruto, subtotal, total, totalTax };
}

export default function BillingNativeScreen({ variant = "dashboard" }: Props) {
  const colors = useThemeColors();
  const insets = useNativePrivateInsets();
  const navigate = useNavigate();
  const location = useLocation();

  const [bootLoading, setBootLoading] = useState(true);
  const [showPrefixSetup, setShowPrefixSetup] = useState(false);
  const [prefixes, setPrefixes] = useState<ReturnType<typeof getInvoiceBillingPrefixes>>([]);
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [selectedClient, setSelectedClient] = useState<IExternUser | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("1");
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [currency] = useState("COP");
  const [items, setItems] = useState<LineItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

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

  const totals = useMemo(() => calcTotals(items), [items]);
  const isDocumentFlow = variant === "document";

  const loadPrefixes = useCallback(async () => {
    setBootLoading(true);
    try {
      const data = await getProfileService();
      if (data instanceof Error || !data?.company) {
        throw new Error(data instanceof Error ? data.message : "Error al cargar configuración");
      }
      const companyPrefixes = data.company.prefixes ?? [];
      const invoicePrefixes = getInvoiceBillingPrefixes(companyPrefixes);
      if (!hasUsableInvoicePrefixes(companyPrefixes)) {
        setShowPrefixSetup(true);
        setPrefixes([]);
        return;
      }
      setShowPrefixSetup(false);
      setPrefixes(invoicePrefixes);
      const def = pickDefaultInvoicePrefix(companyPrefixes);
      setSelectedPrefix(def?.prefix ?? invoicePrefixes[0]?.prefix ?? "");
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al validar prefijos");
      setShowPrefixSetup(true);
    } finally {
      setBootLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPrefixes();
  }, [loadPrefixes, location.key]);

  useEffect(() => {
    const { recreateFacturaId } = parseBillingNavigateState(location.state);
    if (!recreateFacturaId || bootLoading) return;
    let ignore = false;
    (async () => {
      try {
        const res = await getInvoiceById(recreateFacturaId);
        const f = res?.factura;
        if (!f || ignore) return;
        const clientId = f.systemInfo?.idExternUser;
        if (clientId) {
          const cr = await getClientById(clientId);
          if (cr?.client && !ignore) setSelectedClient(cr.client);
        }
        const mapped = (f.Lineas ?? []).map((line: LineasHeader, idx: number) => {
          const qty = line.Cantidad?.Value ?? 1;
          const net = line.ValorNeto?.Value ?? 0;
          const price = qty > 0 ? net / qty : net;
          const imp = line.TotalImpuesto?.[0] ?? line.TotalImpusto?.[0];
          const ivaPct = imp?.SubTotalImpuesto?.[0]?.CategoriaImpuesto?.Porcentaje ?? 19;
          const name = line.Item?.Nombre?.Value ?? `Ítem ${idx + 1}`;
          const desc = line.Item?.Descripcion?.[0]?.Value ?? name;
          return {
            id: `${Date.now()}-${idx}`,
            name,
            description: desc,
            price,
            quantity: qty,
            iva: ivaPct,
            code: line.Item?.IdItemEstandar?.Id?.Value,
          };
        });
        if (!ignore && mapped.length) setItems(mapped);
        const obs = f.Notas?.[0]?.Value;
        if (!ignore && obs) setNotes(obs);
        successToast("Plantilla cargada — revisa y emite la factura");
      } catch (e) {
        if (!ignore) errorToast(e instanceof Error ? e.message : "No se pudo cargar la plantilla");
      }
    })();
    return () => {
      ignore = true;
    };
  }, [location.state, bootLoading]);

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

  const addCatalogItem = (product: ItemData) => {
    const qty = product.quantity && product.quantity > 0 ? product.quantity : 1;
    const iva = product.taxes?.iva ?? 19;
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: product.name,
        description: product.description || product.name,
        price: product.price,
        quantity: qty,
        iva,
        code: product.code || product.external_id,
        kind: product.kind,
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
    setItems((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random()}`,
        name: manualName.trim(),
        description: manualName.trim(),
        price,
        quantity: qty,
        iva: Number.isNaN(iva) ? 19 : iva,
      },
    ]);
    setManualName("");
    setManualPrice("");
    setManualQty("1");
    setManualIva("19");
    setItemModalOpen(false);
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const handleCreate = async () => {
    if (!selectedClient) {
      errorToast("Selecciona un cliente");
      return;
    }
    if (items.length === 0) {
      errorToast("Agrega al menos un producto o servicio");
      return;
    }
    if (!selectedPrefix) {
      errorToast("Selecciona un prefijo de facturación");
      return;
    }
    if (paymentMethod === "2" && !dueDate.trim()) {
      errorToast("Indica la fecha de vencimiento para factura a crédito (AAAA-MM-DD)");
      return;
    }

    const prefixData = prefixes.find((p) => p.prefix === selectedPrefix);
    const tipoDoc = normalizeTipoDocElectronico(prefixData?.resolution?.tipo_doc_electronico);
    const tipoFactura = normalizeTipoFactura(prefixData?.resolution?.tipo_factura);

    const fElaboracion = formatIsoDate();
    const fVencimiento =
      paymentMethod === "2"
        ? formatIsoDate(new Date(`${dueDate.trim()}T12:00:00`))
        : formatIsoDate(new Date(`${new Date().toISOString().slice(0, 10)}T12:00:00`));

    setSubmitting(true);
    try {
      const payloadItems = items.map((item) => ({
        code: item.code,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        total: calcLineTotal(item.price, item.quantity, item.iva),
        description: item.description,
        kind: item.kind || "product",
        unidad_medida: item.unidad_medida || "KGM",
        taxes: { iva: item.iva, other: 0 },
      }));

      const result = await createBillingInvoice({
        client_id: selectedClient._id,
        items: payloadItems,
        headers: {
          f_elaboracion: fElaboracion,
          f_vencimiento: fVencimiento,
          forma_pago: paymentMethod,
          moneda: currency,
          prefijo: selectedPrefix,
          observaciones: notes.trim() || undefined,
          tipo_documento: tipoDoc,
          tipo_factura: tipoFactura,
        },
        totales: {
          TotalMonetario: {
            ValorBruto: { IdMoneda: currency, Value: totals.valorBruto },
            ValorBaseImpuestos: { IdMoneda: currency, Value: totals.subtotal },
            TotalMasImpuestos: { IdMoneda: currency, Value: totals.total },
            ValorAPagar: { IdMoneda: currency, Value: totals.total },
          },
        },
      });

      successToast(result.message || "Factura creada correctamente");
      const facturaId = result.factura?._id || result._id || result.id;
      if (facturaId) {
        navigate(`/documentos/${facturaId}`);
      } else {
        navigate(PATHS.DOCUMENTS);
      }
    } catch (error) {
      errorToast(error instanceof Error ? error.message : "Error al crear la factura");
    } finally {
      setSubmitting(false);
    }
  };

  if (bootLoading) return <LoadingScreen />;

  if (showPrefixSetup) {
    return (
      <PrefixSetupGateNative
        onBack={isDocumentFlow ? () => navigate(PATHS.DOCUMENTS) : undefined}
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.pageBg }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        {isDocumentFlow ? (
          <Pressable onPress={() => navigate(PATHS.DOCUMENTS)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={colors.accent} />
          </Pressable>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.primary }]}>
            {isDocumentFlow ? "Nueva factura" : "Facturar"}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            Crear factura electrónica de venta
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.paddingBottom + 80 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View
          style={[
            styles.card,
            getSoftCardShadow(colors),
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Prefijo</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {prefixes.map((p) => (
              <Pressable
                key={p.prefix}
                style={[
                  styles.chip,
                  selectedPrefix === p.prefix
                    ? { backgroundColor: colors.accent }
                    : { borderColor: colors.border },
                ]}
                onPress={() => setSelectedPrefix(p.prefix)}
              >
                <Text
                  style={{
                    color: selectedPrefix === p.prefix ? "#fff" : colors.primaryText,
                    fontWeight: "600",
                  }}
                >
                  {p.prefix}
                  {p.default ? " ★" : ""}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View
          style={[
            styles.card,
            getSoftCardShadow(colors),
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Cliente</Text>
          <Pressable
            style={[styles.selectBtn, { borderColor: colors.border, backgroundColor: colors.bgSubtle }]}
            onPress={() => setClientModalOpen(true)}
          >
            <Ionicons name="person-outline" size={18} color={colors.accent} />
            <Text style={[styles.selectText, { color: colors.primaryText }]}>
              {selectedClient
                ? `${selectedClient.name} (${selectedClient.doc_type} ${selectedClient.doc_number})`
                : "Seleccionar cliente"}
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.card,
            getSoftCardShadow(colors),
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <View style={styles.rowBetween}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Ítems</Text>
            <Pressable
              onPress={() => setItemModalOpen(true)}
              style={[styles.addItemBtn, { backgroundColor: colors.accent }]}
            >
              <Ionicons name="add" size={18} color="#fff" />
              <Text style={styles.addItemText}>Agregar</Text>
            </Pressable>
          </View>

          {items.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textMuted }]}>
              Sin ítems — agrega productos o servicios
            </Text>
          ) : (
            items.map((item) => (
              <View key={item.id} style={[styles.lineItem, { borderColor: colors.border }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.lineName, { color: colors.primaryText }]}>{item.name}</Text>
                  <Text style={[styles.lineMeta, { color: colors.textMuted }]}>
                    {item.quantity} × ${item.price.toLocaleString("es-CO")} · IVA {item.iva}%
                  </Text>
                </View>
                <Text style={[styles.lineTotal, { color: colors.primary }]}>
                  ${calcLineTotal(item.price, item.quantity, item.iva).toLocaleString("es-CO")}
                </Text>
                <Pressable onPress={() => removeItem(item.id)}>
                  <Ionicons name="close-circle" size={22} color="#dc2626" />
                </Pressable>
              </View>
            ))
          )}

          <View style={[styles.totalsBox, { backgroundColor: colors.bgSubtle }]}>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>Subtotal</Text>
            <Text style={[styles.totalValue, { color: colors.primaryText }]}>
              ${totals.subtotal.toLocaleString("es-CO")}
            </Text>
            <Text style={[styles.totalLabel, { color: colors.textMuted }]}>IVA</Text>
            <Text style={[styles.totalValue, { color: colors.primaryText }]}>
              ${totals.totalTax.toLocaleString("es-CO")}
            </Text>
            <Text style={[styles.grandTotal, { color: colors.primary }]}>Total</Text>
            <Text style={[styles.grandTotalValue, { color: colors.primary }]}>
              ${totals.total.toLocaleString("es-CO")} {currency}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.card,
            getSoftCardShadow(colors),
            { backgroundColor: colors.cardBg, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.sectionTitle, { color: colors.primary }]}>Forma de pago</Text>
          <View style={styles.payRow}>
            {PAYMENT_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={[
                  styles.chip,
                  paymentMethod === opt.value
                    ? { backgroundColor: colors.accent }
                    : { borderColor: colors.border },
                ]}
                onPress={() => setPaymentMethod(opt.value)}
              >
                <Text style={{ color: paymentMethod === opt.value ? "#fff" : colors.primaryText }}>
                  {opt.label}
                </Text>
              </Pressable>
            ))}
          </View>
          {paymentMethod === "2" ? (
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgSubtle,
                  borderColor: colors.border,
                  color: colors.primaryText,
                },
              ]}
              value={dueDate}
              onChangeText={setDueDate}
              placeholder="Fecha vencimiento AAAA-MM-DD"
              placeholderTextColor={colors.textMuted}
            />
          ) : null}
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.bgSubtle,
                borderColor: colors.border,
                color: colors.primaryText,
              },
            ]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Observaciones (opcional)"
            placeholderTextColor={colors.textMuted}
            multiline
          />
        </View>
      </ScrollView>

      <View
        style={[
          styles.footer,
          {
            borderTopColor: colors.border,
            paddingBottom: insets.paddingBottom + 8,
            backgroundColor: colors.cardBg,
          },
        ]}
      >
        <Pressable
          style={[styles.createBtn, { backgroundColor: colors.accent, opacity: submitting ? 0.7 : 1 }]}
          disabled={submitting}
          onPress={() => void handleCreate()}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="document-text-outline" size={20} color="#fff" />
              <Text style={styles.createBtnText}>Crear factura</Text>
            </>
          )}
        </Pressable>
      </View>

      <Modal visible={clientModalOpen} animationType="slide" onRequestClose={() => setClientModalOpen(false)}>
        <View style={[styles.modalFull, { backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setClientModalOpen(false)}>
              <Ionicons name="close" size={24} color={colors.primaryText} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.primary }]}>Seleccionar cliente</Text>
            <View style={{ width: 24 }} />
          </View>
          <TextInput
            style={[
              styles.input,
              {
                margin: 16,
                backgroundColor: colors.cardBg,
                borderColor: colors.border,
                color: colors.primaryText,
              },
            ]}
            value={clientQuery}
            onChangeText={setClientQuery}
            placeholder="Buscar por nombre o documento"
            placeholderTextColor={colors.textMuted}
          />
          {clientLoading ? (
            <ActivityIndicator color={colors.accent} style={{ marginTop: 24 }} />
          ) : (
            <ScrollView contentContainerStyle={{ padding: 16, gap: 8 }}>
              {clientResults.map((c) => (
                <Pressable
                  key={c._id}
                  style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                  onPress={() => {
                    setSelectedClient(c);
                    setClientModalOpen(false);
                  }}
                >
                  <Text style={[styles.pickTitle, { color: colors.primaryText }]}>{c.name}</Text>
                  <Text style={[styles.pickMeta, { color: colors.textMuted }]}>
                    {c.doc_type} {c.doc_number} · {c.email}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      </Modal>

      <Modal visible={itemModalOpen} animationType="slide" onRequestClose={() => setItemModalOpen(false)}>
        <View style={[styles.modalFull, { backgroundColor: colors.pageBg, paddingTop: insets.paddingTop }]}>
          <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
            <Pressable onPress={() => setItemModalOpen(false)}>
              <Ionicons name="close" size={24} color={colors.primaryText} />
            </Pressable>
            <Text style={[styles.modalHeaderTitle, { color: colors.primary }]}>Agregar ítem</Text>
            <View style={{ width: 24 }} />
          </View>

          <View style={{ padding: 16, gap: 10 }}>
            <Text style={[styles.sectionTitle, { color: colors.primary }]}>Manual</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText },
              ]}
              value={manualName}
              onChangeText={setManualName}
              placeholder="Nombre"
              placeholderTextColor={colors.textMuted}
            />
            <View style={styles.manualRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.flex1,
                  { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={manualPrice}
                onChangeText={setManualPrice}
                placeholder="Precio"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.flex1,
                  { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={manualQty}
                onChangeText={setManualQty}
                placeholder="Cant."
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
              <TextInput
                style={[
                  styles.input,
                  styles.flex1,
                  { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText },
                ]}
                value={manualIva}
                onChangeText={setManualIva}
                placeholder="IVA %"
                keyboardType="decimal-pad"
                placeholderTextColor={colors.textMuted}
              />
            </View>
            <Pressable style={[styles.createBtn, { backgroundColor: colors.accent }]} onPress={addManualItem}>
              <Text style={styles.createBtnText}>Agregar manual</Text>
            </Pressable>

            <Text style={[styles.sectionTitle, { color: colors.primary, marginTop: 8 }]}>Catálogo</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: colors.cardBg, borderColor: colors.border, color: colors.primaryText },
              ]}
              value={itemQuery}
              onChangeText={setItemQuery}
              placeholder="Buscar producto o servicio"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {itemLoading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32, gap: 8 }}>
              {itemResults.map((p) => (
                <Pressable
                  key={p._id ?? p.code ?? p.name}
                  style={[styles.pickRow, { borderColor: colors.border, backgroundColor: colors.cardBg }]}
                  onPress={() => addCatalogItem(p)}
                >
                  <Text style={[styles.pickTitle, { color: colors.primaryText }]}>{p.name}</Text>
                  <Text style={[styles.pickMeta, { color: colors.textMuted }]}>
                    ${p.price.toLocaleString("es-CO")} · IVA {p.taxes?.iva ?? 19}%
                  </Text>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backBtn: { padding: 6 },
  title: { fontSize: 20, fontWeight: "700" },
  subtitle: { fontSize: 13 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: SHELL_RADIUS.menuItem, padding: 14, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, marginRight: 8 },
  selectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  selectText: { flex: 1, fontSize: 14 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  addItemBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  addItemText: { color: "#fff", fontWeight: "600", fontSize: 13 },
  empty: { fontSize: 13, textAlign: "center", paddingVertical: 8 },
  lineItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lineName: { fontSize: 14, fontWeight: "600" },
  lineMeta: { fontSize: 12 },
  lineTotal: { fontSize: 14, fontWeight: "700" },
  totalsBox: { borderRadius: 10, padding: 12, marginTop: 8, gap: 4 },
  totalLabel: { fontSize: 12 },
  totalValue: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  grandTotal: { fontSize: 14, fontWeight: "700", marginTop: 4 },
  grandTotalValue: { fontSize: 18, fontWeight: "800" },
  payRow: { flexDirection: "row", gap: 8 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: SHELL_RADIUS.button,
  },
  createBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalFull: { flex: 1 },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalHeaderTitle: { fontSize: 17, fontWeight: "700" },
  pickRow: { borderWidth: 1, borderRadius: 10, padding: 12 },
  pickTitle: { fontSize: 14, fontWeight: "600" },
  pickMeta: { fontSize: 12, marginTop: 2 },
  manualRow: { flexDirection: "row", gap: 8 },
  flex1: { flex: 1 },
});

import { useEffect, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { LedgerChip, LedgerChipRow, LedgerField, LedgerPrimaryBtn } from "../ledger/LedgerUi.native";
import { createItem, updateItem } from "../../../services/items.service";
import type { CreateItemRequest, ItemData } from "../../../types";
import { errorToast, successToast } from "../../shared/toast/toasts";
import { useThemeColors } from "../../../theme/useThemeColors";

type Props = {
  visible: boolean;
  item?: ItemData | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ItemFormModalNative({ visible, item, onClose, onSaved }: Props) {
  const colors = useThemeColors();
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [description, setDescription] = useState("");
  const [kind, setKind] = useState<"product" | "service">("product");
  const [iva, setIva] = useState("19");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (item) {
      setName(item.name);
      setCode(item.code || "");
      setPrice(String(item.price));
      setQuantity(String(item.quantity ?? 1));
      setDescription(item.description || "");
      setKind(item.kind);
      setIva(String(item.taxes?.iva ?? 19));
    } else {
      setName("");
      setCode("");
      setPrice("");
      setQuantity("1");
      setDescription("");
      setKind("product");
      setIva("19");
    }
  }, [visible, item]);

  const save = async () => {
    if (!name.trim() || !price) {
      errorToast("Nombre y precio son obligatorios");
      return;
    }
    const payload: CreateItemRequest = {
      name: name.trim(),
      code: code.trim() || undefined,
      price: Number(price) || 0,
      quantity: Number(quantity) || 1,
      description: description.trim(),
      kind,
      taxes: { iva: Number(iva) || 0, other: 0 },
    };
    setSaving(true);
    try {
      if (item?._id) await updateItem(item._id, payload);
      else await createItem(payload);
      successToast(item ? "Item actualizado" : "Item creado");
      onSaved();
    } catch (e) {
      errorToast(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.wrap, { backgroundColor: colors.pageBg }]}>
        <View style={[styles.head, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.primary }]}>{item ? "Editar item" : "Nuevo item"}</Text>
          <Pressable onPress={onClose}><Text style={{ color: colors.accent, fontWeight: "600" }}>Cerrar</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <LedgerChipRow>
            <LedgerChip label="Producto" active={kind === "product"} onPress={() => setKind("product")} />
            <LedgerChip label="Servicio" active={kind === "service"} onPress={() => setKind("service")} />
          </LedgerChipRow>
          <LedgerField label="Nombre *" value={name} onChangeText={setName} />
          <LedgerField label="Código" value={code} onChangeText={setCode} />
          <LedgerField label="Precio *" value={price} onChangeText={setPrice} keyboardType="numeric" />
          <LedgerField label="Cantidad stock" value={quantity} onChangeText={setQuantity} keyboardType="numeric" />
          <LedgerField label="IVA %" value={iva} onChangeText={setIva} keyboardType="numeric" />
          <LedgerField label="Descripción" value={description} onChangeText={setDescription} multiline />
          <LedgerPrimaryBtn label="Guardar" onPress={save} loading={saving} />
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, paddingTop: 48 },
  head: { flexDirection: "row", justifyContent: "space-between", padding: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  title: { fontSize: 18, fontWeight: "700" },
  body: { padding: 16, paddingBottom: 40 },
});

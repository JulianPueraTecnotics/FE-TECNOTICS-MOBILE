import { useEffect, useState } from "react";
import { LedgerChip, LedgerChipRow, LedgerField } from "../ledger/LedgerUi.native";
import { DsSideModal } from "../../design-system-native";
import { createItem, updateItem } from "../../../services/items.service";
import type { CreateItemRequest, ItemData } from "../../../types";
import { errorToast, successToast } from "../../shared/toast/toasts";

type Props = {
  visible: boolean;
  item?: ItemData | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function ItemFormModalNative({ visible, item, onClose, onSaved }: Props) {
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
    <DsSideModal
      visible={visible}
      onClose={onClose}
      title={item ? "Editar item" : "Nuevo item"}
      icon="cube-outline"
      closeDisabled={saving}
      submitting={saving}
      onSubmit={() => void save()}
    >
      <LedgerChipRow>
        <LedgerChip label="Producto" active={kind === "product"} onPress={() => setKind("product")} />
        <LedgerChip label="Servicio" active={kind === "service"} onPress={() => setKind("service")} />
      </LedgerChipRow>
      <LedgerField label="Nombre *" value={name} onChangeText={setName} icon="pricetag-outline" />
      <LedgerField label="Código" value={code} onChangeText={setCode} icon="barcode-outline" />
      <LedgerField label="Precio *" value={price} onChangeText={setPrice} keyboardType="numeric" icon="cash-outline" />
      <LedgerField label="Cantidad stock" value={quantity} onChangeText={setQuantity} keyboardType="numeric" icon="layers-outline" />
      <LedgerField label="IVA %" value={iva} onChangeText={setIva} keyboardType="numeric" icon="calculator-outline" />
      <LedgerField label="Descripción" value={description} onChangeText={setDescription} multiline icon="document-text-outline" />
    </DsSideModal>
  );
}

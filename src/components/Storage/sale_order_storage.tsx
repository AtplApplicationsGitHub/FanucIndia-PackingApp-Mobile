// sale_order_storage.ts (unchanged, provided for completeness)
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (so: string) => `order:${so}`;

// Stored item shape (now includes issuedQty)
export type StoredMaterialItem = {
  materialCode: string;
  description: string;
  binNo: string;
  requiredQty: number;
  issuedQty: number; // <= NEW
};

export type StoredOrder = {
  saleOrderNumber: string;
  orderDetails: StoredMaterialItem[];
  // derived: an order is "complete" when every item issuedQty >= requiredQty
};

export async function saveOrderDetails(
  saleOrderNumber: string,
  items: Omit<StoredMaterialItem, "issuedQty">[] | StoredMaterialItem[]
): Promise<void> {
  // normalize: ensure each item has issuedQty
  const normalized: StoredMaterialItem[] = (items as StoredMaterialItem[]).map(
    (it) => ({
      materialCode: it.materialCode,
      description: it.description,
      binNo: it.binNo,
      requiredQty: it.requiredQty,
      issuedQty: Math.max(0, Math.min(it.issuedQty ?? 0, it.requiredQty)),
    })
  );
  const payload: StoredOrder = { saleOrderNumber, orderDetails: normalized };
  await AsyncStorage.setItem(KEY(saleOrderNumber), JSON.stringify(payload));
}

export async function getOrderDetails(
  saleOrderNumber: string
): Promise<StoredOrder | null> {
  const raw = await AsyncStorage.getItem(KEY(saleOrderNumber));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredOrder;

    // backfill issuedQty if older data exists
    parsed.orderDetails = parsed.orderDetails.map((it) => ({
      ...it,
      issuedQty: Math.max(0, Math.min((it as any).issuedQty ?? 0, it.requiredQty)),
    }));
    return parsed;
  } catch {
    return null;
  }
}

export async function hasOrderDetails(saleOrderNumber: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY(saleOrderNumber));
  return !!raw;
}

// Increment/decrement/set issued and autosave
export async function updateIssuedQty(
  saleOrderNumber: string,
  materialCode: string,
  action: "inc" | "dec" | "set" = "inc",
  valueOrStep = 1
): Promise<StoredOrder | null> {
  const current = await getOrderDetails(saleOrderNumber);
  if (!current) return null;

  const items = current.orderDetails.map((it) => {
    if (it.materialCode !== materialCode) return it;

    const clamp = (n: number) => Math.max(0, Math.min(n, it.requiredQty));
    if (action === "set") {
      return { ...it, issuedQty: clamp(Number(valueOrStep) || 0) };
    }
    if (action === "dec") {
      return { ...it, issuedQty: clamp((it.issuedQty ?? 0) - Number(valueOrStep || 1)) };
    }
    // inc
    return { ...it, issuedQty: clamp((it.issuedQty ?? 0) + Number(valueOrStep || 1)) };
  });

  await saveOrderDetails(saleOrderNumber, items);
  return { saleOrderNumber, orderDetails: items };
}

export function isOrderCompleted(order: StoredOrder): boolean {
  return order.orderDetails.every((it) => (it.issuedQty ?? 0) >= it.requiredQty);
}

export async function isOrderCompletedBySO(saleOrderNumber: string): Promise<boolean> {
  const ord = await getOrderDetails(saleOrderNumber);
  return !!ord && isOrderCompleted(ord);
}
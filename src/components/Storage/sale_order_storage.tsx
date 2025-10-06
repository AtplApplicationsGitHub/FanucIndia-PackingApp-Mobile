// src/Storage/sale_order_storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (so: string) => `order:${so}`;

// Stored item shape (now includes issuedQty, packedQty, and additional fields)
export type StoredMaterialItem = {
  materialCode: string;
  description: string;
  batchNo: string;
  soDonorBatch: string;
  certNo: string;
  binNo: string;
  adf: string;
  requiredQty: number;
  issuedQty: number;
  packedQty: number;
};

export type StoredOrder = {
  saleOrderNumber: string;
  orderDetails: StoredMaterialItem[];
  // derived: an order is "complete" when every item issuedQty >= requiredQty
};

export async function saveOrderDetails(
  saleOrderNumber: string,
  items: StoredMaterialItem[]
): Promise<void> {
  // normalize: ensure each item has issuedQty and packedQty clamped
  const normalized: StoredMaterialItem[] = items.map((it) => ({
    materialCode: it.materialCode || "",
    description: it.description || "",
    batchNo: it.batchNo || "",
    soDonorBatch: it.soDonorBatch || "",
    certNo: it.certNo || "",
    binNo: it.binNo || "",
    adf: it.adf || "",
    requiredQty: Number(it.requiredQty) || 0,
    issuedQty: Math.max(0, Math.min(it.issuedQty, it.requiredQty)),
    packedQty: Math.max(0, Math.min(it.packedQty || 0, it.requiredQty)),
  }));
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
    // Ensure issuedQty and packedQty are present and clamped (for legacy data)
    parsed.orderDetails = parsed.orderDetails.map((it) => ({
      ...it,
      issuedQty: Math.max(0, Math.min(it.issuedQty ?? 0, it.requiredQty)),
      packedQty: Math.max(0, Math.min(it.packedQty ?? 0, it.requiredQty)),
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

export async function deleteOrderDetails(saleOrderNumber: string): Promise<void> {
  await AsyncStorage.removeItem(KEY(saleOrderNumber));
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

// Increment/decrement/set packed and autosave
export async function updatePackedQty(
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
      return { ...it, packedQty: clamp(Number(valueOrStep) || 0) };
    }
    if (action === "dec") {
      return { ...it, packedQty: clamp((it.packedQty ?? 0) - Number(valueOrStep || 1)) };
    }
    // inc
    return { ...it, packedQty: clamp((it.packedQty ?? 0) + Number(valueOrStep || 1)) };
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
// src/Storage/sale_order_storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (so: string) => `order:${so}`;

// Updated item with timestamps
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
  issuedAt?: string;   // e.g., "2025-10-30T08:35:10.000Z"
  packedAt?: string;   // e.g., "2025-10-30T09:00:00.000Z"
};

export type StoredOrder = {
  saleOrderNumber: string;
  orderDetails: StoredMaterialItem[];
};

export async function saveOrderDetails(
  saleOrderNumber: string,
  items: StoredMaterialItem[]
): Promise<void> {
  const normalized: StoredMaterialItem[] = items.map((it) => ({
    ...it,
    materialCode: it.materialCode || "",
    description: it.description || "",
    batchNo: it.batchNo || "",
    soDonorBatch: it.soDonorBatch || "",
    certNo: it.certNo || "",
    binNo: it.binNo || "",
    adf: it.adf || "",
    requiredQty: Number(it.requiredQty) || 0,
    issuedQty: Math.max(0, Math.min(it.issuedQty ?? 0, it.requiredQty)),
    packedQty: Math.max(0, Math.min(it.packedQty ?? 0, it.requiredQty)),
    issuedAt: it.issuedAt || undefined,
    packedAt: it.packedAt || undefined,
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
    parsed.orderDetails = parsed.orderDetails.map((it) => ({
      ...it,
      issuedQty: Math.max(0, Math.min(it.issuedQty ?? 0, it.requiredQty)),
      packedQty: Math.max(0, Math.min(it.packedQty ?? 0, it.requiredQty)),
      issuedAt: it.issuedAt || undefined,
      packedAt: it.packedAt || undefined,
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

// Update issued with timestamp
export async function updateIssuedQty(
  saleOrderNumber: string,
  materialCode: string,
  action: "inc" | "dec" | "set" = "inc",
  valueOrStep = 1
): Promise<StoredOrder | null> {
  const current = await getOrderDetails(saleOrderNumber);
  if (!current) return null;

  const now = new Date().toISOString(); // UTC ISO string

  const items = current.orderDetails.map((it) => {
    if (it.materialCode !== materialCode) return it;

    const clamp = (n: number) => Math.max(0, Math.min(n, it.requiredQty));
    let newQty = it.issuedQty ?? 0;

    if (action === "set") {
      newQty = clamp(Number(valueOrStep) || 0);
    } else if (action === "dec") {
      newQty = clamp(newQty - Number(valueOrStep || 1));
    } else {
      newQty = clamp(newQty + Number(valueOrStep || 1));
    }

    // Set timestamp only when issuedQty reaches requiredQty for the first time
    const wasComplete = (it.issuedQty ?? 0) >= it.requiredQty;
    const isComplete = newQty >= it.requiredQty;

    return {
      ...it,
      issuedQty: newQty,
      issuedAt: !wasComplete && isComplete ? now : it.issuedAt,
    };
  });

  await saveOrderDetails(saleOrderNumber, items);
  return { saleOrderNumber, orderDetails: items };
}

// Update packed with timestamp
export async function updatePackedQty(
  saleOrderNumber: string,
  materialCode: string,
  action: "inc" | "dec" | "set" = "inc",
  valueOrStep = 1
): Promise<StoredOrder | null> {
  const current = await getOrderDetails(saleOrderNumber);
  if (!current) return null;

  const now = new Date().toISOString();

  const items = current.orderDetails.map((it) => {
    if (it.materialCode !== materialCode) return it;

    const clamp = (n: number) => Math.max(0, Math.min(n, it.requiredQty));
    let newQty = it.packedQty ?? 0;

    if (action === "set") {
      newQty = clamp(Number(valueOrStep) || 0);
    } else if (action === "dec") {
      newQty = clamp(newQty - Number(valueOrStep || 1));
    } else {
      newQty = clamp(newQty + Number(valueOrStep || 1));
    }

    const wasComplete = (it.packedQty ?? 0) >= it.requiredQty;
    const isComplete = newQty >= it.requiredQty;

    return {
      ...it,
      packedQty: newQty,
      packedAt: !wasComplete && isComplete ? now : it.packedAt,
    };
  });

  await saveOrderDetails(saleOrderNumber, items);
  return { saleOrderNumber, orderDetails: items };
}

export function isOrderIssuedComplete(order: StoredOrder): boolean {
  return order.orderDetails.every((it) => (it.issuedQty ?? 0) >= it.requiredQty);
}

export function isOrderPackedComplete(order: StoredOrder): boolean {
  return order.orderDetails.every((it) => (it.packedQty ?? 0) >= it.requiredQty);
}

export async function isOrderIssuedCompleteBySO(saleOrderNumber: string): Promise<boolean> {
  const ord = await getOrderDetails(saleOrderNumber);
  return !!ord && isOrderIssuedComplete(ord);
}

export async function isOrderPackedCompleteBySO(saleOrderNumber: string): Promise<boolean> {
  const ord = await getOrderDetails(saleOrderNumber);
  return !!ord && isOrderPackedComplete(ord);
}
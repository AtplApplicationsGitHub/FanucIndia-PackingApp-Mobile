// src/Storage/sale_order_storage.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = (so: string) => `order:${so}`;

// The compact shape we store locally
export type StoredMaterialItem = {
  materialCode: string;
  description: string;
  binNo: string;
  requiredQty: number;
};

export type StoredOrder = {
  saleOrderNumber: string;
  orderDetails: StoredMaterialItem[];
};

export async function saveOrderDetails(
  saleOrderNumber: string,
  items: StoredMaterialItem[]
): Promise<void> {
  const payload: StoredOrder = {
    saleOrderNumber,
    orderDetails: items,
  };
  await AsyncStorage.setItem(KEY(saleOrderNumber), JSON.stringify(payload));
}

export async function getOrderDetails(
  saleOrderNumber: string
): Promise<StoredOrder | null> {
  const raw = await AsyncStorage.getItem(KEY(saleOrderNumber));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredOrder;
  } catch {
    return null;
  }
}

export async function hasOrderDetails(saleOrderNumber: string): Promise<boolean> {
  const raw = await AsyncStorage.getItem(KEY(saleOrderNumber));
  return !!raw;
}

export async function clearOrderDetails(saleOrderNumber: string): Promise<void> {
  await AsyncStorage.removeItem(KEY(saleOrderNumber));
}

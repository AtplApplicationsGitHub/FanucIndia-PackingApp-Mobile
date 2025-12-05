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
  issuedAt?: string; // e.g., "2025-10-30T08:35:10.000Z"
  packedAt?: string; // e.g., "2025-10-30T09:00:00.000Z"
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

function buildInstanceId(item: StoredMaterialItem, index: number) {
  return `${String(item.batchNo ?? "")}::${String(item.soDonorBatch ?? "")}::idx${index}`;
}

function findTargetIndexForMaterial(
  orderDetails: StoredMaterialItem[],
  materialCode: string,
  instanceIdentifier?: string | number,
  preferIssuedIncomplete = true, 
): number | null {
  if (!orderDetails || orderDetails.length === 0) return null;

  // numeric index provided
  if (typeof instanceIdentifier === "number") {
    const idx = instanceIdentifier;
    if (idx >= 0 && idx < orderDetails.length) {
      if (String(orderDetails[idx].materialCode) === String(materialCode)) {
        return idx;
      } else {
        console.warn(
          `update: provided index ${idx} has different materialCode (${orderDetails[idx].materialCode}) than requested (${materialCode}). Falling back.`
        );
      }
    } else {
      console.warn(`update: provided index ${idx} out of bounds. Falling back.`);
    }
  }

  if (typeof instanceIdentifier === "string" && instanceIdentifier.trim() !== "") {
    const id = instanceIdentifier.trim();

    for (let i = 0; i < orderDetails.length; i++) {
      const it = orderDetails[i];
      if (String(it.materialCode) !== String(materialCode)) continue;
      const rowInstance = buildInstanceId(it, i);
      if (rowInstance === id) return i;
    }
    for (let i = 0; i < orderDetails.length; i++) {
      const it = orderDetails[i];
      if (String(it.materialCode) !== String(materialCode)) continue;
      if (String(it.batchNo) === id || String(it.soDonorBatch) === id) return i;
    }

    for (let i = 0; i < orderDetails.length; i++) {
      const it = orderDetails[i];
      if (String(it.materialCode) !== String(materialCode)) continue;
      const bn = String(it.batchNo ?? "");
      const sb = String(it.soDonorBatch ?? "");
      if ((bn && bn.includes(id)) || (sb && sb.includes(id))) return i;
    }
    const numericId = id.replace(/\D/g, "");
    if (numericId) {
      for (let i = 0; i < orderDetails.length; i++) {
        const it = orderDetails[i];
        if (String(it.materialCode) !== String(materialCode)) continue;
        const bnNum = String(it.batchNo ?? "").replace(/\D/g, "");
        const sbNum = String(it.soDonorBatch ?? "").replace(/\D/g, "");
        if (bnNum === numericId || sbNum === numericId) return i;
      }
    }
    console.warn(`update: instanceIdentifier="${instanceIdentifier}" didn't match exact instanceId; falling back to safer selection.`);
  }
  let fallbackIndex: number | null = null;
  for (let i = 0; i < orderDetails.length; i++) {
    const it = orderDetails[i];
    if (String(it.materialCode) !== String(materialCode)) continue;
    const issuedIncomplete = (it.issuedQty ?? 0) < (it.requiredQty ?? 0);
    const packedIncomplete = (it.packedQty ?? 0) < (it.requiredQty ?? 0);

    if (preferIssuedIncomplete ? issuedIncomplete : packedIncomplete) {
      return i;
    }
    if (fallbackIndex === null) fallbackIndex = i;
  }
  return fallbackIndex;
}


export async function updateIssuedQty(
  saleOrderNumber: string,
  materialCode: string,
  action: "inc" | "dec" | "set" = "inc",
  valueOrStep: number | string = 1,
  instanceIdentifier?: string | number
): Promise<StoredOrder | null> {
  const current = await getOrderDetails(saleOrderNumber);
  if (!current) return null;

  const now = new Date().toISOString(); // UTC ISO string

  const targetIndex = findTargetIndexForMaterial(current.orderDetails, materialCode, instanceIdentifier, true);
  if (targetIndex === null) {
    console.warn(`updateIssuedQty: no rows found with materialCode="${materialCode}"`);
    return null;
  }

  const items = current.orderDetails.map((it, idx) => {
    if (idx !== targetIndex) return it;

    const clamp = (n: number) => Math.max(0, Math.min(n, it.requiredQty));
    let newQty = it.issuedQty ?? 0;

    if (action === "set") {
      newQty = clamp(Number(valueOrStep) || 0);
    } else if (action === "dec") {
      newQty = clamp(newQty - Number(valueOrStep || 1));
    } else {
      newQty = clamp(newQty + Number(valueOrStep || 1));
    }

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

export async function updatePackedQty(
  saleOrderNumber: string,
  materialCode: string,
  action: "inc" | "dec" | "set" = "inc",
  valueOrStep: number | string = 1,
  instanceIdentifier?: string | number
): Promise<StoredOrder | null> {
  const current = await getOrderDetails(saleOrderNumber);
  if (!current) return null;

  const now = new Date().toISOString();

  const targetIndex = findTargetIndexForMaterial(current.orderDetails, materialCode, instanceIdentifier, false);
  if (targetIndex === null) {
    console.warn(`updatePackedQty: no rows found with materialCode="${materialCode}"`);
    return null;
  }

  const items = current.orderDetails.map((it, idx) => {
    if (idx !== targetIndex) return it;

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

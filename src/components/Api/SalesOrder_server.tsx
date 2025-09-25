// src/Api/SalesOrder_server.ts
import * as SecureStore from "expo-secure-store";
import { saveOrderDetails, type StoredMaterialItem } from "../Storage/sale_order_storage";

const BASE_URL = "https://fanuc.goval.app:444/api";
const ORDERS_SUMMARY_URL = `${BASE_URL}/user-dashboard/orders-summary`;
const ORDER_DETAILS_URL = `${BASE_URL}/user-dashboard/orders/son/{SO_NUMBER}/download-details`;

const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("Request timed out")), ms)
    ),
  ]);

async function parseErrorBody(res: Response) {
  try {
    const data = await res.clone().json();
    return (data as any)?.message || (data as any)?.error || JSON.stringify(data);
  } catch {
    try {
      return (await res.clone().text()).slice(0, 400);
    } catch {
      return "Unknown server error";
    }
  }
}

export type OrdersSummaryItemRaw = {
  saleOrderNumber: string;
  priority: 1 | 2 | 3 | null;
  status: string;
  totalMaterials: number;
  totalItems: number;
};

export type OrdersSummaryItem = {
  id: string;
  saleOrderNumber: string;
  priority: 1 | 2 | 3 | null;
  status: string;
  totalMaterials: number;
  totalItems: number;
};

export async function fetchOrdersSummary(token?: string): Promise<OrdersSummaryItem[]> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await withTimeout(
    fetch(ORDERS_SUMMARY_URL, { method: "GET", headers })
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to fetch orders (${res.status}): ${msg}`);
  }

  const json: OrdersSummaryItemRaw[] = await res.json();

  return (json || []).map((r) => ({
    id: r.saleOrderNumber?.toString() || Math.random().toString(36).slice(2),
    saleOrderNumber: r.saleOrderNumber?.toString() || "-",
    priority: (r.priority as 1 | 2 | 3 | null) ?? null,
    status: r.status ?? "-",
    totalMaterials: Number.isFinite(r.totalMaterials) ? r.totalMaterials : 0,
    totalItems: Number.isFinite(r.totalItems) ? r.totalItems : 0,
  }));
}

/**
 * Download details for an SO, but only persist the requested fields locally:
 * Material Code, Description, Bin No, Required Qty
 */
export async function downloadOrderDetails(
  saleOrderNumber: string,
  token?: string
): Promise<StoredMaterialItem[]> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = ORDER_DETAILS_URL.replace("{SO_NUMBER}", saleOrderNumber);

  const res = await withTimeout(fetch(url, { method: "GET", headers }));

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to download order details (${res.status}): ${msg}`);
  }

  const json = (await res.json()) as any[];

  // Keep ONLY the four fields (mapping to a compact, app-friendly shape)
  const compact: StoredMaterialItem[] = (Array.isArray(json) ? json : []).map((row) => ({
    materialCode: row?.Material_Code?.toString?.() ?? "-",
    description: row?.Material_Description?.toString?.() ?? "-",
    binNo: row?.Bin_No?.toString?.() ?? "-",
    requiredQty: Number.isFinite(row?.Required_Qty) ? Number(row.Required_Qty) : 0,
  }));

  // Persist locally
  await saveOrderDetails(saleOrderNumber, compact);

  return compact;
}

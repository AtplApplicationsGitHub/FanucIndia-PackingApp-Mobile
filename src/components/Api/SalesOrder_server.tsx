// src/Api/orders.ts
import * as SecureStore from "expo-secure-store";

const BASE_URL = "https://fanuc.goval.app:444/api";
const ORDERS_SUMMARY_URL = `${BASE_URL}/user-dashboard/orders-summary`;

const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Request timed out")), ms)),
  ]);

async function parseErrorBody(res: Response) {
  try {
    const data = await res.clone().json();
    return data?.message || data?.error || JSON.stringify(data);
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
  priority: 1 | 2 | 3 | null;      // API may return null
  status: string;                   // e.g. "F105"
  totalMaterials: number;
  totalItems: number;
};

// UI-friendly shape
export type OrdersSummaryItem = {
  id: string;                       // derived from saleOrderNumber
  saleOrderNumber: string;
  priority: 1 | 2 | 3 | null;
  status: string;
  totalMaterials: number;
  totalItems: number;
};

export async function fetchOrdersSummary(
  token?: string
): Promise<OrdersSummaryItem[]> {
  // fallback to stored token if not provided
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  const res = await withTimeout(
    fetch(ORDERS_SUMMARY_URL, {
      method: "GET",
      headers,
    })
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to fetch orders (${res.status}): ${msg}`);
  }

  const json: OrdersSummaryItemRaw[] = await res.json();

  // Normalize to UI shape + safe fallbacks
  const list: OrdersSummaryItem[] = (json || []).map((r) => ({
    id: r.saleOrderNumber?.toString() || Math.random().toString(36).slice(2),
    saleOrderNumber: r.saleOrderNumber?.toString() || "-",
    priority: (r.priority as 1 | 2 | 3 | null) ?? null,
    status: r.status ?? "-",
    totalMaterials: Number.isFinite(r.totalMaterials) ? r.totalMaterials : 0,
    totalItems: Number.isFinite(r.totalItems) ? r.totalItems : 0,
  }));

  return list;
}

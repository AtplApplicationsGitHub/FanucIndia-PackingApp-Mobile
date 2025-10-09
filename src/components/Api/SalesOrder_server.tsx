// src/Api/SalesOrder_server.ts
import * as SecureStore from "expo-secure-store";
import { File, Paths } from "expo-file-system";
import { saveOrderDetails, type StoredMaterialItem } from "../Storage/sale_order_storage";

const BASE_URL = "https://fanuc.goval.app:444/api";
const ORDERS_SUMMARY_URL = `${BASE_URL}/user-dashboard/orders-summary`;
const ORDER_DETAILS_URL = `${BASE_URL}/user-dashboard/orders/son/{SO_NUMBER}/download-details`;
const ORDER_UPLOAD_URL = `${BASE_URL}/user-dashboard/orders/son/{SO_NUMBER}/data`;
const ATTACHMENTS_UPLOAD_URL = `${BASE_URL}/user-dashboard/orders/son/{SO_NUMBER}/attachments`;
const EXISTING_ATTACHMENTS_URL = `${BASE_URL}/v1/erp-material-files/by-sale-order/{SO_NUMBER}`;
const UPDATE_ATTACHMENT_DESCRIPTION_URL = `${BASE_URL}/v1/erp-material-files/{FILE_ID}`;

const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Request timed out")), ms)),
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

// ---------------- Types from server ----------------
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

export type AttachmentItem = {
  id?: string; // Added to store FILE_ID for existing attachments
  uri: string;
  name: string;
  type: string;
  description?: string;
};

// ---------------- Helpers ----------------
const toNum = (v: any, d = 0) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : d;
};
const toStr = (v: any, d = "-") => (v === null || v === undefined ? d : String(v));

/** Convert our local item to the exact server field names + numeric types */
function normalizeForUpload(item: StoredMaterialItem) {
  const it: any = item;
  return {
    Material_Code: toStr(it.materialCode, ""),
    Material_Description: toStr(it.description, ""),
    Batch_No: toStr(it.batchNo, ""),
    SO_Donor_Batch: toStr(it.soDonorBatch, ""),
    Cert_No: toStr(it.certNo, ""),
    Bin_No: toStr(it.binNo, ""),
    A_D_F: toStr(it.adf, ""),
    Required_Qty: toNum(it.requiredQty, 0),
    Packing_stage: toNum(it.packedQty, 0),
    Issue_stage: toNum(it.issuedQty, 0),
  };
}

// ---------------- API: GET list ----------------
export async function fetchOrdersSummary(token?: string): Promise<OrdersSummaryItem[]> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await withTimeout(fetch(ORDERS_SUMMARY_URL, { method: "GET", headers }));
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

// ---------------- API: GET order details + save locally ----------------
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

  const compact: StoredMaterialItem[] = (Array.isArray(json) ? json : []).map((row) => ({
    materialCode: toStr(row?.Material_Code, ""),
    description: toStr(row?.Material_Description, ""),
    batchNo: toStr(row?.Batch_No, ""),
    soDonorBatch: toStr(row?.SO_Donor_Batch, ""),
    certNo: toStr(row?.Cert_No, ""),
    binNo: toStr(row?.Bin_No, ""),
    adf: toStr(row?.A_D_F, ""),
    requiredQty: toNum(row?.Required_Qty, 0),
    packedQty: toNum(row?.Packing_stage, 0),
    issuedQty: toNum((row as any)?.Issue_stage, 0),
  })) as any;

  await saveOrderDetails(saleOrderNumber, compact);
  return compact;
}

// ---------------- API: POST (JSON file upload) ----------------
export async function uploadIssueData(
  saleOrderNumber: string,
  items: StoredMaterialItem[],
  token?: string
): Promise<void> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);
  const url = ORDER_UPLOAD_URL.replace("{SO_NUMBER}", saleOrderNumber);

  const baseHeaders: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) baseHeaders.Authorization = `Bearer ${authToken}`;

  const payload = items.map(normalizeForUpload);
  const jsonPayload = JSON.stringify(payload);
  console.log("Uploading (JSON file) materials:", jsonPayload);

  // Write JSON to temporary file for upload in React Native using new File API
  const file = new File(Paths.cache, "data.json");
  await file.create();
  await file.write(jsonPayload);

  const formData = new FormData();
  formData.append("data", {
    uri: file.uri,
    type: "application/json",
    name: "data.json",
  } as any);

  const res = await withTimeout(fetch(url, { 
    method: "POST", 
    headers: baseHeaders, 
    body: formData 
  }), 30000);

  // Clean up temp file
  await file.delete();

  if (!res.ok) {
    const lastErr = await parseErrorBody(res);
    throw new Error(`Upload failed: ${lastErr || "Server rejected upload"}`);
  }

  // Success
  try {
    const result = await res.json();
    console.log("Upload successful:", result);
  } catch {
    console.log("Upload successful (no JSON in response)");
  }
}

// ---------------- API: Upload Attachments ----------------
export async function uploadAttachments(
  saleOrderNumber: string,
  attachments: AttachmentItem[],
  token?: string
): Promise<void> {
  if (attachments.length === 0) {
    throw new Error("No attachments to upload");
  }

  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);
  const url = ATTACHMENTS_UPLOAD_URL.replace("{SO_NUMBER}", saleOrderNumber);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const formData = new FormData();
  
  // Append each file to FormData
  attachments.forEach((attachment, index) => {
    formData.append("attachments", {
      uri: attachment.uri,
      type: attachment.type || "application/octet-stream",
      name: attachment.name,
    } as any);
    // Include description in FormData if provided
    if (attachment.description) {
      formData.append(`descriptions[${index}]`, attachment.description);
    }
  });

  const res = await withTimeout(
    fetch(url, { 
      method: "POST", 
      headers, 
      body: formData 
    }), 
    30000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Attachment upload failed (${res.status}): ${msg}`);
  }

  // Success
  try {
    const result = await res.json();
    console.log("Attachment upload successful:", result);
  } catch {
    console.log("Attachment upload successful (no JSON in response)");
  }
}

// ---------------- API: GET Existing Attachments ----------------
export async function fetchExistingAttachments(
  saleOrderNumber: string,
  token?: string
): Promise<AttachmentItem[]> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = EXISTING_ATTACHMENTS_URL.replace("{SO_NUMBER}", saleOrderNumber);
  const res = await withTimeout(fetch(url, { method: "GET", headers }));

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to fetch existing attachments (${res.status}): ${msg}`);
  }

  const json = await res.json();
  console.log("Existing attachments raw response:", json); // Debug log to check structure
  return (Array.isArray(json) ? json : []).map((item: any) => ({
    id: toStr(item.id, ""), // Store the FILE_ID
    uri: (item.sftpPath || "") as string,
    name: (item.fileName || "Unknown File") as string,
    type: (item.mimeType || "application/octet-stream") as string,
    description: item.description || "",
  }));
}

// ---------------- API: Update Attachment Description ----------------
export async function updateAttachmentDescription(
  fileId: string,
  description: string,
  token?: string
): Promise<void> {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);
  const url = UPDATE_ATTACHMENT_DESCRIPTION_URL.replace("{FILE_ID}", fileId);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const body = JSON.stringify({ description });

  const res = await withTimeout(
    fetch(url, {
      method: "PUT",
      headers,
      body,
    }),
    15000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to update attachment description (${res.status}): ${msg}`);
  }

  // Success
  try {
    const result = await res.json();
    console.log("Attachment description update successful:", result);
  } catch {
    console.log("Attachment description update successful (no JSON in response)");
  }
}
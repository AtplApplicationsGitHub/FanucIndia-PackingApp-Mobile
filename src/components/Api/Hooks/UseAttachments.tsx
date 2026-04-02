import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "../Endpoints";

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
    return (
      (data as any)?.message || (data as any)?.error || JSON.stringify(data)
    );
  } catch {
    try {
      return (await res.clone().text()).slice(0, 400);
    } catch {
      return "Unknown server error";
    }
  }
}

// ---------------- Types ----------------

export interface SoVariant {
  id: number;
  saleOrderNumber: string;
  outboundDelivery: string;
}

export interface AttachmentItem {
  id?: string | null;
  uri: string;
  name: string;
  type: string;
  description?: string;
  createdAt?: string;
}

export interface MobileUploadResponse {
  success: boolean;
  items: Array<{
    ID: number;
    saleOrderNumber: string;
    fileName: string;
    description: string;
    sftpPath: string;
    sftpDir: string;
    fileSizeBytes: number;
    mimeType: string;
    checksumSha256: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

// ---------------- API Hooks ----------------

/**
 * Fetch SO variants (OBDs) for a given Sales Order number
 */
export async function fetchSoVariants(
  soNumber: string,
  token?: string
): Promise<SoVariant[]> {
  const authToken =
    token || (await SecureStore.getItemAsync("authToken")) || undefined;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = API_ENDPOINTS.SALES_ORDER.SO_VARIANTS(soNumber);
  const res = await withTimeout(fetch(url, { method: "GET", headers }));

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to fetch SO variants (${res.status}): ${msg}`);
  }

  const json = await res.json();
  return Array.isArray(json) ? json : [];
}

/**
 * Upload files via mobile-specific endpoint
 */
export async function uploadMobileAttachments(
  saleOrderNumber: string,
  attachments: AttachmentItem[],
  token?: string
): Promise<MobileUploadResponse> {
  if (attachments.length === 0) {
    throw new Error("No attachments to upload");
  }

  const authToken =
    token || (await SecureStore.getItemAsync("authToken")) || undefined;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const formData = new FormData();

  // Append saleOrderNumber
  formData.append("saleOrderNumber", saleOrderNumber);

  // Append all files
  const descriptions: Record<string, string> = {};
  attachments.forEach((attachment) => {
    formData.append("files", {
      uri: attachment.uri,
      type: attachment.type || "application/octet-stream",
      name: attachment.name,
    } as any);
    descriptions[attachment.name] = attachment.description || "";
  });

  // Append descriptions as JSON string
  formData.append("descriptions", JSON.stringify(descriptions));

  const res = await withTimeout(
    fetch(API_ENDPOINTS.SALES_ORDER.MOBILE_UPLOAD, {
      method: "POST",
      headers,
      body: formData,
    }),
    60000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Mobile upload failed (${res.status}): ${msg}`);
  }

  return await res.json();
}

/**
 * Fetch exact files for a specific OBD/SalesOrder ID
 */
export async function fetchMobileAttachments(
  id: string | number,
  token?: string
): Promise<AttachmentItem[]> {
  const authToken =
    token || (await SecureStore.getItemAsync("authToken")) || undefined;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = API_ENDPOINTS.SALES_ORDER.MOBILE_ATTACHMENTS(id);
  const res = await withTimeout(fetch(url, { method: "GET", headers }));

  if (res.status === 404) {
    return [];
  }

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`Failed to fetch mobile attachments (${res.status}): ${msg}`);
  }

  const json = await res.json();
  return (Array.isArray(json) ? json : []).map((item: any) => ({
    id: item.ID ? String(item.ID) : null,
    name: item.fileName || "Unknown File",
    description: item.description || "",
    createdAt: item.createdAt,
    uri: "", // URL not directly provided in list, but usually fileName is enough for some displays
    type: "application/octet-stream", // Fallback
  }));
}

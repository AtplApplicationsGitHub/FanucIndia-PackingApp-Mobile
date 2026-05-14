// material_dispatch_server.tsx
import * as DocumentPicker from "expo-document-picker";
import { useState, useRef, useCallback, useEffect } from "react";
import { API_ENDPOINTS } from "../Endpoints"; // Adjust path if needed
import {
  clearStoredAccessToken,
  getStoredAccessToken,
  persistAccessToken,
} from "./Auth";

export type CreateDispatchHeaderRequest = {
  customerName?: string;
  transporterName: string;     // Required
  address?: string;
  vehicleNumber: string;       // Required
};

export type UpdateDispatchHeaderRequest = {
  customerId?: string;
  customerName?: string;
  address?: string;
  transporterId?: string;
  transporterName?: string;    // Optional in update (but required if updating header meaningfully)
  vehicleNumber?: string;      // Optional in update
};

export type LinkDispatchSORequest = {
  saleOrderNumber: string;
  outboundDelivery: string;
  salesOrderId?: number;
};

export type SOSearchResult = {
  id: number;
  saleOrderNumber: string;
  outboundDelivery: string;
};

export type DispatchSOLink = {
  id: number;
  dispatchId: number;
  saleOrderNumber: string;
  outboundDelivery: string;
  createdAt: string;
};

export type DispatchAttachment = {
  id?: string | number;
  fileName: string;
  path: string;
  mimeType: string;
  size: number;
};

export type Transporter = {
  id: number;
  name: string;
};

export type ApiOk<T = any> = {
  ok: true;
  status: number;
  data: T;
};

export type ApiErr = {
  ok: false;
  status: number;
  error: string;
  raw?: string;
};

export type ApiResult<T = any> = ApiOk<T> | ApiErr;

const TIMEOUT_MS = 300000;
let inMemoryToken: string | null = null;

const withTimeout = <T,>(p: Promise<T>, ms = TIMEOUT_MS) =>
  Promise.race<T>([
    p,
    new Promise<T>((_, rej) => setTimeout(() => rej(new Error("Request timed out")), ms)),
  ]);

async function parseErrorBody(res: Response): Promise<string> {
  try {
    const data = await res.clone().json();
    return (data as any)?.message || (data as any)?.error || JSON.stringify(data);
  } catch {
    try {
      return (await res.clone().text())?.slice(0, 500);
    } catch {
      return `HTTP ${res.status}`;
    }
  }
}

export async function setAccessToken(token: string): Promise<void> {
  const normalized = normalizeToken(token);
  inMemoryToken = normalized;
  if (!normalized) return;
  await persistAccessToken(normalized);
}

export async function clearAccessToken(): Promise<void> {
  inMemoryToken = null;
  await clearStoredAccessToken();
}

async function getToken(opts?: { forceRefresh?: boolean }): Promise<string | null> {
  if (!opts?.forceRefresh && inMemoryToken) return inMemoryToken;
  const token = await getStoredAccessToken({ forceRefresh: opts?.forceRefresh });
  inMemoryToken = normalizeToken(token);
  return inMemoryToken;
}

function normalizeToken(val: string | null | undefined): string | null {
  if (!val) return null;
  let token = String(val).trim();
  if (!token) return null;
  if ((token.startsWith('"') && token.endsWith('"')) || (token.startsWith("'") && token.endsWith("'"))) {
    token = token.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, "").trim();
  }
  return token || null;
}

async function doAuthorizedFetch(
  url: string,
  init: RequestInit,
  opts?: { token?: string }
): Promise<Response> {
  const fallbackHeaders = (init.headers || {}) as Record<string, string>;
  let token = normalizeToken(opts?.token) ?? (await getToken());
  if (!token) throw new Error("Missing access token.");

  const requestWithToken = (tok: string) =>
    withTimeout(
      fetch(url, {
        ...init,
        headers: {
          ...fallbackHeaders,
          Authorization: `Bearer ${tok}`,
        },
      })
    );

  let res = await requestWithToken(token);

  if (res.status === 401) {
    const freshToken = await getToken({ forceRefresh: true });
    if (freshToken && freshToken !== token) {
      token = freshToken;
      inMemoryToken = freshToken;
      res = await requestWithToken(freshToken);
    }
  }

  return res;
}

// CREATE HEADER
export async function createDispatchHeader(
  payload: CreateDispatchHeaderRequest,
  opts?: { token?: string }
): Promise<ApiResult<{ id: string }>> {
  if (!payload.transporterName?.trim() || !payload.vehicleNumber?.trim()) {
    return { ok: false, status: 0, error: "Transporter name and vehicle number are required." };
  }

  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.HEADER,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      console.log("Failed API Response Status:", res.status, "Error:", err);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data: { id: data.id } };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// UPDATE HEADER
export async function updateDispatchHeader(
  dispatchId: string,
  payload: UpdateDispatchHeaderRequest,
  opts?: { token?: string }
): Promise<ApiResult> {
  // Only enforce if the fields are provided in the payload
  if ((payload.transporterName !== undefined && !payload.transporterName.trim()) ||
      (payload.vehicleNumber !== undefined && !payload.vehicleNumber.trim())) {
    return { ok: false, status: 0, error: "Transporter name and vehicle number cannot be empty." };
  }

  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.UPDATE(dispatchId),
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// LINK SO
export async function linkSalesOrder(
  dispatchId: string,
  payload: LinkDispatchSORequest,
  opts?: { token?: string }
): Promise<ApiResult<DispatchSOLink>> {
  const normalizedSO = payload.saleOrderNumber ? payload.saleOrderNumber.replace(/\s+/g, "").toUpperCase() : "";
  if (!normalizedSO && !payload.salesOrderId) return { ok: false, status: 0, error: "SO number or ID required." };

  try {
    const requestBody = payload.salesOrderId
      ? { id: payload.salesOrderId }
      : { saleOrderNumber: normalizedSO };

    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.SO(dispatchId),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// DELETE SO LINK
export async function deleteSalesOrderLink(
  soLinkId: number,
  opts?: { token?: string }
): Promise<ApiResult> {
  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.SO_DELETE(soLinkId),
      {
        method: "DELETE",
        headers: {
          Accept: "application/json",
        },
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    return { ok: true, status: res.status, data: { message: "Removed" } };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// UPLOAD MULTIPLE ATTACHMENTS
export type FileUploadSpec = {
  uri: string;
  name: string;
  type?: string;
  mimeType?: string;
};

// UPLOAD MULTIPLE ATTACHMENTS
export async function uploadAttachments(
  dispatchId: string,
  files: FileUploadSpec[],
  opts?: { token?: string }
): Promise<ApiResult> {
  if (!files?.length) return { ok: false, status: 0, error: "No files selected." };

  const formData = new FormData();
  files.forEach((file, i) => {
    formData.append("attachments", {
      uri: file.uri,
      name: file.name || `file_${i}`,
      type: file.type || file.mimeType || "application/octet-stream",
    } as any);
  });

  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.ATTACHMENTS(dispatchId),
      {
        method: "POST",
        headers: {
          Accept: "application/json",
        },
        body: formData,
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// GET ATTACHMENTS
export async function getAttachments(
  dispatchId: string,
  opts?: { token?: string }
): Promise<ApiResult<DispatchAttachment[]>> {
  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.ATTACHMENTS(dispatchId),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      opts
    );

    const data: DispatchAttachment[] = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// SEARCH SO
export async function searchSalesOrder(
  soNumber: string,
  opts?: { token?: string }
): Promise<ApiResult<SOSearchResult[]>> {
  const normalizedSO = soNumber.replace(/\s+/g, "").toUpperCase();
  if (!normalizedSO) return { ok: false, status: 0, error: "SO number required." };

  try {
    const res = await doAuthorizedFetch(
      API_ENDPOINTS.DISPATCH.SEARCH_SO(normalizedSO),
      {
        method: "GET",
        headers: {
          Accept: "application/json",
        },
      },
      opts
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json();
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    return { ok: false, status: 0, error: e?.message === "Request timed out" ? "Network timeout" : e?.message || "Network error" };
  }
}

// 🔹 NEW: Transporter Lookup Hook
export const useTransportersLookup = () => {
    const [transporters, setTransporters] = useState<Transporter[]>([]);
    const [loadingTransporters, setLoadingTransporters] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchControllerRef = useRef<AbortController | null>(null);

    const clearTransporters = useCallback(() => setTransporters([]), []);

    const searchTransporters = useCallback(
        async (query: string) => {
            const trimmed = query?.trim() ?? "";
            if (trimmed.length < 3) {
                setTransporters([]);
                return;
            }

            if (searchControllerRef.current) {
                searchControllerRef.current.abort();
            }
            const controller = new AbortController();
            searchControllerRef.current = controller;

            setLoadingTransporters(true);
            setError(null);

            try {
                const url = `${API_ENDPOINTS.DISPATCH.FETCH_TRANSPORTERS}?search=${encodeURIComponent(trimmed)}`;
                const res = await doAuthorizedFetch(url, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        Accept: "application/json",
                    },
                    signal: controller.signal,
                });

                if (!res.ok) {
                    if (res.status === 404) {
                        setTransporters([]);
                        return;
                    }
                    const body = await parseErrorBody(res);
                    throw new Error(body || `Failed to fetch transporters (${res.status})`);
                }

                const data = (await res.json()) as Transporter[];
                if (!Array.isArray(data)) throw new Error("Invalid response format from server");
                setTransporters(data);
            } catch (err: any) {
                if (err?.name === "AbortError") {
                    // ignored
                } else {
                    console.error("searchTransporters error:", err);
                    setError(err?.message ?? "Failed to load transporters");
                    setTransporters([]);
                }
            } finally {
                setLoadingTransporters(false);
                if (searchControllerRef.current === controller) searchControllerRef.current = null;
            }
        },
        []
    );

    const debouncedSearchTransporters = useCallback(
        (query: string) => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            debounceRef.current = setTimeout(() => {
                searchTransporters(query);
            }, 400);
        },
        [searchTransporters]
    );

    useEffect(() => {
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
            searchControllerRef.current?.abort();
        };
    }, []);

    return {
        transporters,
        loadingTransporters,
        error,
        debouncedSearchTransporters,
        clearTransporters,
    };
};

import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "./api";

let AsyncStorage: any = null;
try {
  AsyncStorage = require("@react-native-async-storage/async-storage").default;
} catch {}

// export const BASE_URL = "https://fanuc.goval.app:444/api";
// const DISPATCH_HEADER_URL = `${BASE_URL}/dispatch/mobile/header`;
// const DISPATCH_SO_URL = (dispatchId: string) => `${BASE_URL}/dispatch/mobile/${dispatchId}/so`;
// const DISPATCH_ATTACHMENTS_URL = (dispatchId: string) => `${BASE_URL}/dispatch/mobile/${dispatchId}/attachments`;
// const DISPATCH_SO_DELETE_URL = (soId: number) => `${BASE_URL}/dispatch/so/${soId}`;

export type CreateDispatchHeaderRequest = {
  customerName: string;
  transporterName: string;
  address: string;
  vehicleNumber: string;
};

export type LinkDispatchSORequest = {
  saleOrderNumber: string;
};

export type DispatchSOLink = {
  id: number;
  dispatchId: number;
  saleOrderNumber: string;
  createdAt: string;
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

const TIMEOUT_MS = 15000;
const TOKEN_KEYS = ["accessToken", "authToken", "token"] as const;
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
  inMemoryToken = token ?? null;
  try {
    const canUseSecure = await SecureStore.isAvailableAsync();
    if (canUseSecure) await SecureStore.setItemAsync("accessToken", token);
  } catch {}
  try {
    if (AsyncStorage) await AsyncStorage.setItem("accessToken", token);
  } catch {}
}

export async function clearAccessToken(): Promise<void> {
  inMemoryToken = null;
  try {
    const canUseSecure = await SecureStore.isAvailableAsync();
    if (canUseSecure) await SecureStore.deleteItemAsync("accessToken");
  } catch {}
  try {
    if (AsyncStorage) await AsyncStorage.multiRemove(TOKEN_KEYS as unknown as string[]);
  } catch {}
}

async function getToken(): Promise<string | null> {
  if (inMemoryToken) return inMemoryToken;

  try {
    const canUseSecure = await SecureStore.isAvailableAsync();
    if (canUseSecure) {
      for (const key of TOKEN_KEYS) {
        const val = await SecureStore.getItemAsync(key);
        const parsed = maybeExtractToken(val);
        if (parsed) return (inMemoryToken = parsed);
      }
    }
  } catch {}

  try {
    if (AsyncStorage) {
      for (const key of TOKEN_KEYS) {
        const val = await AsyncStorage.getItem(key);
        const parsed = maybeExtractToken(val);
        if (parsed) return (inMemoryToken = parsed);
      }
    }
  } catch {}

  return null;
}

function maybeExtractToken(val: string | null): string | null {
  if (!val) return null;
  if (!val.trim().startsWith("{")) return val;
  try {
    const obj = JSON.parse(val);
    for (const k of TOKEN_KEYS) {
      const candidate = obj?.[k];
      if (typeof candidate === "string" && candidate.length > 0) return candidate;
    }
  } catch {}
  return val;
}

export async function createDispatchHeader(
  payload: CreateDispatchHeaderRequest,
  opts?: { token?: string }
): Promise<ApiResult> {
  const token = opts?.token ?? (await getToken());
  if (!token) {
    return {
      ok: false,
      status: 0,
      error:
        "Missing access token. Please login again or setAccessToken(...) after login.",
    };
  }

  const { customerName, transporterName, address, vehicleNumber } = payload;
  if (!customerName?.trim() || !transporterName?.trim() || !address?.trim() || !vehicleNumber?.trim()) {
    return { ok: false, status: 0, error: "All fields are required." };
  }

  try {
    const res = await withTimeout(
      fetch(API_ENDPOINTS.MATERIAL_DISPATCH.HEADER, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      })
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    const msg =
      e?.message === "Request timed out"
        ? "Network timeout — please check connectivity and try again."
        : e?.message ?? "Network error";
    return { ok: false, status: 0, error: msg };
  }
}

export async function linkSalesOrder(
  dispatchId: string,
  payload: LinkDispatchSORequest,
  opts?: { token?: string }
): Promise<ApiResult<DispatchSOLink>> {
  const token = opts?.token ?? (await getToken());
  if (!token) {
    return {
      ok: false,
      status: 0,
      error:
        "Missing access token. Please login again or setAccessToken(...) after login.",
    };
  }

  const { saleOrderNumber } = payload;
  const normalizedSO = saleOrderNumber.replace(/\s+/g, "").toUpperCase();
  if (!normalizedSO) {
    return { ok: false, status: 0, error: "Sale order number is required." };
  }

  const normalizedPayload: LinkDispatchSORequest = { saleOrderNumber: normalizedSO };

  try {
    const url = API_ENDPOINTS.MATERIAL_DISPATCH.SO_LINK(dispatchId);
    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(normalizedPayload),
      })
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    const msg =
      e?.message === "Request timed out"
        ? "Network timeout — please check connectivity and try again."
        : e?.message ?? "Network error";
    return { ok: false, status: 0, error: msg };
  }
}

export async function deleteSalesOrderLink(
  soLinkId: number,
  opts?: { token?: string }
): Promise<ApiResult> {
  const token = opts?.token ?? (await getToken());
  if (!token) {
    return {
      ok: false,
      status: 0,
      error:
        "Missing access token. Please login again or setAccessToken(...) after login.",
    };
  }

  try {
    const url = API_ENDPOINTS.MATERIAL_DISPATCH.SO_DELETE(soLinkId);
    const res = await withTimeout(
      fetch(url, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
      })
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({ message: "SO Number removed" }));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    const msg =
      e?.message === "Request timed out"
        ? "Network timeout — please check connectivity and try again."
        : e?.message ?? "Network error";
    return { ok: false, status: 0, error: msg };
  }
}

export async function uploadAttachments(
  dispatchId: string,
  files: any[],
  opts?: { token?: string }
): Promise<ApiResult> {
  const token = opts?.token ?? (await getToken());
  if (!token) {
    return {
      ok: false,
      status: 0,
      error:
        "Missing access token. Please login again or setAccessToken(...) after login.",
    };
  }

  if (!files || files.length === 0) {
    return { ok: false, status: 0, error: "No files provided." };
  }

  try {
    const url = API_ENDPOINTS.MATERIAL_DISPATCH.ATTACHMENTS(dispatchId);
    const formData = new FormData();
    files.forEach((file) => {
      formData.append("attachments", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType,
      } as any);
    });

    const res = await withTimeout(
      fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          // Do not set Content-Type, let the browser set it with boundary
          Accept: "application/json",
        },
        body: formData,
      })
    );

    if (!res.ok) {
      const err = await parseErrorBody(res);
      return { ok: false, status: res.status, error: err };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: true, status: res.status, data };
  } catch (e: any) {
    const msg =
      e?.message === "Request timed out"
        ? "Network timeout — please check connectivity and try again."
        : e?.message ?? "Network error";
    return { ok: false, status: 0, error: msg };
  }
}
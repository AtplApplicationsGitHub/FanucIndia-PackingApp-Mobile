import { API_ENDPOINTS } from "../Endpoints";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
  Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("Request timed out")), ms),
    ),
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

export type UserData = {
  id: number;
  name: string;
  email: string;
  role: string;
  accessLabelPrint: boolean;
  accessMaterialFgTransfer: boolean;
  accessMaterialDispatch: boolean;
  accessVehicleEntry: boolean;
  accessLocationAccuracy: boolean;
  accessContentAccuracy: boolean;
  accessPutAway: boolean;
  accessAttachment: boolean;
};

export type LoginResponse = {
  token?: string;
  accessToken?: string;
  success?: boolean;
  message?: string;
  data?: {
    user: UserData;
    token?: string;
    accessToken?: string;
  };
  user?: UserData; // Sometimes it might be at root
};

const TOKEN_KEYS = ["accessToken", "authToken", "token"] as const;
let inMemoryToken: string | null = null;

function normalizeToken(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let token = String(raw).trim();
  if (!token) return null;
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }
  if (/^bearer\s+/i.test(token)) {
    token = token.replace(/^bearer\s+/i, "").trim();
  }
  return token || null;
}

export async function persistAccessToken(token: string): Promise<void> {
  const normalized = normalizeToken(token);
  if (!normalized) return;

  inMemoryToken = normalized;
  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      await SecureStore.setItemAsync("accessToken", normalized);
      // Backward compatible key used by existing hooks/screens.
      await SecureStore.setItemAsync("authToken", normalized);
    }
  } catch {
    // ignore storage errors; AsyncStorage fallback below
  }

  try {
    await AsyncStorage.multiSet([
      ["accessToken", normalized],
      ["authToken", normalized],
      ["token", normalized],
    ]);
  } catch {
    // ignore storage errors
  }
}

function maybeExtractToken(raw: string | null): string | null {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;
  if (!value.startsWith("{")) return normalizeToken(value);
  try {
    const parsed = JSON.parse(value);
    for (const key of TOKEN_KEYS) {
      const candidate = parsed?.[key];
      if (typeof candidate === "string" && candidate.trim()) {
        return normalizeToken(candidate);
      }
    }
  } catch {
    // fallback to raw value
  }
  return normalizeToken(value);
}

export async function getStoredAccessToken(opts?: { forceRefresh?: boolean }): Promise<string | null> {
  if (!opts?.forceRefresh && inMemoryToken) return inMemoryToken;

  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      for (const key of TOKEN_KEYS) {
        const value = normalizeToken(maybeExtractToken(await SecureStore.getItemAsync(key)));
        if (value) {
          inMemoryToken = value;
          return value;
        }
      }
    }
  } catch {
    // continue to AsyncStorage
  }

  try {
    for (const key of TOKEN_KEYS) {
      const value = normalizeToken(maybeExtractToken(await AsyncStorage.getItem(key)));
      if (value) {
        inMemoryToken = value;
        return value;
      }
    }
  } catch {
    // ignore
  }

  return null;
}

export async function clearStoredAccessToken(): Promise<void> {
  inMemoryToken = null;
  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      await Promise.all([
        SecureStore.deleteItemAsync("accessToken"),
        SecureStore.deleteItemAsync("authToken"),
        SecureStore.deleteItemAsync("token"),
      ]);
    }
  } catch {
    // ignore
  }

  try {
    await AsyncStorage.multiRemove(TOKEN_KEYS as unknown as string[]);
  } catch {
    // ignore
  }
}

export async function loginApiWithEmail(
  email: string,
  password: string,
): Promise<LoginResponse> {
  const res = await withTimeout(
    fetch(API_ENDPOINTS.AUTH.MOBILE_LOGIN, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }),
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);

    // Handle specific cases (user not found, wrong credentials, etc.)
    if (
      res.status === 404 ||
      msg.toLowerCase().includes("not exist") ||
      msg.toLowerCase().includes("not found")
    ) {
      throw new Error("User does not exist");
    }

    if (res.status === 401) {
      throw new Error("Invalid email or password");
    }

    throw new Error(`${res.status} ${res.statusText} — ${msg}`);
  }

  const data = await res.json();
  const token =
    data?.token || data?.accessToken || data?.data?.token || data?.data?.accessToken;
  if (token) {
    await persistAccessToken(String(token));
  }
  return data;
}

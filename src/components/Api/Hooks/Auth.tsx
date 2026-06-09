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
  accessManualFgLocation: boolean;

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
const MAX_OFFLINE_USERS = 5;
const OFFLINE_LOGIN_KEY = "offlineLoginCredentials";
const OFFLINE_USER_KEY = "offlineLoginUser";
const OFFLINE_LOGIN_LIST_KEY = "offlineLoginCredentialsList";
const OFFLINE_USER_LIST_KEY = "offlineLoginUsers";
export const OFFLINE_AUTH_MODE_KEY = "offlineAuthMode";
let inMemoryToken: string | null = null;

type OfflineLoginCredentials = {
  username: string;
  password: string;
  savedAt: string;
};

type OfflineLoginUser = {
  user: UserData;
  displayName: string;
  savedAt: string;
};

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

function normalizeUsername(username: string | null | undefined): string {
  return String(username ?? "").trim().toLowerCase();
}

function parseStoredJson<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function normalizeOfflineList<T>(raw: string | null): T[] {
  const parsed = parseStoredJson<T[] | T>(raw);
  if (!parsed) return [];
  return Array.isArray(parsed) ? parsed.filter(Boolean) : [parsed];
}

function getOfflineLoginCandidates(
  credentials?: OfflineLoginCredentials | null,
  offlineUser?: OfflineLoginUser | null,
) {
  const anyUser = offlineUser?.user as any;
  return [
    credentials?.username,
    anyUser?.email,
    anyUser?.username,
  ]
    .map(normalizeUsername)
    .filter(Boolean);
}

function getOfflineAccountCandidates(
  credentials?: OfflineLoginCredentials | null,
  offlineUser?: OfflineLoginUser | null,
) {
  const anyUser = offlineUser?.user as any;
  return [
    ...getOfflineLoginCandidates(credentials, offlineUser),
    anyUser?.id != null ? String(anyUser.id) : undefined,
  ]
    .map(normalizeUsername)
    .filter(Boolean);
}

function matchesOfflineUsername(
  credentials: OfflineLoginCredentials,
  offlineUser: OfflineLoginUser | null | undefined,
  username: string,
) {
  const normalizedUsername = normalizeUsername(username);
  return getOfflineLoginCandidates(credentials, offlineUser).includes(normalizedUsername);
}

function isSameOfflineAccount(
  existingCredentials: OfflineLoginCredentials,
  existingUser: OfflineLoginUser | null | undefined,
  nextCredentials: OfflineLoginCredentials,
  nextUser: OfflineLoginUser,
) {
  const existingCandidates = getOfflineAccountCandidates(existingCredentials, existingUser);
  const nextCandidates = getOfflineAccountCandidates(nextCredentials, nextUser);
  return existingCandidates.some((candidate) => nextCandidates.includes(candidate));
}

export function extractLoginUserData(response: LoginResponse): UserData | undefined {
  return response?.data?.user || response?.user;
}

export function getUserDisplayName(user: UserData | undefined, fallback: string): string {
  const anyUser = user as any;
  return String(
    anyUser?.name ||
      anyUser?.displayName ||
      anyUser?.username ||
      anyUser?.email ||
      fallback
  ).trim();
}

export async function setOfflineAuthMode(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(OFFLINE_AUTH_MODE_KEY, enabled ? "true" : "false");
  } catch {
    // ignore storage errors
  }
}

async function setSecureOrAsyncStorage(key: string, value: string): Promise<void> {
  let savedSecurely = false;

  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      await SecureStore.setItemAsync(key, value);
      savedSecurely = true;
    }
  } catch {
    savedSecurely = false;
  }

  if (!savedSecurely) {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  }
}

async function getSecureOrAsyncStorage(key: string): Promise<string | null> {
  try {
    const secureAvailable = await SecureStore.isAvailableAsync();
    if (secureAvailable) {
      const secureValue = await SecureStore.getItemAsync(key);
      if (secureValue) return secureValue;
    }
  } catch {
    // continue to AsyncStorage fallback
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function loadOfflineCredentialsList(): Promise<OfflineLoginCredentials[]> {
  const storedList = normalizeOfflineList<OfflineLoginCredentials>(
    await getSecureOrAsyncStorage(OFFLINE_LOGIN_LIST_KEY),
  ).filter((item) => item?.username && item?.password);

  if (storedList.length > 0) return storedList.slice(0, MAX_OFFLINE_USERS);

  const legacyCredentials = parseStoredJson<OfflineLoginCredentials>(
    await getSecureOrAsyncStorage(OFFLINE_LOGIN_KEY),
  );

  return legacyCredentials?.username && legacyCredentials?.password
    ? [legacyCredentials]
    : [];
}

async function loadOfflineUserList(): Promise<OfflineLoginUser[]> {
  const storedList = normalizeOfflineList<OfflineLoginUser>(
    await AsyncStorage.getItem(OFFLINE_USER_LIST_KEY),
  ).filter((item) => item?.user);

  if (storedList.length > 0) return storedList.slice(0, MAX_OFFLINE_USERS);

  const legacyUser = parseStoredJson<OfflineLoginUser>(
    await AsyncStorage.getItem(OFFLINE_USER_KEY),
  );

  return legacyUser?.user ? [legacyUser] : [];
}

function findOfflineUserForCredentials(
  credentials: OfflineLoginCredentials,
  userList: OfflineLoginUser[],
) {
  const normalizedUsername = normalizeUsername(credentials.username);
  return userList.find((offlineUser) => {
    const anyUser = offlineUser.user as any;
    return [anyUser?.email, anyUser?.username]
      .map(normalizeUsername)
      .filter(Boolean)
      .includes(normalizedUsername);
  });
}

export async function persistOfflineLogin(
  username: string,
  password: string,
  user: UserData,
): Promise<void> {
  const trimmedUsername = String(username).trim();
  const displayName = getUserDisplayName(user, trimmedUsername);
  const savedAt = new Date().toISOString();

  const credentials: OfflineLoginCredentials = {
    username: trimmedUsername,
    password,
    savedAt,
  };
  const offlineUser: OfflineLoginUser = {
    user,
    displayName,
    savedAt,
  };

  const [credentialsList, userList] = await Promise.all([
    loadOfflineCredentialsList(),
    loadOfflineUserList(),
  ]);

  const filteredCredentials: OfflineLoginCredentials[] = [];
  const filteredUsers: OfflineLoginUser[] = [];
  const maxLength = Math.max(credentialsList.length, userList.length);

  for (let i = 0; i < maxLength; i += 1) {
    const existingCredentials = credentialsList[i];
    const existingUser =
      userList[i] || (existingCredentials ? findOfflineUserForCredentials(existingCredentials, userList) : null);

    if (!existingCredentials || !existingUser?.user) continue;
    if (isSameOfflineAccount(existingCredentials, existingUser, credentials, offlineUser)) continue;

    filteredCredentials.push(existingCredentials);
    filteredUsers.push(existingUser);
  }

  const nextCredentialsList = [credentials, ...filteredCredentials].slice(0, MAX_OFFLINE_USERS);
  const nextUserList = [offlineUser, ...filteredUsers].slice(0, MAX_OFFLINE_USERS);

  await setSecureOrAsyncStorage(OFFLINE_LOGIN_LIST_KEY, JSON.stringify(nextCredentialsList));
  await setSecureOrAsyncStorage(OFFLINE_LOGIN_KEY, JSON.stringify(credentials));

  try {
    await AsyncStorage.multiSet([
      [OFFLINE_USER_LIST_KEY, JSON.stringify(nextUserList)],
      [OFFLINE_USER_KEY, JSON.stringify(offlineUser)],
      ["displayName", displayName],
      ["username", trimmedUsername],
      ["user", JSON.stringify(user)],
    ]);
  } catch {
    // ignore storage errors
  }
}

export async function loginWithStoredOfflineCredentials(
  username: string,
  password: string,
): Promise<OfflineLoginUser> {
  const [credentialsList, userList] = await Promise.all([
    loadOfflineCredentialsList(),
    loadOfflineUserList(),
  ]);

  if (credentialsList.length === 0 || userList.length === 0) {
    throw new Error("Please login online once before using offline mode.");
  }

  for (let i = 0; i < credentialsList.length; i += 1) {
    const credentials = credentialsList[i];
    const offlineUser = userList[i] || findOfflineUserForCredentials(credentials, userList);

    if (!offlineUser?.user) continue;
    if (!matchesOfflineUsername(credentials, offlineUser, username)) continue;

    if (credentials.password !== password) {
      throw new Error("Offline username or password is incorrect.");
    }

    await AsyncStorage.multiSet([
      ["displayName", offlineUser.displayName],
      ["username", String(username).trim()],
      ["user", JSON.stringify(offlineUser.user)],
      [OFFLINE_AUTH_MODE_KEY, "true"],
    ]);

    return offlineUser;
  }

  throw new Error("Offline username or password is incorrect.");
}

export async function hasStoredOfflineLogin(username?: string): Promise<boolean> {
  try {
    const [credentialsList, userList] = await Promise.all([
      loadOfflineCredentialsList(),
      loadOfflineUserList(),
    ]);

    if (credentialsList.length === 0 || userList.length === 0) {
      return false;
    }

    const normalizedUsername = normalizeUsername(username);

    return credentialsList.some((credentials, index) => {
      const offlineUser =
        userList[index] || findOfflineUserForCredentials(credentials, userList);

      if (!offlineUser?.user) return false;
      if (!normalizedUsername) return true;

      return matchesOfflineUsername(credentials, offlineUser, normalizedUsername);
    });
  } catch {
    return false;
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
  const user = extractLoginUserData(data);
  if (user) {
    await persistOfflineLogin(email, password, user);
  }
  await setOfflineAuthMode(false);
  return data;
}

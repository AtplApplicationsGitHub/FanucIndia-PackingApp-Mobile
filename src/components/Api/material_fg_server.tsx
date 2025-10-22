import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "./api";

// export const BASE_URL = "https://fanuc.goval.app:444/api";
// const ASSIGN_LOCATION_URL = `${BASE_URL}/fg-storage/assign-location`;

export type AssignLocationRequest = {
  saleOrderNumber: string;
  fgLocation: string;
};

export type AssignLocationResponse = {
  message: string; 
  saleOrderNumber: string;
  fgLocation: string;
};

/** ------------ Helpers ------------ */
const withTimeout = <T,>(p: Promise<T>, ms = 15000) =>
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
      return (await res.clone().text()).slice(0, 400);
    } catch {
      return "Unknown server error";
    }
  }
}

export async function assignFgLocation(
  input: AssignLocationRequest,
  token?: string
): Promise<AssignLocationResponse> {
  if (!input?.saleOrderNumber || !input?.fgLocation) {
    throw new Error("saleOrderNumber and fgLocation are required.");
  }

  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await withTimeout(
    fetch(API_ENDPOINTS.MATERIAL_FG.ASSIGN_LOCATION, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        saleOrderNumber: String(input.saleOrderNumber),
        fgLocation: String(input.fgLocation),
      }),
    }),
    15000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`${msg}`);
  }


  const json = (await res.json()) as AssignLocationResponse;
  return {
    message: json?.message ?? ".",
    saleOrderNumber: json?.saleOrderNumber ?? input.saleOrderNumber,
    fgLocation: json?.fgLocation ?? input.fgLocation,
  };
}


export async function assignFgLocationByValues(
  saleOrderNumber: string,
  fgLocation: string,
  token?: string
) {
  return assignFgLocation({ saleOrderNumber, fgLocation }, token);
}


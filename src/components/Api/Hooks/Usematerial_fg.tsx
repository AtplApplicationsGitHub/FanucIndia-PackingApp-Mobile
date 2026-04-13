import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "../Endpoints";


export type AssignLocationRequest = {
  id: number;
  saleOrderNumber: string;
  outboundDelivery: string;
  fgLocation: string;
};

export type AssignLocationResponse = {
  message: string; 
  saleOrderNumber: string;
  fgLocation: string[];
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
  if (!input?.saleOrderNumber || !input?.fgLocation || !input?.id || !input?.outboundDelivery) {
    throw new Error("id, saleOrderNumber, outboundDelivery and fgLocation are required.");
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
        id: Number(input.id),
        saleOrderNumber: String(input.saleOrderNumber),
        outboundDelivery: String(input.outboundDelivery),
        fgLocation: String(input.fgLocation),
      }),
    }),
    15000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`${msg}`);
  }


  const json = (await res.json()) as any;
  return {
    message: json?.message ?? ".",
    saleOrderNumber: json?.saleOrderNumber ?? input.saleOrderNumber,
    fgLocation: json?.fgLocation ?? [input.fgLocation],
  };
}


export async function assignFgLocationByValues(
  id: number,
  saleOrderNumber: string,
  outboundDelivery: string,
  fgLocation: string,
  token?: string
) {
  return assignFgLocation({ id, saleOrderNumber, outboundDelivery, fgLocation }, token);
}

export async function fetchFgVerifySO(soNumber: string, token?: string) {
  const authToken = token || (await SecureStore.getItemAsync("authToken") || undefined);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  const res = await withTimeout(
    fetch(API_ENDPOINTS.MATERIAL_FG.VERIFY_SO(soNumber), {
      method: "GET",
      headers,
    }),
    15000
  );

  if (!res.ok) {
    const msg = await parseErrorBody(res);
    throw new Error(`${msg}`);
  }

  return res.json();
}


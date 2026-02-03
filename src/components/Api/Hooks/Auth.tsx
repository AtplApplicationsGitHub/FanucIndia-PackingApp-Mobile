import { API_ENDPOINTS } from "../Endpoints";
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

  return res.json();
}

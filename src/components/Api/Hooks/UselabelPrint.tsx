// src/hooks/useVerifySO.ts
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "../Endpoints";

type VerifyResponse = {
  valid?: boolean;
  id: number | string;
  saleOrderNumber: string;
  outboundDelivery: string;
  customerName: string;
  contactNumber: string;
  address: string;
};

type PrintResponse = {
  message?: string;
  count?: number;
};

export const useVerifySO = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifySO = async (
    soNumber: string,
  ): Promise<VerifyResponse | VerifyResponse[] | null> => {
    setLoading(true);
    setError(null);

    try {
      const trimmedSO = soNumber?.trim();
      if (!trimmedSO) {
        throw new Error("Please enter a Sales Order number");
      }

      // Get token from SecureStore
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      // 🔹 Updated to use the common verification endpoint
      const url = API_ENDPOINTS.COMMON?.VERIFY_SO_OBD?.(trimmedSO);
      if (!url) {
        throw new Error("Verify SO endpoint not configured");
      }

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        if (res.status === 401)
          throw new Error("Session expired. Please log in again.");
        if (res.status === 404) throw new Error("Sales Order not found");
        if (res.status >= 500)
          throw new Error("Server error. Please try again later.");

        // try parse error body
        let parsed = "Failed to verify SO";
        try {
          const errBody = await res.json();
          parsed =
            errBody?.message || errBody?.error || JSON.stringify(errBody);
        } catch {
          try {
            parsed = await res.text();
          } catch {
            parsed = "Failed to verify SO";
          }
        }
        throw new Error(parsed);
      }

      const data = await res.json();

      if (!data) {
        throw new Error("Invalid response from server");
      }

      // Handle the new nested structure: { valid: true, orders: [...] }
      if (data.orders && Array.isArray(data.orders)) {
        if (data.orders.length === 0) {
          throw new Error("Sales Order not found");
        }
        return data.orders;
      }

      // Handle another common wrapper: { data: [...] } or { data: {...} }
      if (data.data) {
        if (Array.isArray(data.data)) {
          if (data.data.length === 0) throw new Error("Sales Order not found");
          return data.data;
        }
        return data.data;
      }

      // Handle direct array response
      if (Array.isArray(data)) {
        if (data.length === 0) {
          throw new Error("Sales Order not found");
        }
        return data; 
      }

      // Handle single object response
      return data;
    } catch (err: any) {
      const msg = err?.message || "Verification failed";
      setError(msg);
      console.error("verifySO error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { verifySO, loading, error };
};

export const usePrintLabels = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  type PrintResponseLocal = {
    message?: string;
    count?: number;
  };

  const printLabels = async ({
    ids,
    cncText = "CNC PACKAGE",
    boxNN = "1/1",
    quantity = 1,
  }: {
    ids: number[];
    cncText?: string;
    boxNN?: string;
    quantity?: number;
  }): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!Array.isArray(ids) || ids.length === 0) {
        throw new Error("No Sales Order IDs provided to print");
      }

      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        throw new Error("Authentication token missing. Please login again.");
      }

      const url = API_ENDPOINTS.LABEL_PRINT?.PRINT;
      if (!url) throw new Error("Print endpoint not configured");

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: ids,
          cncText: cncText,
          boxNN: boxNN,
          quantity: quantity,
        }),
      });

      // Accept both 200 and 201 as success
      if (res.status !== 200 && res.status !== 201) {
        let msg = "Failed to print labels";
        try {
          const body = await res.json();
          msg = body?.message || body?.error || msg;
        } catch {
          try {
            msg = await res.text();
          } catch {
            msg = "Failed to print labels";
          }
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as PrintResponseLocal;

      const successMessage =
        data?.message ??
        `Successfully printed ${data?.count ?? ids.length} label(s)`;
      setSuccess(successMessage);
      return true;
    } catch (err: any) {
      const msg = err?.message || "Print failed";
      setError(msg);
      console.error("Print error:", err);
      return false;
    } finally {
      setLoading(false);
    }
  };

  return { printLabels, loading, error, success };
};

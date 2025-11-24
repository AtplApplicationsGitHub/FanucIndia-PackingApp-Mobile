// src/hooks/useVerifySO.ts
import { useState } from "react";
import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "../Endpoints";

type VerifyResponse = {
  valid: boolean;
  saleOrderNumber: string;
  customerName: string;
  address: string;
};

export const useVerifySO = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const verifySO = async (soNumber: string): Promise<VerifyResponse | null> => {
    setLoading(true);
    setError(null);

    try {
      const trimmedSO = soNumber.trim();
      if (!trimmedSO) {
        throw new Error("Please enter a Sales Order number");
      }

      // Get token from SecureStore
      const token = await SecureStore.getItemAsync("authToken");
      if (!token) {
        throw new Error("No authentication token found. Please log in again.");
      }

      const url = API_ENDPOINTS.LABEL_PRINT.VERIFY_SO(trimmedSO);

      const res = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`, // This was missing!
        },
      });

      // Handle HTTP errors properly
      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Session expired. Please log in again.");
        }
        if (res.status === 404) {
          throw new Error("Sales Order not found");
        }
        if (res.status >= 500) {
          throw new Error("Server error. Please try again later.");
        }

        // Try to parse error message from body
        let errorMsg = "Failed to verify SO";
        try {
            const errorData = await res.json();
            errorMsg = errorData.message || errorData.error || errorMsg;
        } catch {
            errorMsg = await res.text();
        }
        throw new Error(errorMsg || "Verification failed");
      }

      const data = await res.json();

      // Validate response structure
      if (!data || typeof data !== "object") {
        throw new Error("Invalid response from server");
      }

      if (!data.valid || !data.customerName || !data.address) {
        throw new Error("SO exists but missing required customer data");
      }

      return data as VerifyResponse;
    } catch (err: any) {
      const msg = err.message || "Verification failed";
      setError(msg);
      console.error("verifySO error:", err);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { verifySO, loading, error };
};
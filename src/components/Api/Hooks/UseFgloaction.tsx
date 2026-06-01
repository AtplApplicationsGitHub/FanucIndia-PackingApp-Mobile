import { useCallback, useEffect, useRef, useState } from "react";
import { API_ENDPOINTS } from "../Endpoints";

export type ManualFgStorageRequest = {
  salesOrderNumber: string;
  fgLocation: string;
  user: string;
  dateTime: string;
};

export type ManualFgStorageResponseItem = {
  id: number;
  salesOrderNumber: string;
  fgLocation: string;
  user: string;
  dateTime: string;
};

export type ManualFgStorageResponse = {
  message: string;
  count: number;
  data: ManualFgStorageResponseItem[];
};

const TIMEOUT_MS = 30000;

const withTimeout = <T,>(p: Promise<T>, ms = TIMEOUT_MS) =>
  Promise.race<T>([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error("Request timed out")), ms)
    ),
  ]);

const parseResponseBody = async (res: Response) => {
  try {
    return await res.clone().json();
  } catch {
    try {
      return await res.clone().text();
    } catch {
      return null;
    }
  }
};

export async function postManualFgStorage(
  entries: ManualFgStorageRequest[],
  signal?: AbortSignal
): Promise<ManualFgStorageResponse> {
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error("No FG storage entries to upload.");
  }

  const res = await withTimeout(
    fetch(API_ENDPOINTS.MATERIAL_FG.MANUAL_FG_LOCATION, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(entries),
      signal,
    })
  );

  const body = await parseResponseBody(res);

  if (!res.ok) {
    const message =
      typeof body === "string"
        ? body
        : body?.message || body?.error || `Upload failed (${res.status})`;
    throw new Error(message);
  }

  return {
    message: body?.message ?? "Manual FG storage entries saved successfully.",
    count: Number(body?.count ?? entries.length),
    data: Array.isArray(body?.data) ? body.data : [],
  };
}

export const useManualFgStorage = () => {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);

  const uploadManualFgStorage = useCallback(
    async (entries: ManualFgStorageRequest[]) => {
      uploadControllerRef.current?.abort();
      const controller = new AbortController();
      uploadControllerRef.current = controller;

      setUploading(true);
      setError(null);

      try {
        return await postManualFgStorage(entries, controller.signal);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          throw new Error("Upload cancelled.");
        }

        const message = err?.message || "Unable to upload FG storage entries.";
        setError(message);
        throw new Error(message);
      } finally {
        setUploading(false);
        if (uploadControllerRef.current === controller) {
          uploadControllerRef.current = null;
        }
      }
    },
    []
  );

  const cancelUpload = useCallback(() => {
    uploadControllerRef.current?.abort();
    uploadControllerRef.current = null;
    setUploading(false);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => {
    return () => {
      uploadControllerRef.current?.abort();
    };
  }, []);

  return {
    uploading,
    error,
    clearError,
    cancelUpload,
    uploadManualFgStorage,
  };
};

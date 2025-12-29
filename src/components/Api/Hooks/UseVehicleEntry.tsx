// src/hooks/useVehicleEntry.ts
import { useState, useEffect, useRef, useCallback } from "react";
import * as SecureStore from "expo-secure-store";
import { API_ENDPOINTS } from "../Endpoints";

export type Customer = {
  id: number;
  name: string;
  address?: string;
};

export type Attachment = {
  path: string;          // relative path returned by server
  size: number;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  // Optional: full URL if you want to use it directly in <Image />
  url?: string;
};

export type VehicleEntryResponse = {
  id: number;
  message?: string;
  attachments?: Attachment[];
};

type SavePayload = {
  customerName: string;
  vehicleNumber: string;
  transporterName: string;
  driverNumber: string;
};

const SECURESTORE_TOKEN_KEY = "authToken";

const parseResponseBody = async (res: Response) => {
  try {
    return await res.json();
  } catch {
    try {
      return await res.text();
    } catch {
      return null;
    }
  }
};

export const useVehicleEntry = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [loadingAttachments, setLoadingAttachments] = useState(false); // NEW
  const [saving, setSaving] = useState(false);
  const [uploadingAttachments, setUploadingAttachments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchControllerRef = useRef<AbortController | null>(null);
  const saveControllerRef = useRef<AbortController | null>(null);
  const uploadControllerRef = useRef<AbortController | null>(null);
  const fetchAttachmentsControllerRef = useRef<AbortController | null>(null); // NEW

  const clearError = useCallback(() => setError(null), []);
  const clearCustomers = useCallback(() => setCustomers([]), []);

  const getAuthTokenHeader = useCallback(async (): Promise<string | null> => {
    const token = await SecureStore.getItemAsync(SECURESTORE_TOKEN_KEY);
    if (!token) return null;
    return token.startsWith("Bearer ") ? token : `Bearer ${token}`;
  }, []);

  // Internal: perform a search request (not debounced)
  const searchCustomers = useCallback(
    async (query: string) => {
      const trimmed = query?.trim() ?? "";
      if (trimmed.length < 3) {
        setCustomers([]);
        return;
      }

      if (searchControllerRef.current) {
        searchControllerRef.current.abort();
      }
      const controller = new AbortController();
      searchControllerRef.current = controller;

      setLoadingCustomers(true);
      setError(null);

      try {
        const authHeader = await getAuthTokenHeader();
        if (!authHeader) throw new Error("Authentication token missing. Please login again.");

        const url = `${API_ENDPOINTS.VEHICLE_ENTRY.FETCH_CUSTOMERS}?search=${encodeURIComponent(
          trimmed
        )}`;

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Session expired. Please log in again.");
          if (res.status === 404) {
            setCustomers([]);
            return;
          }
          const body = await parseResponseBody(res);
          throw new Error(body?.message ?? body?.error ?? `Failed to fetch customers (${res.status})`);
        }

        const data = (await parseResponseBody(res)) as Customer[];
        if (!Array.isArray(data)) throw new Error("Invalid response format from server");
        setCustomers(data);
      } catch (err: any) {
        if (err?.name === "AbortError") {
          // ignored
        } else {
          console.error("searchCustomers error:", err);
          setError(err?.message ?? "Failed to load customers");
          setCustomers([]);
        }
      } finally {
        setLoadingCustomers(false);
        if (searchControllerRef.current === controller) searchControllerRef.current = null;
      }
    },
    [getAuthTokenHeader]
  );

  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        searchCustomers(query);
      }, 400);
    },
    [searchCustomers]
  );

  const saveVehicleEntry = useCallback(
    async (payload: SavePayload): Promise<VehicleEntryResponse | null> => {
      setSaving(true);
      setError(null);

      if (saveControllerRef.current) saveControllerRef.current.abort();
      const controller = new AbortController();
      saveControllerRef.current = controller;

      try {
        const authHeader = await getAuthTokenHeader();
        if (!authHeader) throw new Error("Authentication token missing. Please login again.");

        const res = await fetch(API_ENDPOINTS.VEHICLE_ENTRY.SAVE_VEHICLE_ENTRY, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: authHeader,
            Accept: "application/json",
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 401) throw new Error("Session expired. Please log in again.");
          const body = await parseResponseBody(res);
          throw new Error(body?.message ?? body?.error ?? `Failed to save vehicle entry (${res.status})`);
        }

        const result = (await parseResponseBody(res)) as VehicleEntryResponse;
        return result;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          console.debug("saveVehicleEntry aborted");
          return null;
        }
        console.error("saveVehicleEntry error:", err);
        setError(err?.message ?? "Network error");
        return null;
      } finally {
        setSaving(false);
        if (saveControllerRef.current === controller) saveControllerRef.current = null;
      }
    },
    [getAuthTokenHeader]
  );

  const uploadAttachments = useCallback(
    async (
      vehicleEntryId: number | string,
      photos: { uri: string; name?: string; type?: string }[]
    ): Promise<Attachment[] | null> => {
      if (!photos || photos.length === 0) return [];

      setUploadingAttachments(true);
      setError(null);

      if (uploadControllerRef.current) uploadControllerRef.current.abort();
      const controller = new AbortController();
      uploadControllerRef.current = controller;

      try {
        const authHeader = await getAuthTokenHeader();
        if (!authHeader) throw new Error("Authentication token missing. Please login again.");

        const formData = new FormData();
        photos.forEach((photo, index) => {
          const fileName = photo.name ?? `photo_${index + 1}.jpg`;
          const fileType = photo.type ?? "image/jpeg";

          // @ts-ignore - Expo/React Native FormData shape
          formData.append("files", {
            uri: photo.uri,
            name: fileName,
            type: fileType,
          } as any);
        });

        const uploadUrl = API_ENDPOINTS.VEHICLE_ENTRY.UPLOAD_ATTACHMENTS(vehicleEntryId);

        const res = await fetch(uploadUrl, {
          method: "POST",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
          body: formData as any,
          signal: controller.signal,
        });

        if (!res.ok) {
          const body = await parseResponseBody(res);
          throw new Error(body?.message ?? `Upload failed (${res.status})`);
        }

        const data = await parseResponseBody(res);
        if (Array.isArray(data)) return data as Attachment[];
        return (data as any)?.attachments ?? [];
      } catch (err: any) {
        if (err?.name !== "AbortError") {
          console.error("Upload error:", err);
          setError(err?.message ?? "Failed to upload photos");
        }
        return null;
      } finally {
        setUploadingAttachments(false);
        if (uploadControllerRef.current === controller) uploadControllerRef.current = null;
      }
    },
    [getAuthTokenHeader]
  );

  // NEW: Fetch existing attachments for a vehicle entry
  const fetchAttachments = useCallback(
    async (vehicleEntryId: number | string): Promise<Attachment[] | null> => {
      setLoadingAttachments(true);
      setError(null);

      if (fetchAttachmentsControllerRef.current) fetchAttachmentsControllerRef.current.abort();
      const controller = new AbortController();
      fetchAttachmentsControllerRef.current = controller;

      try {
        const authHeader = await getAuthTokenHeader();
        if (!authHeader) throw new Error("Authentication token missing. Please login again.");

        const url = API_ENDPOINTS.VEHICLE_ENTRY.GET_ATTACHMENTS(vehicleEntryId);

        const res = await fetch(url, {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Accept: "application/json",
          },
          signal: controller.signal,
        });

        if (!res.ok) {
          if (res.status === 404) return []; // no attachments yet
          const body = await parseResponseBody(res);
          throw new Error(body?.message ?? `Failed to fetch attachments (${res.status})`);
        }

        const data = (await parseResponseBody(res)) as Attachment[];
        if (!Array.isArray(data)) throw new Error("Invalid attachments response format");

        // Optionally prepend base URL if your backend returns relative paths
        // const base = BASE_URL.endsWith("/") ? BASE_URL.slice(0, -1) : BASE_URL;
        // return data.map(att => ({ ...att, url: `${base}/${att.path}` }));

        return data;
      } catch (err: any) {
        if (err?.name === "AbortError") {
          return null;
        }
        console.error("fetchAttachments error:", err);
        setError(err?.message ?? "Failed to load attachments");
        return null;
      } finally {
        setLoadingAttachments(false);
        if (fetchAttachmentsControllerRef.current === controller)
          fetchAttachmentsControllerRef.current = null;
      }
    },
    [getAuthTokenHeader]
  );

  const saveAndUpload = useCallback(
    async (
      payload: SavePayload,
      photos: { uri: string; name?: string; type?: string }[] = []
    ): Promise<VehicleEntryResponse | null> => {
      const saved = await saveVehicleEntry(payload);
      if (!saved || !saved.id) return null;

      if (photos.length > 0) {
        const attachments = await uploadAttachments(saved.id, photos);
        if (attachments === null) {
          return { ...saved, attachments: saved.attachments ?? [] };
        }
        return { ...saved, attachments };
      }

      return saved;
    },
    [saveVehicleEntry, uploadAttachments]
  );

  const cancelPendingRequests = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    searchControllerRef.current?.abort();
    saveControllerRef.current?.abort();
    uploadControllerRef.current?.abort();
    fetchAttachmentsControllerRef.current?.abort(); // NEW

    searchControllerRef.current = null;
    saveControllerRef.current = null;
    uploadControllerRef.current = null;
    fetchAttachmentsControllerRef.current = null;
  }, []);

  useEffect(() => {
    return () => {
      cancelPendingRequests();
    };
  }, [cancelPendingRequests]);

  return {
    customers,
    loadingCustomers,
    loadingAttachments,        // NEW
    saving,
    uploadingAttachments,
    error,
    debouncedSearch,
    saveVehicleEntry,
    uploadAttachments,
    fetchAttachments,          // NEW
    saveAndUpload,
    clearError,
    clearCustomers,
    cancelPendingRequests,
  };
};
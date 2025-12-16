// Endpoints.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

export let BASE_URL = "";

export const setBaseUrl = (url: string) => {
  const trimmed = url.trim().replace(/\/+$/, "");
  BASE_URL = trimmed;
};

/** Get current base URL (empty string if not set) */
export const getBaseUrl = (): string => BASE_URL;

export const loadBaseUrlFromStorage = async () => {
  try {
    const stored = await AsyncStorage.getItem("apiBaseUrl");
    if (stored) {
      setBaseUrl(stored);
    }
  } catch {
  }
};

export const API_ENDPOINTS = {
  AUTH: {
    get MOBILE_LOGIN() {
      return `${BASE_URL}/auth/mobile-login`;
    },
  },

  SALES_ORDER: {
    get SUMMARY() {
      return `${BASE_URL}/user-dashboard/orders-summary`;
    },
    DETAILS(soNumber: string) {
      return `${BASE_URL}/user-dashboard/orders/son/${soNumber}/download-details`;
    },
    UPLOAD_DATA(soNumber: string) {
      return `${BASE_URL}/user-dashboard/orders/son/${soNumber}/data`;
    },
    get ATTACHMENTS_UPLOAD() {
      return `${BASE_URL}/v1/erp-material-files/upload-with-descriptions`;
    },
    EXISTING_ATTACHMENTS(soNumber: string) {
      return `${BASE_URL}/v1/erp-material-files/by-sale-order/${soNumber}`;
    },
    UPDATE_ATTACHMENT_DESC(fileId: string) {
      return `${BASE_URL}/v1/erp-material-files/${fileId}`;
    },
  },

  MATERIAL_FG: {
    get ASSIGN_LOCATION() {
      return `${BASE_URL}/fg-storage/assign-location`;
    },
  },

  LABEL_PRINT: {
    VERIFY_SO(soNumber: string) {
      return `${BASE_URL}/sales-crud/verify-so/${soNumber}`;
    },
    get PRINT() {
      return `${BASE_URL}/sales-crud/label-print`;
    },
  },

  VEHICLE_ENTRY: {
    get FETCH_CUSTOMERS() {
      return `${BASE_URL}/lookup/customers`;
    },
    get SAVE_VEHICLE_ENTRY() {
      return `${BASE_URL}/vehicle-entry`;
    },
    UPLOAD_ATTACHMENTS(id: string | number) {
      return `${BASE_URL}/vehicle-entry/${id}/attachments`;
    },
    GET_ATTACHMENTS(id: string | number) {
      return `${BASE_URL}/vehicle-entry/${id}/attachments`;
    },
  },

  // 🔹 NEW: Dispatch-related endpoints used by Usematerial_dispatch.tsx
  DISPATCH: {
    get HEADER() {
      return `${BASE_URL}/dispatch/mobile/header`;
    },
    SO(dispatchId: string) {
      return `${BASE_URL}/dispatch/mobile/${dispatchId}/so`;
    },
    ATTACHMENTS(dispatchId: string | number) {
      return `${BASE_URL}/dispatch/${dispatchId}/attachments`;
    },
    SO_DELETE(soId: number | string) {
      return `${BASE_URL}/dispatch/so/${soId}`;
    },
    UPDATE(dispatchId: string | number) {
      return `${BASE_URL}/dispatch/mobile/${dispatchId}`;
    },
  },
};

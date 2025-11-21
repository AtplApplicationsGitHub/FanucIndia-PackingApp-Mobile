export const BASE_URL = "https://fanuc.goval.app:444/api";

export const API_ENDPOINTS = {
  AUTH: {
    MOBILE_LOGIN: `${BASE_URL}/auth/mobile-login`,
  },

  SALES_ORDER: {
    SUMMARY: `${BASE_URL}/user-dashboard/orders-summary`,
    DETAILS: (soNumber: string) =>
      `${BASE_URL}/user-dashboard/orders/son/${soNumber}/download-details`,
    UPLOAD_DATA: (soNumber: string) =>
      `${BASE_URL}/user-dashboard/orders/son/${soNumber}/data`,
    ATTACHMENTS_UPLOAD: `${BASE_URL}/v1/erp-material-files/upload-with-descriptions`,
    EXISTING_ATTACHMENTS: (soNumber: string) =>
      `${BASE_URL}/v1/erp-material-files/by-sale-order/${soNumber}`,
    UPDATE_ATTACHMENT_DESC: (fileId: string) =>
      `${BASE_URL}/v1/erp-material-files/${fileId}`,
  },

  MATERIAL_FG: {
    ASSIGN_LOCATION: `${BASE_URL}/fg-storage/assign-location`,
  },

  MATERIAL_DISPATCH: {
    HEADER: `${BASE_URL}/dispatch/mobile/header`,
    SO_LINK: (dispatchId: string) =>
      `${BASE_URL}/dispatch/mobile/${dispatchId}/so`,
    ATTACHMENTS: (dispatchId: string) =>
      `${BASE_URL}/dispatch/mobile/${dispatchId}/attachments`,
    SO_DELETE: (soId: number) => `${BASE_URL}/dispatch/so/${soId}`,
  },
};
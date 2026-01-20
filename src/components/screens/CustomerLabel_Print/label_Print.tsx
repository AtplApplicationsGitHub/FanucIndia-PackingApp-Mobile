import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Modal,
  Pressable,
  StatusBar,
  Keyboard,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import type { JSX } from "react";

import { useVerifySO, usePrintLabels } from "../../Api/Hooks/UselabelPrint";
import {
  labelPrintStorage,
} from "../../Storage/label_Print_Storage";
import ScannerModal from "./ScannerModal";

type SOItem = {
  id: string;
  soNumber: string;
};

const COLORS = {
  accent: "#3b82f6",
  muted: "#9ca3af",
  bg: "#f9fafb",
  success: "#10b981",
  danger: "#ef4444",
  primary: "#111827",
  warning: "#f59e0b",
};

// Reusable Modals
const ErrorModal = ({
  visible,
  title,
  message,
  onClose,
  autoDismiss = true,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  autoDismiss?: boolean;
}) => {
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (visible && autoDismiss) {
      timer = setTimeout(onClose, 1200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, autoDismiss, onClose]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="alert-circle" size={30} color={COLORS.danger} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <Text style={styles.modalDescription}>{message}</Text>
          {!autoDismiss && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
                onPress={onClose}
              >
                <Text style={styles.primaryBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const SuccessModal = ({
  visible,
  message,
  onClose,
  autoDismiss = true,
}: {
  visible: boolean;
  message: string;
  onClose: () => void;
  autoDismiss?: boolean;
}) => {
  useEffect(() => {
    let timer: NodeJS.Timeout | undefined;
    if (visible && autoDismiss) {
      timer = setTimeout(onClose, 1200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [visible, autoDismiss, onClose]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="checkmark-circle-outline" size={30} color={COLORS.success} />
            <Text style={styles.modalTitle}>Success!</Text>
          </View>
          <Text style={styles.modalDescription}>{message}</Text>
          {!autoDismiss && (
            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: COLORS.success }]}
                onPress={onClose}
              >
                <Text style={styles.primaryBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const ConfirmModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "primary",
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
  type?: "danger" | "primary";
}) => {
  const icon = type === "danger" ? "trash-outline" : "print-outline";
  const iconColor = type === "danger" ? COLORS.danger : COLORS.accent;
  const btnColor = type === "danger" ? COLORS.danger : COLORS.primary;

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name={icon} size={30} color={iconColor} />
            <Text style={styles.modalTitle}>{title}</Text>
          </View>
          <Text style={styles.modalDescription}>{message}</Text>
          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>{cancelText}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: btnColor }]}
              onPress={onConfirm}
            >
              <Text style={styles.primaryBtnText}>{confirmText}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function CustomerLabelPrint(): JSX.Element {
  const [soNumber, setSoNumber] = useState<string>("");
  const [sos, setSos] = useState<SOItem[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Scanner
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  // Local verifying lock to avoid duplicate calls
  const verifyingRef = useRef(false);

  // Modals
  const [errorModal, setErrorModal] = useState({ visible: false, title: "", message: "", autoDismiss: true });
  const [successModal, setSuccessModal] = useState({ visible: false, message: "", autoDismiss: true });
  const [printConfirmModal, setPrintConfirmModal] = useState(false);
  const [clearConfirmModal, setClearConfirmModal] = useState(false);

  const { verifySO, loading: verifyLoading, error: verifyError } = useVerifySO();
  const { printLabels, loading: printLoading, error: printError, success: printSuccess } = usePrintLabels();

  // Load saved session
  useEffect(() => {
    const loadData = async () => {
      const saved = await labelPrintStorage.load();
      if (saved?.sos?.length > 0) {
        setSos(saved.sos);
        setCustomerName(saved.customerName);
        setCustomerAddress(saved.customerAddress);
        setIsCustomerLocked(saved.isCustomerLocked);
      }
    };
    loadData();
  }, []);

  // Auto-save session
  useEffect(() => {
    labelPrintStorage.save({ sos, customerName, customerAddress, isCustomerLocked });
  }, [sos, customerName, customerAddress, isCustomerLocked]);

  // Focus input on mount
  useEffect(() => {
    const timer = setTimeout(() => inputRef.current?.focus(), 300);
    return () => clearTimeout(timer);
  }, []);

  // Request camera permission
  useEffect(() => {
    requestPermission();
  }, []);

  // Handle print success → auto clear everything
  useEffect(() => {
    if (printSuccess) {
      setSuccessModal({ visible: true, message: printSuccess, autoDismiss: true });

      // Auto-clear after successful print (delay small so modal shows)
      const clearAfterPrint = async () => {
        setSos([]);
        setCustomerName(null);
        setCustomerAddress(null);
        setIsCustomerLocked(false);
        setSoNumber("");
        await labelPrintStorage.clear();
      };

      const timer = setTimeout(clearAfterPrint, 800);
      return () => clearTimeout(timer);
    }
  }, [printSuccess]);

  // Handle print error
  useEffect(() => {
    if (printError) {
      setErrorModal({
        visible: true,
        title: "Print Failed",
        message: typeof printError === "string" ? printError : String(printError),
        autoDismiss: true,
      });
    }
  }, [printError]);

  const focusInput = () => setTimeout(() => inputRef.current?.focus(), 100);

  const showError = (title: string, message: string, autoDismiss = true) => {
    setErrorModal({ visible: true, title, message, autoDismiss });
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showError("Camera Permission", "Camera access is required to scan barcodes.", false);
        return;
      }
    }
    scanLockRef.current = false;
    setScanModalVisible(true);
  };

  const closeScanner = () => {
    setScanModalVisible(false);
    focusInput();
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    const data = result.data?.trim();
    if (data) {
      addSO(data);
      setTimeout(closeScanner, 600);
    } else {
      scanLockRef.current = false;
    }
  };

  const addSO = async (value?: string) => {
    Keyboard.dismiss();
    const soToAdd = (value || soNumber).trim().toUpperCase();
    if (!soToAdd) return showError("Empty Input", "Please enter or scan a Sales Order.");

    if (sos.some((i) => i.soNumber === soToAdd)) {
      showError("Duplicate", `"${soToAdd}" is already in the list.`);
      setSoNumber("");
      focusInput();
      return;
    }

    // Prevent duplicate verify calls in rapid succession
    if (verifyingRef.current) {
      // optionally show a short message
      showError("Please wait", "Verification in progress...", true);
      return;
    }

    verifyingRef.current = true;

    try {
      // Call verifySO and handle errors gracefully
      const result = await verifySO(soToAdd);
      if (!result) {
        // prefer verifyError if provided by the hook, otherwise use a friendly default
        const errMsg = verifyError ? (typeof verifyError === "string" ? verifyError : String(verifyError)) : "Sales Order not found or invalid.";
        showError("Invalid SO", errMsg, true);
        setSoNumber("");
        focusInput();
        return;
      }

      const { customerName: newName, address: newAddress } = result;

      if (sos.length === 0) {
        setCustomerName(newName);
        setCustomerAddress(newAddress);
        setIsCustomerLocked(true);
      } else if (customerName !== newName) {
        showError(
          "Customer Mismatch",
          `This SO belongs to a different customer.\n\nExpected: ${customerName}\nFound: ${newName}`,
          true
        );
        setSoNumber("");
        focusInput();
        return;
      }

      const newItem: SOItem = {
        id: Date.now().toString(),
        soNumber: soToAdd,
      };
      setSos((prev) => [newItem, ...prev]);
      setSoNumber("");
      focusInput();
    } catch (err: any) {
      // If verifySO throws, present friendly error but avoid excessive console spam
      const msg = err?.message ? err.message : String(err);
      showError("Invalid SO", msg || "Sales Order not found.", true);
      setSoNumber("");
      focusInput();
    } finally {
      verifyingRef.current = false;
    }
  };

  const removeSO = (id: string) => {
    setSos((prev) => {
      const updated = prev.filter((i) => i.id !== id);
      if (updated.length === 0) {
        setCustomerName(null);
        setCustomerAddress(null);
        setIsCustomerLocked(false);
        labelPrintStorage.clear();
      }
      return updated;
    });
  };

  const onPrint = () => {
    if (sos.length === 0) return showError("Nothing to Print", "Add at least one valid SO first.");
    setPrintConfirmModal(true);
  };

  const confirmPrint = async () => {
    setPrintConfirmModal(false);
    const soNumbers = sos.map((item) => item.soNumber);
    await printLabels(soNumbers);
  };

  const onClearAll = () => {
    if (sos.length === 0) return;
    setClearConfirmModal(true);
  };

  const confirmClearAll = async () => {
    setClearConfirmModal(false);
    setSos([]);
    setCustomerName(null);
    setCustomerAddress(null);
    setIsCustomerLocked(false);
    setSoNumber("");
    await labelPrintStorage.clear();
    focusInput();
  };

  const renderRow = ({ item }: { item: SOItem }) => (
    <View style={styles.row}>
      <Text style={styles.soText}>{item.soNumber}</Text>
      <TouchableOpacity onPress={() => removeSO(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={22} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  // isLoading now only tracks print activity; verification no longer blocks UI
  const isLoading = printLoading;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Input + Print Button */}
      {/* Input + Print Button */}
      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          <View style={styles.inputFieldWrapper}>
            <TextInput
              ref={inputRef}
              value={soNumber}
              onChangeText={setSoNumber}
              placeholder="Enter or scan"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={() => addSO()}
              editable={!isLoading}
              autoFocus
            />
            <Pressable onPress={openScanner} disabled={isLoading} style={styles.scanBtn}>
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={22}
                color={isLoading ? "#ccc" : COLORS.accent}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            onPress={() => addSO()}
            disabled={isLoading || !soNumber.trim()}
            style={[
              styles.iconBtn,
              { backgroundColor: COLORS.success }, // Add button color
              (isLoading || !soNumber.trim()) && styles.btnDisabled,
            ]}
          >
            <Ionicons name="add" size={24} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={onPrint}
            disabled={isLoading || sos.length === 0}
            style={[
              styles.iconBtn,
              { backgroundColor: COLORS.primary }, // Print button color
              (isLoading || sos.length === 0) && styles.btnDisabled,
            ]}
          >
            <Ionicons name="print" size={24} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Info */}
      {isCustomerLocked && customerName && (
        <View style={styles.customerCard}>
          <View style={styles.fixedField}>
            <Text style={styles.fixedLabel}>Customer:</Text>
            <Text style={styles.fixedValue}>{customerName}</Text>
          </View>
          <View style={[styles.fixedField, { marginTop: 8 }]}>
            <Text style={styles.fixedLabel}>Address:</Text>
            <Text style={styles.fixedValue}>{customerAddress}</Text>
          </View>
        </View>
      )}

      {/* SO List */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.headerText}>
            Sales Orders {sos.length > 0 && `(${sos.length})`}
          </Text>
          {sos.length > 0 && (
            <TouchableOpacity onPress={onClearAll} style={styles.clearHeaderBtn}>
              <Text style={styles.clearHeaderText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
        <FlatList
          data={sos}
          keyExtractor={(item) => item.id}
          renderItem={renderRow}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={() => (
            <Text style={styles.emptyText}>
              {isCustomerLocked
                ? "No SOs added yet. Scan or type to begin."
                : "Scan or enter the first SO to confirm the customer."}
            </Text>
          )}
        />
      </View>

      {/* Modals */}
      <ScannerModal
        visible={scanModalVisible}
        onClose={closeScanner}
        onBarcodeScanned={handleBarcodeScanned}
        scanLock={scanLockRef.current}
      />

      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        autoDismiss={errorModal.autoDismiss}
        onClose={() => {
          setErrorModal({ ...errorModal, visible: false });
          focusInput();
        }}
      />

      <SuccessModal
        visible={successModal.visible}
        message={successModal.message}
        autoDismiss={successModal.autoDismiss}
        onClose={() => {
          setSuccessModal({ visible: false, message: "", autoDismiss: true });
          focusInput();
        }}
      />

      <ConfirmModal
        visible={printConfirmModal}
        title="Print Labels"
        message={`Print ${sos.length} label(s) for:\n\n${customerName}\n${customerAddress}`}
        confirmText="Print"
        cancelText="Cancel"
        type="primary"
        onConfirm={confirmPrint}
        onCancel={() => setPrintConfirmModal(false)}
      />

      <ConfirmModal
        visible={clearConfirmModal}
        title="Clear all?"
        message="This will clear the form and all scanned items."
        confirmText="Clear"
        cancelText="Keep"
        type="danger"
        onConfirm={confirmClearAll}
        onCancel={() => setClearConfirmModal(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 12,
  },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
    marginTop: 4,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  inputFieldWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 8,
    height: 48,
  },
  input: { flex: 1, fontSize: 16, color: "#1f2937", paddingVertical: 0 },
  scanBtn: { padding: 8 },
  iconBtn: {
    width: 48,
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
  },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },
  // Removed old button styles (btnSmall, saveBtn, printBtnRight, printBtnText)

  customerCard: {
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderLeftWidth: 4,
    borderLeftColor: COLORS.success,
  },
  fixedField: { flexDirection: "row", alignItems: "flex-start" },
  fixedLabel: { fontSize: 14, color: "#64748b", width: 75, fontWeight: "600" },
  fixedValue: { fontSize: 14, color: "#1e293b", fontWeight: "500", flex: 1 },
  tableCard: {
    flex: 1,
    marginTop: 10,
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 6,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { fontSize: 14, fontWeight: "700", color: "#475569" },
  clearHeaderBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearHeaderText: { color: COLORS.danger, fontWeight: "600", fontSize: 13 },
  row: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  soText: { fontSize: 16, fontWeight: "600", color: "#1d4ed8", flex: 1 },
  deleteBtn: { padding: 8 },
  separator: { height: 1, backgroundColor: "#f1f5f9", marginHorizontal: 16 },
  emptyText: {
    textAlign: "center",
    color: COLORS.muted,
    padding: 40,
    fontStyle: "italic",
    fontSize: 15,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    width: "88%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 12,
  },
  modalDescription: {
    fontSize: 16,
    color: "#4b5563",
    lineHeight: 24,
    marginBottom: 24,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 12,
  },
  secondaryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: "#f3f4f6", // Muted light grey
    minWidth: 100,
    alignItems: "center",
  },
  secondaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#374151",
  },
  primaryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 14,
    minWidth: 100,
    alignItems: "center",
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: "#fff",
  },
});

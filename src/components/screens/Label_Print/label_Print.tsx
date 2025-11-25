// src/screens/CustomerLabelPrint.tsx
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
import { useVerifySO } from "../../Api/Hooks/UselabelPrint";
import {
  labelPrintStorage,
  StoredLabelPrintData,
} from "../../Storage/label_Print_Storage";
import ScannerModal from "../../Scanner/ScannerModal";

type SOItem = {
  id: string;
  soNumber: string;
};

const COLORS = {
  accent: "#3b82f6ff",
  muted: "#9ca3af",
  bg: "#f3f6fb",
  success: "#10b981",
  danger: "#ef4444",
  primary: "#111827",
  warning: "#f59e0b",
};

// Reusable Modals (unchanged)
const ErrorModal = ({
  visible,
  title,
  message,
  onClose,
}: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
}) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.alertModal}>
        <Text style={styles.alertTitle}>{title}</Text>
        <Text style={styles.alertMessage}>{message}</Text>
        <TouchableOpacity style={styles.alertBtn} onPress={onClose}>
          <Text style={styles.alertBtnText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const ConfirmationModal = ({
  visible,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}: {
  visible: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}) => (
  <Modal transparent visible={visible} animationType="fade">
    <View style={styles.modalOverlay}>
      <View style={styles.confirmModal}>
        <Text style={styles.confirmTitle}>{title}</Text>
        <Text style={styles.confirmMessage}>{message}</Text>
        <View style={styles.confirmButtons}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>{cancelText}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.confirmBtn} onPress={onConfirm}>
            <Text style={styles.confirmBtnText}>{confirmText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

export default function CustomerLabelPrint(): JSX.Element {
  const [soNumber, setSoNumber] = useState<string>("");
  const [sos, setSos] = useState<SOItem[]>([]);
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Scanner state
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const scanLockRef = useRef(false);

  // Modals
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: "",
    message: "",
  });
  const [confirmModal, setConfirmModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText: string;
    cancelText: string;
  }>({
    visible: false,
    title: "",
    message: "",
    onConfirm: () => {},
    onCancel: () => {},
    confirmText: "Confirm",
    cancelText: "Cancel",
  });

  const { verifySO, loading, error: verifyError } = useVerifySO();

  // Load saved data on mount
  useEffect(() => {
    const loadData = async () => {
      const saved = await labelPrintStorage.load();
      if (saved.sos.length > 0) {
        setSos(saved.sos);
        setCustomerName(saved.customerName);
        setCustomerAddress(saved.customerAddress);
        setIsCustomerLocked(saved.isCustomerLocked);
      }
    };
    loadData();
  }, []);

  // Auto-save on any change
  useEffect(() => {
    const dataToSave: StoredLabelPrintData = {
      sos,
      customerName,
      customerAddress,
      isCustomerLocked,
    };
    labelPrintStorage.save(dataToSave);
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

  const focusInput = useCallback(() => {
    setTimeout(() => inputRef.current?.focus(), 100);
  }, []);

  const showError = (title: string, message: string) => {
    setErrorModal({ visible: true, title, message });
  };

  const openScanner = async () => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showError(
          "Permission Required",
          "Camera access is needed to scan barcodes."
        );
        return;
      }
    }
    scanLockRef.current = false;
    setScanModalVisible(true);
  };

  const closeScanner = () => {
    setScanModalVisible(false);
    scanLockRef.current = false;
    focusInput();
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    const data = result.data?.trim();
    if (data) {
      addSO(data);
      setTimeout(() => closeScanner(), 800);
    } else {
      scanLockRef.current = false;
    }
  };

  const addSO = async (value?: string) => {
    Keyboard.dismiss();
    const soToAdd = (value || soNumber).trim().toUpperCase();
    if (!soToAdd) {
      showError("Invalid Input", "Please enter or scan a Sales Order number.");
      focusInput();
      return;
    }
    if (sos.some((item) => item.soNumber === soToAdd)) {
      showError("Already Added", `SO "${soToAdd}" is already in the list.`);
      setSoNumber("");
      focusInput();
      return;
    }
    if (loading) return;

    const result = await verifySO(soToAdd);
    if (!result) {
      showError("Invalid SO", verifyError || "SO not found or invalid.");
      setSoNumber("");
      focusInput();
      return;
    }

    const { customerName: newName, address: newAddress } = result;

    if (sos.length === 0) {
      setCustomerName(newName);
      setCustomerAddress(newAddress);
      setIsCustomerLocked(true);
    } else if (customerName !== newName || customerAddress !== newAddress) {
      showError(
        "Customer Mismatch",
        `This SO belongs to a different customer.\nExpected: ${customerName}\nFound: ${newName}`
      );
      focusInput();
      return;
    }

    const newItem: SOItem = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      soNumber: soToAdd,
    };
    setSos((prev) => [newItem, ...prev]);
    setSoNumber("");
    focusInput();
  };

  const removeSO = (id: string) => {
    setSos((prev) => {
      const updated = prev.filter((item) => item.id !== id);
      if (updated.length === 0) {
        setCustomerName(null);
        setCustomerAddress(null);
        setIsCustomerLocked(false);
        labelPrintStorage.clear();
      }
      return updated;
    });
    focusInput();
  };

  const onPrint = () => {
    if (sos.length === 0) {
      showError("Nothing to Print", "Please add at least one Sales Order.");
      return;
    }
    setConfirmModal({
      visible: true,
      title: "Print Labels",
      message: `Customer: ${customerName}\nAddress: ${customerAddress}\n\nPrint ${sos.length} label(s)?`,
      confirmText: "Print",
      cancelText: "Cancel",
      onConfirm: () => {
        console.log("Printing:", {
          customerName,
          customerAddress,
          sos: sos.map((s) => s.soNumber),
        });
        // TODO: Connect to actual print API here
        setConfirmModal((prev) => ({ ...prev, visible: false }));
      },
      onCancel: () => setConfirmModal((prev) => ({ ...prev, visible: false })),
    });
  };

  const onClearAll = () => {
    setConfirmModal({
      visible: true,
      title: "Clear All Data",
      message: "This will remove all Sales Orders and customer details.",
      confirmText: "Clear All",
      cancelText: "Cancel",
      onConfirm: async () => {
        setSos([]);
        setCustomerName(null);
        setCustomerAddress(null);
        setIsCustomerLocked(false);
        setSoNumber("");
        await labelPrintStorage.clear();
        focusInput();
        setConfirmModal((prev) => ({ ...prev, visible: false }));
      },
      onCancel: () => setConfirmModal((prev) => ({ ...prev, visible: false })),
    });
  };

  const renderRow = ({ item }: { item: SOItem }) => (
    <View style={styles.row}>
      <Text style={styles.soText}>{item.soNumber}</Text>
      <TouchableOpacity
        onPress={() => removeSO(item.id)}
        style={styles.deleteBtn}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Ionicons name="trash-outline" size={20} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

      {/* Input Card with Print Button on the Right */}
      <View style={styles.inputCard}>
        <View style={styles.inputRow}>
          {/* Input + Scan + Add */}
          <View style={styles.inputFieldWrapper}>
            <TextInput
              ref={inputRef}
              value={soNumber}
              onChangeText={setSoNumber}
              placeholder="Enter or scan SO"
              placeholderTextColor={COLORS.muted}
              style={styles.input}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={() => addSO()}
              editable={!loading}
              autoFocus={true}
            />
            <Pressable
              onPress={openScanner}
              style={styles.scanBtn}
              disabled={loading}
            >
              <MaterialCommunityIcons
                name="qrcode-scan"
                size={22}
                color={loading ? "#ccc" : COLORS.accent}
              />
            </Pressable>
            <TouchableOpacity
              style={[
                styles.btnSmall,
                styles.saveBtn,
                (!soNumber.trim() || loading) && styles.btnDisabled,
              ]}
              onPress={() => addSO()}
              disabled={loading || !soNumber.trim()}
            >
              <Text style={styles.saveBtnText}>
                {loading ? "Checking..." : "Add"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Print Button - Now on the Right */}
          <TouchableOpacity
            style={[styles.printBtnRight, loading && styles.btnDisabled]}
            onPress={onPrint}
            disabled={loading || sos.length === 0}
          >
            <Ionicons name="print" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Customer Card */}
      {isCustomerLocked && customerName && (
        <View style={styles.customerCard}>
          <View style={styles.fixedField}>
            <Text style={styles.fixedLabel}>Name:</Text>
            <Text style={styles.fixedValue}>{customerName}</Text>
          </View>
          <View style={[styles.fixedField, { marginTop: 10 }]}>
            <Text style={styles.fixedLabel}>Address:</Text>
            <Text style={styles.fixedValue}>{customerAddress}</Text>
          </View>
        </View>
      )}

      {/* SO List */}
      <View style={styles.tableCard}>
        <View style={styles.tableHeader}>
          <Text style={styles.headerText}>
            Sales Orders {sos.length > 0 ? `(${sos.length})` : ""}
          </Text>
          {sos.length > 0 && (
            <TouchableOpacity
              onPress={onClearAll}
              style={styles.clearHeaderBtn}
            >
              <Text style={styles.clearHeaderText}>Clear All</Text>
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
                ? "No additional SOs added yet"
                : "Scan or enter the first SO to begin"}
            </Text>
          )}
        />
      </View>

      {/* Scanner Modal */}
      <ScannerModal
        visible={scanModalVisible}
        onClose={closeScanner}
        onBarcodeScanned={handleBarcodeScanned}
        scanLock={scanLockRef.current}
      />

      {/* Modals */}
      <ErrorModal
        visible={errorModal.visible}
        title={errorModal.title}
        message={errorModal.message}
        onClose={() => {
          setErrorModal({ ...errorModal, visible: false });
          focusInput();
        }}
      />
      <ConfirmationModal
        visible={confirmModal.visible}
        title={confirmModal.title}
        message={confirmModal.message}
        onConfirm={confirmModal.onConfirm}
        onCancel={confirmModal.onCancel}
        confirmText={confirmModal.confirmText}
        cancelText={confirmModal.cancelText}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
    padding: 17,
    paddingVertical: 1,
  },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
    marginTop: 10,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  inputFieldWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 8,
    height: 54,
    marginRight: 12,
  },
  input: { flex: 1, fontSize: 17, color: "#1f2937", paddingVertical: 0 },
  scanBtn: { padding: 10 },
  btnSmall: {
    marginLeft: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
  },
  saveBtn: { backgroundColor: COLORS.success },
  btnDisabled: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "600", fontSize: 15 },

  // Print Button on the Right
printBtnRight: {
  backgroundColor: "#111827",   // ← change your color here
  flexDirection: "row",
  alignItems: "center",
  paddingHorizontal: 20,
  paddingVertical: 14,
  borderRadius: 12,
  gap: 8,
},

  customerCard: {
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 3,
    borderLeftWidth: 5,
    borderLeftColor: COLORS.success,
  },
  fixedField: { flexDirection: "row", alignItems: "flex-start" },
  fixedLabel: { fontSize: 15, color: "#64748b", width: 80, fontWeight: "600" },
  fixedValue: { fontSize: 15, color: "#1e293b", fontWeight: "500", flex: 1 },

  tableCard: {
    flex: 1,
    marginTop: 16,
    backgroundColor: "#fff",
    borderRadius: 16,
    overflow: "hidden",
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: "#f8fafc",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { fontSize: 15, fontWeight: "700", color: "#475569" },
  clearHeaderBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearHeaderText: { color: COLORS.danger, fontWeight: "600", fontSize: 14 },
  row: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  soText: { fontSize: 18, fontWeight: "600", color: "#1d4ed8", flex: 1 },
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  alertModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 30,
    alignItems: "center",
    width: "85%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  alertTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 16,
  },
  alertMessage: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginVertical: 12,
    lineHeight: 22,
  },
  alertBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 16,
  },
  alertBtnText: { color: "#fff", fontWeight: "600", fontSize: 16 },
  confirmModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "88%",
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  confirmTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#1f2937",
    textAlign: "center",
  },
  confirmMessage: {
    fontSize: 16,
    color: "#475569",
    textAlign: "center",
    marginVertical: 16,
    lineHeight: 22,
  },
  confirmButtons: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    marginRight: 10,
  },
  cancelBtnText: {
    color: "#64748b",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
  confirmBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    marginLeft: 10,
  },
  confirmBtnText: {
    color: "#fff",
    fontWeight: "600",
    textAlign: "center",
    fontSize: 16,
  },
});
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
  Platform,
  Vibration,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { JSX } from "react";

import { useVerifySO, usePrintLabels } from "../../Api/Hooks/UselabelPrint";
import { labelPrintStorage } from "../../Storage/label_Print_Storage";
import { useKeyboardDisabled } from "../../utils/keyboard";

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
  card: "#FFFFFF",
  border: "#E6E7EB",
  text: "#0B0F19",
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
  const navigation = useNavigation();
  const [soNumber, setSoNumber] = useState<string>("");
  const [sos, setSos] = useState<SOItem[]>([]);
  // sortMode: 'recent' (LIFO), 'asc' (A-Z), 'desc' (Z-A)
  const [sortMode, setSortMode] = useState<"recent" | "asc" | "desc">("recent"); 
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);
  const inputRef = useRef<TextInput>(null);

  // Custom hook for global keyboard state 
  const [keyboardDisabled] = useKeyboardDisabled();

  // Camera / Scan state
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  
  // Multi-scan state
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{ message: string; color: string } | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const sessionCodesRef = useRef<Set<string>>(new Set());

  // Local verifying lock
  const verifyingRef = useRef(false);

  // Modals
  const [errorModal, setErrorModal] = useState({ visible: false, title: "", message: "", autoDismiss: true });
  const [successModal, setSuccessModal] = useState({ visible: false, message: "", autoDismiss: true });
  const [printConfirmModal, setPrintConfirmModal] = useState(false);
  const [clearConfirmModal, setClearConfirmModal] = useState(false);
  const [mismatchModal, setMismatchModal] = useState({ visible: false, newName: "", soToAdd: "" });

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

  // Focus Management
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  useEffect(() => {
    const anyModalOpen = scanModalVisible || errorModal.visible || successModal.visible || printConfirmModal || clearConfirmModal || mismatchModal.visible;
    if (keyboardDisabled && !anyModalOpen) {
      const timer = setTimeout(() => {
        if (navigation.isFocused()) {
          inputRef.current?.focus();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [
    keyboardDisabled, 
    scanModalVisible, 
    errorModal.visible, 
    successModal.visible, 
    printConfirmModal, 
    clearConfirmModal, 
    mismatchModal.visible,
    navigation
  ]);

  const handleBlur = () => {
    const anyModalOpen = scanModalVisible || errorModal.visible || successModal.visible || printConfirmModal || clearConfirmModal || mismatchModal.visible;
    if (keyboardDisabled && !anyModalOpen) {
      setTimeout(() => {
        if (navigation.isFocused() && !anyModalOpen) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  };

  useEffect(() => {
    if (printSuccess) {
      setSuccessModal({ visible: true, message: printSuccess, autoDismiss: true });
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

  const focusInput = () => {
    setTimeout(() => {
         inputRef.current?.focus();
    }, 100);
  };

  const showError = (title: string, message: string, autoDismiss = true) => {
    setErrorModal({ visible: true, title, message, autoDismiss });
  };

  const openScanner = async () => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted) return showError("Permission Required", "Allow camera access to scan.");
      } else if (!permission.granted) {
        if (!permission.canAskAgain) return showError("Camera Disabled", "Please enable camera access.", false);
        const res = await requestPermission();
        if (!res.granted) return showError("Permission Denied", "Camera permission is required.");
      }

      sessionCodesRef.current.clear();
      setLastScannedCode(null);
      setSessionCount(0);
      setScanModalVisible(true);
    } catch (err) {
      console.log(err);
      showError("Error", "Failed to access camera permission.");
    }
  };

  const closeScanner = () => {
    setScanModalVisible(false);
    focusInput();
  };

  const handleBarcodeScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;
    if (sessionCodesRef.current.has(value)) return;
    if (sos.some((item) => item.soNumber === value.toUpperCase())) {
        sessionCodesRef.current.add(value);
        return;
    }
    sessionCodesRef.current.add(value);
    Vibration.vibrate();
    setLastScannedCode(value);
    setSessionCount(prev => prev + 1);
    addSO(value, true);
  };

  const addSO = async (value?: string, fromScanner = false) => {
    const soToAdd = (value || soNumber).trim().toUpperCase();
    if (!soToAdd) {
        if (!value) showError("Empty Input", "Please enter or scan a Sales Order.");
        return;
    }

    if (sos.some((i) => i.soNumber === soToAdd)) {
      if (fromScanner) {
        setScanStatus({ message: "Duplicate: " + soToAdd, color: COLORS.warning });
        return;
      }
      showError("Duplicate", `"${soToAdd}" is already in the list.`);
      setSoNumber("");
      if (!scanModalVisible) focusInput();
      return;
    }

    if (verifyingRef.current) {
      if (!fromScanner) showError("Please wait", "Verification in progress...", true);
      return;
    }

    verifyingRef.current = true;

    try {
      const result = await verifySO(soToAdd);
      if (!result) {
        const errMsg = verifyError ? (typeof verifyError === "string" ? verifyError : String(verifyError)) : "Sales Order not found.";
        if (fromScanner) {
            setScanStatus({ message: "Invalid: " + soToAdd, color: COLORS.danger });
            Vibration.vibrate(400); 
            return;
        }
        showError("Invalid SO", errMsg, true);
        setSoNumber("");
        if (!scanModalVisible) focusInput();
        return;
      }

      const { customerName: newName, address: newAddress } = result;
      const currentNameNorm = customerName ? customerName.trim().toLowerCase() : "";
      const newNameNorm = newName ? newName.trim().toLowerCase() : "";

      if (sos.length === 0) {
        setCustomerName(newName);
        setCustomerAddress(newAddress);
        setIsCustomerLocked(true);
        if (fromScanner) setScanStatus({ message: "Added: " + soToAdd, color: COLORS.success });
      } else if (currentNameNorm !== newNameNorm) {
        if (fromScanner) {
             setScanStatus({ message: "Mismatch Ignored", color: COLORS.danger });
             Vibration.vibrate(400); 
             return;
        }
        setSoNumber("");
        setMismatchModal({ visible: true, newName: newName || "Unknown", soToAdd: soToAdd });
        return;
      } else {
        if (fromScanner) setScanStatus({ message: "Added: " + soToAdd, color: COLORS.success });
      }

      const newItem: SOItem = {
        id: Date.now().toString() + Math.random().toString().slice(2,5),
        soNumber: soToAdd,
      };
      
      // Add to TOP (LIFO)
      setSos((prev) => [newItem, ...prev]);
      setSoNumber("");
      
      if (!scanModalVisible) focusInput();

    } catch (err: any) {
      const msg = err?.message || String(err);
      if (fromScanner) {
         setScanStatus({ message: "Error: " + msg, color: COLORS.danger });
         Vibration.vibrate(400);
         return;
      }
      showError("Invalid SO", msg || "Sales Order not found.", true);
      setSoNumber("");
      if (!scanModalVisible) focusInput();
    } finally {
      verifyingRef.current = false;
    }
  };

  const handleMismatchConfirm = () => {
    // Just close/reset. Do NOT add.
    setMismatchModal({ visible: false, newName: "", soToAdd: "" });
    setSoNumber("");
    if (!scanModalVisible) focusInput();
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

  // Sorting Logic
  const toggleSortMode = () => {
      setSortMode(prev => {
          if (prev === 'recent') return 'asc';
          if (prev === 'asc') return 'desc';
          return 'recent';
      });
  };

  const sortedSos = React.useMemo(() => {
    if (sortMode === 'recent') {
        return sos; // sos is already LIFO
    }
    return [...sos].sort((a, b) => {
      if (sortMode === 'asc') {
        return a.soNumber.localeCompare(b.soNumber);
      } else {
        return b.soNumber.localeCompare(a.soNumber);
      }
    });
  }, [sos, sortMode]);

  const renderRow = ({ item }: { item: SOItem }) => (
    <View style={styles.row}>
      <Text style={styles.soText}>{item.soNumber}</Text>
      <TouchableOpacity onPress={() => removeSO(item.id)} style={styles.deleteBtn}>
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  const isLoading = printLoading;
  
  const getSortIcon = () => {
      switch(sortMode) {
          case 'asc': return 'sort-alphabetical-ascending';
          case 'desc': return 'sort-alphabetical-descending';
          default: return 'history';
      }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View style={styles.inputCard}>
            <View style={styles.inputRow}>
            <View style={styles.inputFieldWrapper}>
                <TextInput
                    ref={inputRef}
                    value={soNumber}
                    onChangeText={setSoNumber}
                    placeholder={keyboardDisabled ? "Scan SO..." : "Enter or scan"}
                    placeholderTextColor={COLORS.muted}
                    style={styles.input}
                    autoCapitalize="characters"
                    returnKeyType="done"
                    onSubmitEditing={() => addSO()}
                    editable={!isLoading}
                    autoFocus={true}
                    showSoftInputOnFocus={!keyboardDisabled}
                    onBlur={handleBlur}
                />
                <Pressable onPress={openScanner} disabled={isLoading} style={styles.scanBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={isLoading ? "#ccc" : COLORS.accent} />
                </Pressable>
            </View>
            <TouchableOpacity
                onPress={() => addSO()}
                disabled={isLoading || !soNumber.trim()}
                style={[styles.iconBtn, { backgroundColor: COLORS.success }, (isLoading || !soNumber.trim()) && styles.btnDisabled]}
            >
                <Ionicons name="add" size={20} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity
                onPress={onPrint}
                disabled={isLoading || sos.length === 0}
                style={[styles.iconBtn, { backgroundColor: COLORS.primary }, (isLoading || sos.length === 0) && styles.btnDisabled]}
            >
                <Ionicons name="print" size={20} color="#fff" />
            </TouchableOpacity>
            </View>
        </View>

        {isCustomerLocked && customerName && (
            <View style={styles.customerCard}>
            <View style={styles.fixedField}>
                <Text style={styles.fixedLabel}>Customer:</Text>
                <Text style={styles.fixedValue}>{customerName}</Text>
            </View>
            <View style={[styles.fixedField, { marginTop: 2 }]}>
                <Text style={styles.fixedLabel}>Address:</Text>
                <Text style={styles.fixedValue}>{customerAddress}</Text>
            </View>
            </View>
        )}

        <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1}}>
                <Text style={styles.headerText}>SOs {sos.length > 0 && `(${sos.length})`}</Text>
                {sos.length > 0 && (
                     <TouchableOpacity 
                        onPress={toggleSortMode}
                        style={styles.sortBtn}
                    >
                        <MaterialCommunityIcons name={getSortIcon()} size={16} color={COLORS.accent} />
                    </TouchableOpacity>
                )}
              </View>
            {sos.length > 0 && (
                <TouchableOpacity onPress={onClearAll} style={styles.clearHeaderBtn}>
                <Text style={styles.clearHeaderText}>Clear</Text>
                </TouchableOpacity>
            )}
            </View>
            <FlatList
                data={sortedSos}
                keyExtractor={(item) => item.id}
                renderItem={renderRow}
                ItemSeparatorComponent={() => <View style={styles.separator} />}
                ListEmptyComponent={() => (
                    <Text style={styles.emptyText}>
                    {isCustomerLocked ? "Scan or type to begin." : "Scan first SO to confirm customer."}
                    </Text>
                )}
                contentContainerStyle={{ paddingBottom: 4 }}
            />
        </View>

        <ErrorModal
            visible={errorModal.visible}
            title={errorModal.title}
            message={errorModal.message}
            autoDismiss={errorModal.autoDismiss}
            onClose={() => setErrorModal({ ...errorModal, visible: false })}
        />

        <SuccessModal
            visible={successModal.visible}
            message={successModal.message}
            autoDismiss={successModal.autoDismiss}
            onClose={() => setSuccessModal({ visible: false, message: "", autoDismiss: true })}
        />

        <ConfirmModal
            visible={printConfirmModal}
            title="Print Labels"
            message={`Print ${sos.length} label(s)?`}
            confirmText="Print"
            cancelText="Cancel"
            type="primary"
            onConfirm={confirmPrint}
            onCancel={() => setPrintConfirmModal(false)}
        />

        <ConfirmModal
            visible={clearConfirmModal}
            title="Clear all?"
            message="This will clear the current session."
            confirmText="Clear"
            cancelText="No"
            type="danger"
            onConfirm={confirmClearAll}
            onCancel={() => setClearConfirmModal(false)}
        />

        <ConfirmModal
            visible={mismatchModal.visible}
            title="Customer Mismatch"
            message={`Expected: ${customerName}\nFound: ${mismatchModal.newName}`}
            confirmText="OK"
            cancelText="Cancel"
            type="primary"
            onConfirm={handleMismatchConfirm}
            onCancel={() => setMismatchModal({ ...mismatchModal, visible: false })}
        />

        <Modal
            visible={scanModalVisible}
            onRequestClose={closeScanner}
            animationType="slide"
            presentationStyle="fullScreen"
            transparent={false}
        >
            <StatusBar hidden />
            <View style={styles.fullscreenCameraWrap}>
            <CameraView
                style={styles.fullscreenCamera}
                facing="back"
                barcodeScannerSettings={{
                barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e", "code39", "codabar", "code93", "pdf417", "datamatrix"],
                }}
                onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.fullscreenTopBar}>
                <Text style={styles.fullscreenTitle}>Multi-Scan</Text>
                <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
                <Text style={styles.closeBtnText}>Done</Text>
                </Pressable>
            </View>
            <View style={styles.fullscreenBottomBar}>
                <Text style={styles.fullscreenHint}>Align codes within frame</Text>
                {sessionCount > 0 && (
                <View style={styles.scanFeedback}>
                    <Text style={styles.scanCounter}>Scanned: {sessionCount}</Text>
                    {scanStatus ? (
                         <Text style={[styles.lastScanText, { color: scanStatus.color, fontWeight: '700' }]} numberOfLines={2}>
                             {scanStatus.message}
                         </Text>
                    ) : (
                        lastScannedCode && <Text style={styles.lastScanText} numberOfLines={1}>Last: {lastScannedCode}</Text>
                    )}
                </View>
                )}
            </View>
            <View style={styles.focusFrameContainer} pointerEvents="none">
                <View style={[styles.focusFrame, sessionCount > 0 ? { borderColor: COLORS.success } : null]} />
            </View>
            </View>
        </Modal>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, paddingHorizontal: 12, paddingTop: 4, paddingBottom: 8 },
  inputCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    padding: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    marginTop: 2,
  },
  inputRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  inputFieldWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f8fafc",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    paddingLeft: 6,
    height: 36,
  },
  input: { flex: 1, fontSize: 13, color: "#1f2937", paddingVertical: 0 },
  scanBtn: { padding: 6 },
  iconBtn: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },
  btnDisabled: { opacity: 0.6 },
  customerCard: {
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 6,
    padding: 6,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderLeftWidth: 3,
    borderLeftColor: COLORS.success,
  },
  fixedField: { flexDirection: "row", alignItems: "flex-start" },
  fixedLabel: { fontSize: 12, color: "#64748b", width: 60, fontWeight: "600" },
  fixedValue: { fontSize: 12, color: "#1e293b", fontWeight: "500", flex: 1 },
  tableCard: {
    flex: 1,
    marginTop: 4,
    backgroundColor: "#fff",
    borderRadius: 6,
    overflow: "hidden",
    elevation: 1,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tableHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 6,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  headerText: { fontSize: 10, fontWeight: "700", color: "#475569" },
  sortBtn: {
     padding: 4,
     backgroundColor: '#fff', 
     borderRadius: 4,
     borderWidth: 1,
     borderColor: '#cbd5e1'
  },
  clearHeaderBtn: {
    backgroundColor: "#fee2e2",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#fecaca",
  },
  clearHeaderText: { color: COLORS.danger, fontWeight: "600", fontSize: 11 },
  row: {
    paddingVertical: 4,
    paddingHorizontal: 6,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    minHeight: 28,
  },
  soText: { fontSize: 11, fontWeight: "500", color: "#334155", flex: 1 },
  deleteBtn: { padding: 4 },
  separator: { height: 1, backgroundColor: "#f1f5f9" },
  emptyText: { textAlign: "center", color: COLORS.muted, padding: 20, fontStyle: "italic", fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 24 },
  modalContent: { backgroundColor: "#fff", borderRadius: 16, padding: 20, width: "100%", maxWidth: 360, elevation: 5 },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#111827", marginLeft: 8 },
  modalDescription: { fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 20 },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  secondaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: "#f3f4f6" },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: { position: "absolute", top: Platform.select({ ios: 44, android: 16 }), left: 16, right: 16, height: 44, borderRadius: 22, backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, justifyContent: "space-between" },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fullscreenCloseBtn: { backgroundColor: "#fff", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  closeBtnText: { fontWeight: "700", color: "#000", fontSize: 13 },
  fullscreenBottomBar: { position: "absolute", bottom: 24, left: 16, right: 16, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.6)", padding: 12, alignItems: "center", gap: 4 },
  fullscreenHint: { color: "#ccc", fontSize: 12 },
  scanFeedback: { alignItems: "center", width: "100%" },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 14 },
  lastScanText: { color: "#fff", fontSize: 13, marginTop: 2, textAlign: "center", width: "100%" },
  focusFrameContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  focusFrame: { width: 240, height: 240, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 20 }
});

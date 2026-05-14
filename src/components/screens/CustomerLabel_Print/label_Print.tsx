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
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import type { JSX } from "react";
import { Audio } from "expo-av";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useVerifySO, usePrintLabels } from "../../Api/Hooks/UselabelPrint";
import { labelPrintStorage } from "../../Storage/label_Print_Storage";
import { useKeyboardDisabled } from "../../utils/keyboard";

type SOItem = {
  id: string; // Client-side unique ID for flatlist
  serverId: number | string; // 🔹 Database ID for API requests
  soNumber: string;
  outboundDelivery?: string;
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
          {title ? (
            <View style={styles.modalHeader}>
              <Ionicons name="alert-circle" size={30} color={COLORS.danger} />
              <Text style={styles.modalTitle}>{title}</Text>
            </View>
          ) : null}
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
            <Ionicons
              name="checkmark-circle-outline"
              size={30}
              color={COLORS.success}
            />
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
  onCancel?: () => void;
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
            {onCancel && (
              <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
                <Text style={styles.secondaryBtnText}>{cancelText}</Text>
              </TouchableOpacity>
            )}
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

const PrintModal = ({
  visible,
  onConfirm,
  onCancel,
}: {
  visible: boolean;
  onConfirm: (quantity: number) => void;
  onCancel: () => void;
}) => {
  const [quantity, setQuantity] = useState(2);

  useEffect(() => {
    if (visible) setQuantity(2);
  }, [visible]);

  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Ionicons name="print-outline" size={30} color={COLORS.accent} />
            <Text style={styles.modalTitle}>Print Labels</Text>
          </View>
          <Text style={styles.modalDescription}>Select quantity to print</Text>

          <View style={styles.quantityContainer}>
            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.max(1, q - 1))}
              style={styles.qtyBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="remove" size={24} color={COLORS.primary} />
            </TouchableOpacity>

            <View style={styles.qtyDisplay}>
              <Text style={styles.qtyText}>{quantity}</Text>
            </View>

            <TouchableOpacity
              onPress={() => setQuantity((q) => Math.min(10, q + 1))}
              style={styles.qtyBtn}
              activeOpacity={0.6}
            >
              <Ionicons name="add" size={24} color={COLORS.primary} />
            </TouchableOpacity>
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onCancel}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.primary }]}
              onPress={() => onConfirm(quantity)}
            >
              <Text style={styles.primaryBtnText}>Print</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const EditCustomerModal = ({
  visible,
  initialData,
  onSave,
  onClose,
}: {
  visible: boolean;
  initialData: {
    cncPacking: string;
    box: string;
  };
  onSave: (data: { cncPacking: string; box: string }) => void;
  onClose: () => void;
}) => {
  const [data, setData] = useState(initialData);

  useEffect(() => {
    if (visible) setData(initialData);
  }, [visible, initialData]);

  return (
    <Modal transparent visible={visible} animationType="slide">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { maxWidth: 400 }]}>
          <View style={styles.modalHeader}>
            <Ionicons name="create" size={24} color={COLORS.accent} />
            <Text style={styles.modalTitle}>Edit Info</Text>
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>CNC Package</Text>
            <TextInput
              style={styles.fieldInput}
              value={data.cncPacking}
              onChangeText={(v) => setData({ ...data, cncPacking: v })}
              showSoftInputOnFocus={true}
            />
          </View>

          <View style={styles.editField}>
            <Text style={styles.fieldLabel}>Box Number</Text>
            <TextInput
              style={styles.fieldInput}
              value={data.box}
              onChangeText={(v) => setData({ ...data, box: v })}
              showSoftInputOnFocus={true}
            />
          </View>

          <View style={styles.modalFooter}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={onClose}>
              <Text style={styles.secondaryBtnText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.primaryBtn, { backgroundColor: COLORS.success }]}
              onPress={() => onSave(data)}
            >
              <Text style={styles.primaryBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const SelectOBDModal = ({
  visible,
  options,
  soNumber,
  onSelect,
  onCancel,
}: {
  visible: boolean;
  options: any[];
  soNumber: string;
  onSelect: (option: any) => void;
  onCancel: () => void;
}) => {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={[styles.modalContent, { paddingHorizontal: 0 }]}>
          <View style={[styles.modalHeader, { paddingHorizontal: 20 }]}>
            <View>
              <Text style={[styles.modalTitle, { marginLeft: 0 }]}>
                Select OBD for {soNumber} ({options.length})
              </Text>
              <Text style={styles.modalSubTitle}>
                Multiple entries found. Please select one:
              </Text>
            </View>
          </View>

          <View style={{ maxHeight: 300, paddingHorizontal: 12 }}>
            <FlatList
              data={options}
              keyExtractor={(item) =>
                item.id?.toString() || item.outboundDelivery
              }
              renderItem={({ item }) => {
                const obdVal = item.outboundDelivery || item.outbound_delivery || item.obd || "N/A";
                const soVal = item.saleOrderNumber || item.sale_order_number || item.so || soNumber;
                return (
                  <TouchableOpacity
                    style={styles.obdOption}
                    onPress={() => onSelect(item)}
                  >
                    <View style={styles.obdIconWrap}>
                      <Ionicons
                        name="document-text-outline"
                        size={24}
                        color={COLORS.accent}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.obdMainText}>OBD: {obdVal}</Text>
                      <Text style={styles.obdSubText}>SO: {soVal}</Text>
                    </View>
                    <Ionicons
                      name="chevron-forward"
                      size={20}
                      color={COLORS.border}
                    />
                  </TouchableOpacity>
                );
              }}
            />
          </View>

          <View
            style={[
              styles.modalFooter,
              {
                marginTop: 10,
                borderTopWidth: 1,
                borderTopColor: COLORS.border,
                padding: 12,
                justifyContent: "center",
              },
            ]}
          >
            <TouchableOpacity onPress={onCancel}>
              <Text
                style={{
                  color: COLORS.danger,
                  fontWeight: "600",
                  fontSize: 16,
                }}
              >
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default function CustomerLabelPrint(): JSX.Element {
  const navigation = useNavigation();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const [soNumber, setSoNumber] = useState<string>("");
  const [sos, setSos] = useState<SOItem[]>([]);
  // sortMode: 'recent' (LIFO), 'asc' (A-Z), 'desc' (Z-A)
  const [sortMode, setSortMode] = useState<"recent" | "asc" | "desc">("asc");
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerAddress, setCustomerAddress] = useState<string | null>(null);
  const [contactNumber, setContactNumber] = useState<string>("");
  const [boxNumber, setBoxNumber] = useState<string>("1/1");
  const [cncPacking, setCncPacking] = useState<string>("CNC PACKAGE");
  const [isCustomerLocked, setIsCustomerLocked] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [tempCustomerData, setTempCustomerData] = useState({
    cncPacking: "CNC PACKAGE",
    box: "1/1",
  });
  const inputRef = useRef<TextInput>(null);

  // Custom hook for global keyboard state
  const [keyboardDisabled] = useKeyboardDisabled();

  // Camera / Scan state
  const [scanModalVisible, setScanModalVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // Multi-scan state
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{
    message: string;
    color: string;
  } | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const sessionCodesRef = useRef<Set<string>>(new Set());

  // Local verifying lock
  const verifyingRef = useRef(false);
  const pendingScansRef = useRef<string[]>([]);
  const [queueTrigger, setQueueTrigger] = useState(0);

  // Modals
  const [errorModal, setErrorModal] = useState({
    visible: false,
    title: "",
    message: "",
    autoDismiss: true,
  });
  const [successModal, setSuccessModal] = useState({
    visible: false,
    message: "",
    autoDismiss: true,
  });
  const [printConfirmModal, setPrintConfirmModal] = useState(false);
  const [clearConfirmModal, setClearConfirmModal] = useState(false);
  const [limitModalVisible, setLimitModalVisible] = useState(false);
  const [mismatchModal, setMismatchModal] = useState({
    visible: false,
    newName: "",
    soToAdd: "",
  });

  const [obdModal, setObdModal] = useState({
    visible: false,
    options: [] as any[],
    soNumber: "",
    fromScanner: false,
  });

  const {
    verifySO,
    loading: verifyLoading,
    error: verifyError,
  } = useVerifySO();
  const {
    printLabels,
    loading: printLoading,
    error: printError,
    success: printSuccess,
  } = usePrintLabels();

  // Load saved session
  useEffect(() => {
    const loadData = async () => {
      const saved = await labelPrintStorage.load();
      if (saved?.sos?.length > 0) {
        setSos(saved.sos);
        setCustomerName(saved.customerName);
        setCustomerAddress(saved.customerAddress);
        setContactNumber(saved.contactNumber || "");
        setBoxNumber(saved.boxNumber || "1/1");
        setCncPacking(saved.cncPacking || "CNC PACKING");
        // Ensure customer is locked if we have name
        setIsCustomerLocked(!!saved.customerName || saved.isCustomerLocked);
      }
    };
    loadData();
  }, []);

  // Auto-save session
  useEffect(() => {
    labelPrintStorage.save({
      sos,
      customerName,
      customerAddress,
      contactNumber,
      boxNumber,
      cncPacking,
      isCustomerLocked,
    });
  }, [
    sos,
    customerName,
    customerAddress,
    contactNumber,
    boxNumber,
    cncPacking,
    isCustomerLocked,
  ]);

  // Focus Management
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }, []),
  );

  useEffect(() => {
    const anyModalOpen =
      scanModalVisible ||
      errorModal.visible ||
      successModal.visible ||
      printConfirmModal ||
      clearConfirmModal ||
      mismatchModal.visible ||
      limitModalVisible ||
      editModalVisible;
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
    editModalVisible,
    navigation,
  ]);

  const handleBlur = () => {
    const anyModalOpen =
      scanModalVisible ||
      errorModal.visible ||
      successModal.visible ||
      printConfirmModal ||
      clearConfirmModal ||
      mismatchModal.visible ||
      limitModalVisible ||
      editModalVisible;
    if (keyboardDisabled && !anyModalOpen) {
      setTimeout(() => {
        if (navigation.isFocused() && !anyModalOpen) {
          inputRef.current?.focus();
        }
      }, 100);
    }
  };

  const triggerVibration = async (duration = 400) => {
    try {
      const vResult = await AsyncStorage.getItem("vibrationEnabled");
      if (vResult === null || vResult === "true") {
        Vibration.vibrate(duration);
      }
    } catch (e) {
      console.log("Vibration error", e);
    }
  };

  const playErrorSound = async () => {
    try {
      const sResult = await AsyncStorage.getItem("soundEnabled");
      if (sResult !== null && sResult !== "true") return;
      await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
      const { sound } = await Audio.Sound.createAsync(
        require("../../assets/sounds/error.mp3")
      );
      await sound.playAsync();
      setTimeout(async () => {
        await sound.stopAsync();
        await sound.unloadAsync();
      }, 1000);
    } catch (error) {
      console.log("Sound error", error);
    }
  };

  useEffect(() => {
    if (printSuccess) {
      setSuccessModal({
        visible: true,
        message: printSuccess,
        autoDismiss: true,
      });
    }
  }, [printSuccess]);

  useEffect(() => {
    if (printError) {
      playErrorSound();
      setErrorModal({
        visible: true,
        title: "Print Failed",
        message:
          typeof printError === "string" ? printError : String(printError),
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
    playErrorSound();
    triggerVibration(400);
    setErrorModal({ visible: true, title, message, autoDismiss });
  };

  const openScanner = async () => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted)
          return showError(
            "Permission Required",
            "Allow camera access to scan.",
          );
      } else if (!permission.granted) {
        if (!permission.canAskAgain)
          return showError(
            "Camera Disabled",
            "Please enable camera access.",
            false,
          );
        const res = await requestPermission();
        if (!res.granted)
          return showError(
            "Permission Denied",
            "Camera permission is required.",
          );
      }

      sessionCodesRef.current.clear();
      pendingScansRef.current = [];
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

    // 🔹 Debounce: Prevent rapid-fire scanning of the EXACT same result in < 2 seconds
    const now = Date.now();
    if (value === lastProcessedRef.current.code && now - lastProcessedRef.current.time < 2000) {
      return;
    }

    lastProcessedRef.current = { code: value, time: now };
    triggerVibration(100);
    setLastScannedCode(value);
    setSessionCount((prev) => prev + 1);
    
    // Use the pending scans queue logic via addSO
    addSO(value, true);
  };

  // Debounce tracking
  const lastProcessedRef = useRef({ code: "", time: 0 });

  const addSO = async (value?: string, fromScanner = false) => {
    const soToAdd = (value || soNumber).trim().toUpperCase();
    if (!soToAdd) {
      if (!value) {
        showError("Empty Input", "Please enter or scan a Sales Order.");
        setSoNumber("");
        focusInput();
      }
      return;
    }

    if (fromScanner) {
      pendingScansRef.current.push(soToAdd);
      setQueueTrigger((c) => c + 1);
      return;
    }
    if (verifyingRef.current) {
      showError("Please wait", "Processing...", true);
      return;
    }

    verifyingRef.current = true;
    try {
      await coreAddSO(soToAdd, false);
    } finally {
      verifyingRef.current = false;
      // Check if queue has built up during manual processing
      setQueueTrigger((c) => c + 1);
    }
  };

  const coreAddSO = async (soToAdd: string, fromScanner: boolean) => {
    if (sos.length >= 15) {
      pendingScansRef.current = [];
      playErrorSound();
      if (fromScanner) {
        setScanStatus({ message: "Max 15 reached", color: COLORS.danger });
        triggerVibration(400);
        closeScanner();
      }
      setSoNumber("");
      setLimitModalVisible(true);
      return;
    }

    // 🔹 MOVED: Duplicate check moved to finalizeAddSO to support same SO with different OBD

    try {
      const result = await verifySO(soToAdd);
      if (!result) {
        const errMsg = verifyError
          ? typeof verifyError === "string"
            ? verifyError
            : String(verifyError)
          : "Sales Order not found.";
        if (fromScanner) {
          playErrorSound();
          setScanStatus({
            message: "Invalid: " + soToAdd,
            color: COLORS.danger,
          });
          triggerVibration(400);
          return;
        }
        showError("Invalid SO", errMsg, true);
        setSoNumber("");
        if (!scanModalVisible) focusInput();
        return;
      }

      const resultsArray = Array.isArray(result) ? result : [result];
      const filteredResults = (resultsArray as any[]).filter((r: any) => {
        const obd = r.outboundDelivery || r.outbound_delivery || r.obd;
        return !sos.some((s) => s.soNumber === soToAdd && s.outboundDelivery === obd);
      });

      if (filteredResults.length === 0) {
        // All OBDs for this SO are already in the list
        const msg = `"${soToAdd}" is already in the list.`;
        if (fromScanner) {
          playErrorSound();
          setScanStatus({ message: "Duplicate: " + soToAdd, color: COLORS.warning });
          triggerVibration(400);
          return;
        }
        showError("", msg, false);
        setSoNumber("");
        if (!scanModalVisible) focusInput();
        return;
      }

      // 🔹 If SO has multiple deliveries in total, always show selection modal to avoid "automatic" addition
      if (resultsArray.length > 1) {
        setObdModal({
          visible: true,
          options: filteredResults,
          soNumber: soToAdd,
          fromScanner,
        });
        return;
      }

      // Handle single result (where only 1 OBD exists for this SO)
      await finalizeAddSO(filteredResults[0], soToAdd, fromScanner);
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (fromScanner) {
        playErrorSound();
        setScanStatus({ message: "Error: " + msg, color: COLORS.danger });
        triggerVibration(400);
        return;
      }
      showError("Invalid SO", msg || "Sales Order not found.", true);
      setSoNumber("");
      if (!scanModalVisible) focusInput();
    }
  };

  const handleSelectOBD = async (selected: any) => {
    const isScan = obdModal.fromScanner;
    const soNumberVal = obdModal.soNumber;
    setObdModal({ ...obdModal, visible: false });
    
    // Clear debounce to allow scanning the same SO again immediately
    lastProcessedRef.current = { code: "", time: 0 };
    
    await finalizeAddSO(selected, soNumberVal, isScan);
  };

  const finalizeAddSO = async (
    result: any,
    soToAdd: string,
    fromScanner: boolean,
  ) => {
    // 🔹 Flexible field extraction to handle different API response formats
    const newName = result?.customerName || result?.customer_name || result?.customer || "Unknown Customer";
    const newAddress = result?.address || result?.customerAddress || result?.customer_address || "Address not available";
    const newMobile = result?.contactNumber || result?.contact_number || result?.mobile || "";
    const newOBD = result?.outboundDelivery || result?.outbound_delivery || result?.obd || "";

    // Check if this specific SO+OBD is already in the list
    if (
      sos.some((i) => i.soNumber === soToAdd && i.outboundDelivery === newOBD)
    ) {
      if (fromScanner) {
        playErrorSound();
        setScanStatus({
          message: "Duplicate: " + soToAdd,
          color: COLORS.warning,
        });
        triggerVibration(400);
        return;
      }
      showError("", `"${soToAdd}" with OBD "${newOBD}" is already in the list.`, false);
      setSoNumber("");
      if (!scanModalVisible) focusInput();
      return;
    }

    const currentNameNorm = customerName ? customerName.trim().toLowerCase() : "";
    const newNameNorm = newName ? newName.trim().toLowerCase() : "";

    const isFirstItem = sos.length === 0;
    const hasNoCustomer = !customerName || !customerName.trim();

    // 🔹 FIX: Always set customer info if it's currently missing
    if (isFirstItem || hasNoCustomer) {
      setCustomerName(newName);
      setCustomerAddress(newAddress);
      setContactNumber(newMobile || "N/A");
      setIsCustomerLocked(true);
      if (fromScanner)
        setScanStatus({
          message: "Added: " + soToAdd,
          color: COLORS.success,
        });
    } else if (currentNameNorm !== newNameNorm) {
      if (fromScanner) {
        playErrorSound();
        setScanStatus({ message: "Mismatch Ignored", color: COLORS.danger });
        triggerVibration(400);
        return;
      }
      playErrorSound();
      setSoNumber("");
      setMismatchModal({
        visible: true,
        newName: newName || "Unknown",
        soToAdd: soToAdd,
      });
      return;
    } else {
      // Already has customer and it matches or was just set
      setIsCustomerLocked(true);
      if (fromScanner)
        setScanStatus({
          message: "Added: " + soToAdd,
          color: COLORS.success,
        });
    }

    const newItem: SOItem = {
      id: Date.now().toString() + Math.random().toString().slice(2, 5),
      serverId: result.id, // 🔹 Capture the database ID from API (e.g., 31)
      soNumber: soToAdd,
      outboundDelivery: newOBD,
    };

    setSos((prev) => [newItem, ...prev]);
    setSoNumber("");

    if (!scanModalVisible) focusInput();
  };

  useEffect(() => {
    const processQueue = async () => {
      // If already processing, let it finish.
      if (verifyingRef.current) return;
      // If queue is empty, stop.
      if (pendingScansRef.current.length === 0) return;

      verifyingRef.current = true;
      const soToAdd = pendingScansRef.current.shift();

      try {
        if (soToAdd) await coreAddSO(soToAdd, true);
      } catch (err) {
        console.error("Queue process error:", err);
      } finally {
        verifyingRef.current = false;
        // Trigger next if items remain
        if (pendingScansRef.current.length > 0) {
          setQueueTrigger((c) => c + 1);
        }
      }
    };
    processQueue();
  }, [
    queueTrigger,
    sos,
    customerName,
    isCustomerLocked,
    verifyError,
    scanModalVisible,
  ]);

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
    if (sos.length === 0)
      return showError("Nothing to Print", "Add at least one valid SO first.");
    setPrintConfirmModal(true);
  };

  const confirmPrint = async (quantity: number = 2) => {
    setPrintConfirmModal(false);

    // 🔹 Collect the server database IDs and ensure they are numbers
    const salesOrderIds = sos.map((item) => Number(item.serverId));

    // Call print with an object to prevent argument mismatch
    await printLabels({
      ids: salesOrderIds,
      cncText: cncPacking,
      boxNN: boxNumber,
      quantity: quantity,
    });
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
    setContactNumber("");
    setBoxNumber("1/1");
    setCncPacking("CNC PACKING");
    setIsCustomerLocked(false);
    setSoNumber("");
    await labelPrintStorage.clear();
    focusInput();
  };

  // Sorting Logic
  const toggleSortMode = () => {
    setSortMode((prev) => {
      if (prev === "recent") return "asc";
      if (prev === "asc") return "desc";
      return "recent";
    });
  };

  const sortedSos = React.useMemo(() => {
    if (sortMode === "recent") {
      return sos; // sos is already LIFO
    }
    return [...sos].sort((a, b) => {
      if (sortMode === "asc") {
        return a.soNumber.localeCompare(b.soNumber);
      } else {
        return b.soNumber.localeCompare(a.soNumber);
      }
    });
  }, [sos, sortMode]);

  const renderRow = ({ item }: { item: SOItem }) => (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.soText}>{item.soNumber}</Text>
        {/* 🔹 Show OBD only if this SO number is a duplicate in the list */}
        {sos.filter((s) => s.soNumber === item.soNumber).length > 1 &&
          item.outboundDelivery && (
            <Text style={styles.obdListText}>
              OBD: {item.outboundDelivery}
            </Text>
          )}
      </View>
      <TouchableOpacity
        onPress={() => removeSO(item.id)}
        style={styles.deleteBtn}
      >
        <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
      </TouchableOpacity>
    </View>
  );

  const isLoading = printLoading;

  const getSortIcon = () => {
    switch (sortMode) {
      case "asc":
        return "sort-alphabetical-ascending";
      case "desc":
        return "sort-alphabetical-descending";
      default:
        return "history";
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={[
          styles.container,
          isLandscape && { flexDirection: "row", gap: 12 },
        ]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <StatusBar barStyle="dark-content" backgroundColor={COLORS.bg} />

        <View
          style={isLandscape ? { width: "35%", gap: 4 } : { width: "100%" }}
        >
          <View style={[styles.inputCard, isLandscape && { marginTop: 0 }]}>
            <View style={styles.inputRow}>
              <View style={styles.inputFieldWrapper}>
                <TextInput
                  ref={inputRef}
                  value={soNumber}
                  onChangeText={setSoNumber}
                  placeholder={
                    keyboardDisabled ? "Scan SO..." : "Enter or scan"
                  }
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
                <Pressable
                  onPress={openScanner}
                  disabled={isLoading}
                  style={styles.scanBtn}
                >
                  <MaterialCommunityIcons
                    name="qrcode-scan"
                    size={20}
                    color={isLoading ? "#ccc" : COLORS.accent}
                  />
                </Pressable>
              </View>
              <TouchableOpacity
                onPress={() => addSO()}
                disabled={isLoading || !soNumber.trim()}
                style={[
                  styles.iconBtn,
                  { backgroundColor: COLORS.success },
                  (isLoading || !soNumber.trim()) && styles.btnDisabled,
                ]}
              >
                <Ionicons name="add" size={20} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={onPrint}
                disabled={isLoading || sos.length === 0}
                style={[
                  styles.iconBtn,
                  { backgroundColor: COLORS.primary },
                  (isLoading || sos.length === 0) && styles.btnDisabled,
                ]}
              >
                <Ionicons name="print" size={20} color="#fff" />
              </TouchableOpacity>
            </View>
          </View>

          {!!customerName && (
            <TouchableOpacity
              activeOpacity={0.7}
              style={styles.customerCard}
              onPress={() => {
                setTempCustomerData({
                  cncPacking: cncPacking,
                  box: boxNumber,
                });
                setEditModalVisible(true);
              }}
            >
              <View style={styles.fixedField}>
                <Text style={styles.fixedLabel}>Customer</Text>
                <Text style={styles.fixedValue}>{customerName}</Text>
              </View>
              <View style={[styles.fixedField, { marginTop: 2 }]}>
                <Text style={styles.fixedLabel}>Address</Text>
                <Text style={styles.fixedValue}>{customerAddress}</Text>
              </View>
              <View style={[styles.fixedField, { marginTop: 2 }]}>
                <Text style={styles.fixedLabel}>Contact</Text>
                <Text style={styles.fixedValue}>{contactNumber || "N/A"}</Text>
              </View>

              <View style={styles.divider} />

              <Text style={styles.cardHeading}>{cncPacking}</Text>

              <View
                style={[
                  styles.fixedField,
                  { marginTop: 4, alignItems: "center" },
                ]}
              >
                <Text style={styles.fixedLabel}>Box No:</Text>
                <Text
                  style={[
                    styles.fixedValue,
                    { color: COLORS.accent, fontWeight: "700" },
                  ]}
                >
                  {boxNumber}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        </View>

        <View style={[styles.tableCard, isLandscape && { marginTop: 0 }]}>
          <View style={styles.tableHeader}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                flex: 1,
              }}
            >
              <Text style={styles.headerText}>
                SOs {sos.length > 0 && `(${sos.length})`}
              </Text>
              {sos.length > 0 && (
                <TouchableOpacity
                  onPress={toggleSortMode}
                  style={styles.sortBtn}
                >
                  <MaterialCommunityIcons
                    name={getSortIcon()}
                    size={16}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
              )}
            </View>
            {sos.length > 0 && (
              <TouchableOpacity
                onPress={onClearAll}
                style={styles.clearHeaderBtn}
              >
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
                {isCustomerLocked
                  ? "Scan or type to begin."
                  : "Scan first SO to confirm customer."}
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

        <PrintModal
          visible={printConfirmModal}
          onConfirm={(qty) => confirmPrint(qty)}
          onCancel={() => {
            setPrintConfirmModal(false);
            focusInput();
          }}
        />

        <ConfirmModal
          visible={clearConfirmModal}
          title="Clear all?"
          message="This will clear the current session."
          confirmText="Clear"
          cancelText="No"
          type="danger"
          onConfirm={confirmClearAll}
          onCancel={() => {
            setClearConfirmModal(false);
            focusInput();
          }}
        />

        <ConfirmModal
          visible={mismatchModal.visible}
          title="Customer Mismatch"
          message={`Expected: ${customerName}\nFound: ${mismatchModal.newName}`}
          confirmText="OK"
          type="primary"
          onConfirm={handleMismatchConfirm}
        />

        <SelectOBDModal
          visible={obdModal.visible}
          options={obdModal.options}
          soNumber={obdModal.soNumber}
          onSelect={handleSelectOBD}
          onCancel={() => {
            setObdModal({ ...obdModal, visible: false });
            // Also clear debounce on cancel
            lastProcessedRef.current = { code: "", time: 0 };
            focusInput();
          }}
        />

        <ConfirmModal
          visible={limitModalVisible}
          title="Limit Exceeded"
          message="Maximum 15 SOs allowed. Please print and start a new session."
          confirmText="Print"
          cancelText="Cancel"
          type="primary"
          onConfirm={() => {
            setLimitModalVisible(false);
            if (scanModalVisible) closeScanner();
            confirmPrint(2); // Default quantity
          }}
          onCancel={() => {
            setLimitModalVisible(false);
            focusInput();
          }}
        />

        <EditCustomerModal
          visible={editModalVisible}
          initialData={tempCustomerData}
          onClose={() => setEditModalVisible(false)}
          onSave={(data) => {
            setCncPacking(data.cncPacking);
            setBoxNumber(data.box);
            setEditModalVisible(false);
          }}
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
                barcodeTypes: [
                  "qr",
                  "code128",
                  "ean13",
                  "ean8",
                  "upc_a",
                  "upc_e",
                  "code39",
                  "codabar",
                  "code93",
                  "pdf417",
                  "datamatrix",
                ],
              }}
              onBarcodeScanned={handleBarcodeScanned}
            />
            <View style={styles.fullscreenTopBar}>
              <Text style={styles.fullscreenTitle}>Multi-Scan</Text>
              <Pressable
                onPress={closeScanner}
                style={styles.fullscreenCloseBtn}
              >
                <Text style={styles.closeBtnText}>Done</Text>
              </Pressable>
            </View>
            <View style={styles.fullscreenBottomBar}>
              <Text style={styles.fullscreenHint}>
                Align codes within frame
              </Text>
              {sessionCount > 0 && (
                <View style={styles.scanFeedback}>
                  <Text style={styles.scanCounter}>
                    Scanned: {sessionCount}
                  </Text>
                  {scanStatus ? (
                    <Text
                      style={[
                        styles.lastScanText,
                        { color: scanStatus.color, fontWeight: "700" },
                      ]}
                      numberOfLines={2}
                    >
                      {scanStatus.message}
                    </Text>
                  ) : (
                    lastScannedCode && (
                      <Text style={styles.lastScanText} numberOfLines={1}>
                        Last: {lastScannedCode}
                      </Text>
                    )
                  )}
                </View>
              )}
            </View>
            <View style={styles.focusFrameContainer} pointerEvents="none">
              <View
                style={[
                  styles.focusFrame,
                  sessionCount > 0 ? { borderColor: COLORS.success } : null,
                ]}
              />
            </View>
          </View>
        </Modal>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 4,
    paddingBottom: 8,
  },
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
    justifyContent: "center",
    alignItems: "center",
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

  divider: {
    height: 1,
    backgroundColor: "#f1f5f9",
    marginVertical: 6,
  },
  cardHeading: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  editField: {
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 4,
  },
  fieldInput: {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    fontSize: 14,
    color: "#1e293b",
    backgroundColor: "#f8fafc",
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
    backgroundColor: "#fff",
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#cbd5e1",
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
  emptyText: {
    textAlign: "center",
    color: COLORS.muted,
    padding: 20,
    fontStyle: "italic",
    fontSize: 13,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 20,
    width: "100%",
    maxWidth: 360,
    elevation: 5,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    marginLeft: 8,
  },
  modalDescription: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 20,
    lineHeight: 20,
  },
  modalFooter: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  secondaryBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#f3f4f6",
  },
  secondaryBtnText: { fontSize: 14, fontWeight: "600", color: "#374151" },
  primaryBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 },
  primaryBtnText: { fontSize: 14, fontWeight: "600", color: "#fff" },
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.select({ ios: 44, android: 16 }),
    left: 16,
    right: 16,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 15 },
  fullscreenCloseBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  closeBtnText: { fontWeight: "700", color: "#000", fontSize: 13 },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 12,
    alignItems: "center",
    gap: 4,
  },
  fullscreenHint: { color: "#ccc", fontSize: 12 },
  scanFeedback: { alignItems: "center", width: "100%" },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 14 },
  lastScanText: {
    color: "#fff",
    fontSize: 13,
    marginTop: 2,
    textAlign: "center",
    width: "100%",
  },
  focusFrameContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  focusFrame: {
    width: 240,
    height: 240,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 20,
  },
  quantityContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 24,
    marginVertical: 20,
  },
  qtyBtn: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2e8f0",
  },
  qtyDisplay: {
    minWidth: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  qtyText: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.primary,
  },
  modalSubTitle: {
    fontSize: 12,
    color: COLORS.muted,
    marginTop: 2,
  },
  obdOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#f1f5f9",
    marginBottom: 8,
    gap: 12,
  },
  obdIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
  },
  obdMainText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1e293b",
  },
  obdSubText: {
    fontSize: 11,
    color: COLORS.muted,
    marginTop: 1,
  },
  obdListText: {
    fontSize: 10,
    color: COLORS.accent,
    fontWeight: "500",
  },
});

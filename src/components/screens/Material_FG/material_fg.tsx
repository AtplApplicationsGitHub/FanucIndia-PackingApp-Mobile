import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StatusBar,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { assignFgLocation, type AssignLocationResponse } from "../../Api/Hooks/Usematerial_fg";
import { 
  clearMaterialFGData, 
  loadMaterialFGData, 
  saveMaterialFGData,
  loadMaterialFGLocation,
  saveMaterialFGLocation,
  clearMaterialFGLocation
} from "../../Storage/material_fg_Storage";
import { useKeyboardDisabled } from "../../utils/keyboard";

type ScanItem = {
  id: string;
  location: string;
  soNumber: string;
  timeISO: string;
};

// Colors matching putaway.tsx for consistency
const COLORS = {
  bg: "#F7F7F8",
  card: "#FFFFFF",
  border: "#E6E7EB",
  text: "#0B0F19",
  subtext: "#667085",
  accent: "#111827",
  primary: "#FACC15",
  primarySoft: "#FFF7CC",
  danger: "#EF4444",
  muted: "#9CA3AF",
  tableStripe: "#FAFAFB",
  success: "#10B981",
};

// ---------- Helpers ----------
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const hh = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ampm}`;
};

// ---------- Dialog Component ----------
type DialogProps = {
  visible: boolean;
  icon?: React.ReactNode;
  title: string;
  message?: string;
  cancelText?: string;
  okText?: string;
  destructive?: boolean;
  onCancel?: () => void;
  onOk?: () => void;
  oneButton?: boolean;
};

const Dialog: React.FC<DialogProps> = ({
  visible,
  icon,
  title,
  message,
  cancelText = "Cancel",
  okText = "OK",
  destructive,
  onCancel,
  onOk,
  oneButton,
}) => (
  <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
    <View style={styles.modalBackdrop}>
      <Pressable style={styles.modalBackdropTouchable} onPress={onCancel} />
      <View style={styles.modalCard}>
        <View style={styles.modalHeader}>
          {icon}
          <Text style={styles.modalTitle}>{title}</Text>
        </View>
        {!!message && <Text style={styles.modalMessage}>{message}</Text>}

        <View style={styles.modalActions}>
          {!oneButton && (
            <TouchableOpacity style={[styles.btn, styles.btnGhost2]} onPress={onCancel}>
              <Text style={[styles.btnGhost2Text]}>{cancelText}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[
              styles.btn,
              destructive ? styles.btnDestructive : styles.btnPrimary2,
              oneButton && { flex: 1 },
            ]}
            onPress={onOk}
          >
            <Text style={styles.btnPrimary2Text}>{okText}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  </Modal>
);

const MaterialFGTransferScreen: React.FC = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);

  // Refs
  const locationRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  // Custom hook for global keyboard state
  const [keyboardDisabled] = useKeyboardDisabled();

  // Camera / Scan state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModal, setScanModal] = useState<{ visible: boolean; target: "location" | "so" | null }>({
    visible: false,
    target: null,
  });
  
  // Multi-scan state (for SO scanning)
  const [sessionCount, setSessionCount] = useState(0);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);
  const sessionCodesRef = useRef<Set<string>>(new Set());
  
  // Lock for Location scanning single-shot
  const scanLockRef = useRef(false);

  // Ref to track location value without triggering re-renders in effects
  const locationValueRef = useRef(location);

  // Update logic flow refs
  useEffect(() => {
    locationValueRef.current = location;
  }, [location]);

  // Dialogs
  const [confirmClear, setConfirmClear] = useState(false);
  const [messageDlg, setMessageDlg] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    onOk?: () => void;
  }>({ show: false, title: "" });

  const totalScanned = items.length;

  // --- Focus Management ---

  // 1. Focus on mount / focus effect
  // Prioritize Location if empty, otherwise SO
  // 1. Focus on mount / focus effect
  // Prioritize Location if empty, otherwise SO
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        // Use ref here to prevent re-running on every type
        if (!locationValueRef.current) {
          locationRef.current?.focus();
        } else {
          soRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  // 2. Refocus when "Scan Only" (keyboardDisabled) is enabled
  //    or when modals close.
  useEffect(() => {
    if (keyboardDisabled && !scanModal.visible && !messageDlg.show && !confirmClear) {
      const timer = setTimeout(() => {
        if (navigation.isFocused()) {
           if (!locationValueRef.current) {
             locationRef.current?.focus();
           } else {
             soRef.current?.focus();
           }
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [keyboardDisabled, scanModal.visible, messageDlg.show, confirmClear, navigation]);

  const handleBlur = () => {
     if (keyboardDisabled && !scanModal.visible && !messageDlg.show && !confirmClear) {
      setTimeout(() => {
        if (navigation.isFocused() && !scanModal.visible && !messageDlg.show && !confirmClear) {
           // Decide which to focus
           if (!location) locationRef.current?.focus();
           else soRef.current?.focus();
        }
      }, 100);
    }
  };

  // Load persisted data
  useEffect(() => {
    const initStorage = async () => {
      const [storedData, storedLocation] = await Promise.all([
        loadMaterialFGData(),
        loadMaterialFGLocation()
      ]);
      
      if (storedData) {
        setItems(storedData);
      }
      if (storedLocation) {
        setLocation(storedLocation);
        // If location is already there, we might want to focus SO, 
        // but the focus maintenance hook might need a tick to realize it.
      }
    };
    initStorage();
  }, []);

  // Persist location on change
  useEffect(() => {
    saveMaterialFGLocation(location);
  }, [location]);

  const showMessage = (title: string, subtitle?: string, onOk?: () => void) =>
    setMessageDlg({ show: true, title, subtitle, onOk });

  // Separate function to perform the logic of adding an item (used by Manual Entry and Scanner)
  const performAddItem = async (targetSo: string, targetLoc: string) => {
      const res: AssignLocationResponse = await assignFgLocation({
        saleOrderNumber: targetSo,
        fgLocation: targetLoc,
      });

      // On success, add/update locally
      const existingIndex = items.findIndex(
        (item) => item.location === targetLoc && item.soNumber === targetSo
      );
      const newTimeISO = new Date().toISOString();
      
      let updatedItems;

      if (existingIndex !== -1) {
          updatedItems = items.map((item, i) =>
            i === existingIndex ? { ...item, timeISO: newTimeISO } : item
          );
      } else {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        updatedItems = [{ id, location: targetLoc, soNumber: targetSo, timeISO: newTimeISO }, ...items];
      }
      
      setItems(updatedItems);
      saveMaterialFGData(updatedItems);
      return updatedItems;
  };

  const addItem = async () => {
    const loc = location.trim();
    const so = soNumber.trim();

    if (!loc) {
      showMessage("Missing location", "Please enter or scan a location.", () => {
        locationRef.current?.focus();
      });
      return;
    }
    if (!so) {
      showMessage("Missing SO number", "Please enter or scan a Sales Order number.", () => {
        soRef.current?.focus();
      });
      return;
    }

    try {
      await performAddItem(so, loc);
      
      setSoNumber("");
      
      // Focus SO again
      requestAnimationFrame(() => {
         soRef.current?.focus();
      });

    } catch (error: any) {
      setSoNumber("");
      showMessage(
        "SO Number Not Found",
        error.message,
        () => {
          setMessageDlg({ show: false, title: "" });
          soRef.current?.focus();
        }
      );
    }
  };

  const clearForm = async () => {
    setLocation("");
    setSoNumber("");
    setItems([]);
    setItems([]);
    await Promise.all([
      clearMaterialFGData(),
      clearMaterialFGLocation() // Clear stored location too
    ]);
    setConfirmClear(false);
    setTimeout(() => locationRef.current?.focus(), 50);
  };

  // --- Scanner Logic ---
  const openScanner = async (target: "location" | "so") => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted) {
          showMessage("Permission Required", "Allow camera access to scan QR codes.");
          return;
        }
      } else if (!permission.granted) {
          if (!permission.canAskAgain) {
             showMessage("Camera Disabled", "Please enable camera access in your device settings.");
             return;
          }
          const res = await requestPermission();
          if (!res.granted) {
            showMessage("Permission Denied", "Camera permission is required.");
            return;
          }
      }

      scanLockRef.current = false;

      // Reset Multi-scan state if scanning SO
      if (target === "so") {
          sessionCodesRef.current.clear();
          setSessionCount(0);
          setLastScannedCode(null);
          setScanError(null);
      }

      setScanModal({ visible: true, target });
    } catch (err) {
      console.log(err);
      showMessage("Error", "Failed to access camera permission.");
    }
  };

  const closeScanner = () => setScanModal({ visible: false, target: null });

  const handleScanned = async (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;

    // --- Location Scanning (Single Shot) ---
    if (scanModal.target === "location") {
        if (scanLockRef.current) return;
        scanLockRef.current = true;

        Vibration.vibrate();
        setLocation(value);
        closeScanner();
        // Wait for modal to close then focus SO
        setTimeout(() => soRef.current?.focus(), 300);
        scanLockRef.current = false;
        return;
    }

    // --- SO Scanning (Multi Scan) ---
    if (scanModal.target === "so") {
        // Prevent duplicate scans in same session
        if (sessionCodesRef.current.has(value)) return;

        // Verify Location exists
        const currentLoc = location.trim();
        if (!currentLoc) {
            // Should not happen if UX is followed, but if it does:
            setScanError("No Location Set!");
            Vibration.vibrate();
            return;
        }

        // Add to session to block immediate re-scan
        sessionCodesRef.current.add(value);
        Vibration.vibrate();

        try {
            setScanError(null);
            
            // Call API and update state
            await performAddItem(value, currentLoc);

            // Update Feedback
            setLastScannedCode(value);
            setSessionCount(prev => prev + 1);
            
        } catch (error: any) {
            console.log("Scan failed for", value, error);
            setScanError(error.message || "Invalid SO");
            // Optionally remove from sessionRefs to allow retry? 
            // Better to keep it blocked to prevent spamming the error. 
            // User can close re-open to clear session if really needed, 
            // or we could use a timeout to remove it.
        }
    }
  };

  const viewItem = (item: ScanItem) => {
    setMessageDlg({
      show: true,
      title: "View entry",
      subtitle: `SO ${item.soNumber} @ ${item.location}`,
    });
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          {/* Form Card */}
          <View style={styles.card}>
            {/* Location */}
            <View style={styles.field}>
              <TextInput
                ref={locationRef}
                value={location}
                onChangeText={setLocation}
                placeholder={keyboardDisabled ? "Scan Location..." : "Enter/scan Location"}
                placeholderTextColor={COLORS.muted}
                returnKeyType="next"
                onSubmitEditing={() => soRef.current?.focus()}
                style={styles.input}
                autoCapitalize="none"
                blurOnSubmit={false}
                showSoftInputOnFocus={!keyboardDisabled}
                onBlur={handleBlur}
              />
              <View style={styles.inputDivider} />
              <Pressable onPress={() => openScanner("location")} hitSlop={8} style={styles.scanIconBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.accent} />
              </Pressable>
            </View>

            {/* SO Number */}
            <View style={styles.field}>
              <TextInput
                ref={soRef}
                value={soNumber}
                onChangeText={setSoNumber}
                placeholder={keyboardDisabled ? "Scan SO Number..." : "Enter/scan SO Number"}
                placeholderTextColor={COLORS.muted}
                returnKeyType="done"
                onSubmitEditing={addItem}
                style={styles.input}
                autoCapitalize="none"
                blurOnSubmit={false}
                showSoftInputOnFocus={!keyboardDisabled}
                onBlur={handleBlur}
              />
              <View style={styles.inputDivider} />
              <Pressable onPress={() => openScanner("so")} hitSlop={8} style={styles.scanIconBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.accent} />
              </Pressable>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={addItem} activeOpacity={0.85}>
                <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnGhost} onPress={() => setConfirmClear(true)} activeOpacity={0.85}>
                <Ionicons name="close-circle-outline" size={16} color={COLORS.accent} />
                <Text style={styles.btnGhostText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Table Card */}
          <View style={styles.tableCard}>
            <Text style={styles.metric}>
              <Text style={styles.metricLabel}>Total Scanned: </Text>
              <Text style={styles.metricValue}>{totalScanned}</Text>
            </Text>

            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 0.6 }]}>S/No</Text>
              <Text style={[styles.th, { flex: 2 }]}>Location</Text>
              <Text style={[styles.th, { flex: 2 }]}>SO Number</Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>Time</Text>
            </View>

            <FlatList
              data={items}
              keyExtractor={(x) => x.id}
              style={styles.flatList}
              contentContainerStyle={{ paddingBottom: 8 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons name="clipboard-text-outline" size={28} color={COLORS.muted} />
                  <Text style={styles.emptyText}>No scans yet</Text>
                  <Text style={styles.emptySub}>Scan a location and SO, then press Save.</Text>
                </View>
              }
              renderItem={({ item, index }) => (
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => viewItem(item)}
                >
                  <View
                    style={[
                      styles.tr,
                      { backgroundColor: index % 2 === 0 ? COLORS.tableStripe : "#FFFFFF" },
                    ]}
                  >
                    <Text style={[styles.td, { flex: 0.6 }]}>{index + 1}</Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.location}</Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.soNumber}</Text>
                    <Text style={[styles.td, { flex: 1.4, textAlign: "right" }]}>{fmtTime(item.timeISO)}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Confirm Clear Dialog */}
      <Dialog
        visible={confirmClear}
        icon={<Ionicons name="trash-outline" size={22} color={COLORS.danger} />}
        title="Clear all?"
        message="This will clear the form and all scanned items."
        cancelText="Keep"
        okText="Clear"
        destructive
        onCancel={() => setConfirmClear(false)}
        onOk={clearForm}
      />

      {/* Message Dialog */}
      <Dialog
        visible={messageDlg.show}
        icon={
          <Ionicons
            name={messageDlg.title === "Success" ? "checkmark-circle-outline" : "information-circle-outline"}
            size={22}
            color={messageDlg.title === "Success" ? COLORS.primary : COLORS.accent}
          />
        }
        title={messageDlg.title}
        message={messageDlg.subtitle}
        okText="OK"
        oneButton={true}
        onOk={() => {
          messageDlg.onOk?.();
          setMessageDlg({ show: false, title: "" });
        }}
        onCancel={() => setMessageDlg({ show: false, title: "" })}
      />

      {/* FULL-SCREEN Scanner Modal */}
      <Modal
        visible={scanModal.visible}
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
                "qr", "code128", "ean13", "ean8", "upc_a", "upc_e", 
                "code39", "codabar", "code93", "pdf417", "datamatrix"
              ],
            }}
            onBarcodeScanned={handleScanned}
          />
          
          {/* Top Bar */}
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenTitle}>
              {scanModal.target === "location" ? "Scan Location" : "Multi-Scan SO Mode"}
            </Text>
            <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Text style={styles.closeBtnText}>
                 {scanModal.target === "so" && sessionCount > 0 ? "Done" : "Close"}
              </Text>
            </Pressable>
          </View>
          
          {/* Bottom Bar */}
          <View style={styles.fullscreenBottomBar}>
            <Text style={styles.fullscreenHint}>Align code within frame to scan</Text>
            
            {/* Feedback for Multi-Scan */}
            {scanModal.target === "so" && (
                <View style={styles.scanFeedback}>
                  {sessionCount > 0 && <Text style={styles.scanCounter}>Scanned: {sessionCount}</Text>}
                  {lastScannedCode && (
                     <Text style={styles.lastScanText} numberOfLines={1}>
                        Last: {lastScannedCode}
                     </Text>
                  )}
                  {scanError && (
                     <Text style={styles.errorText} numberOfLines={2}>
                        {scanError}
                     </Text>
                  )}
               </View>
            )}
            
          </View>
          
          {/* Focus Frame Overlay */}
          <View style={styles.focusFrameContainer} pointerEvents="none">
             <View style={[
                  styles.focusFrame, 
                  (scanModal.target === "so" && sessionCount > 0) ? { borderColor: COLORS.success } : null
             ]} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MaterialFGTransferScreen;

// ---------- Styles ----------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1 },
  content: { flex: 1, padding: 12 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 16,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
    gap: 8,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text },
  inputDivider: { width: 1, height: 22, backgroundColor: COLORS.border, marginHorizontal: 6 },
  scanIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1, borderColor: COLORS.border,
  },

  buttonsRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  btnPrimary: {
    flex: 1, height: 44, borderRadius: 12, backgroundColor: COLORS.accent,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  btnGhost: {
    flex: 1, height: 44, borderRadius: 12, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnGhostText: { color: COLORS.accent, fontWeight: "700", fontSize: 15 },

  tableCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden",
  },
  metric: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  metricLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: "600" },
  metricValue: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F9FAFB",
  },
  th: { fontWeight: "700", fontSize: 12, color: COLORS.subtext },
  flatList: { flex: 1 },
  tr: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  td: { fontSize: 14, color: COLORS.text },
  emptyWrap: { alignItems: "center", gap: 6, paddingVertical: 24 },
  emptyText: { fontWeight: "700", color: COLORS.text },
  emptySub: { color: COLORS.subtext, fontSize: 12 },

  // Dialog Styles
  modalBackdrop: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 24,
  },
  modalBackdropTouchable: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1,
    borderColor: COLORS.border, alignSelf: "stretch", gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  modalMessage: { color: COLORS.subtext, fontSize: 14 },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 4, justifyContent: "flex-end" },
  btn: { height: 44, paddingHorizontal: 16, borderRadius: 12, alignItems: "center", justifyContent: "center", flexDirection: "row" },
  btnGhost2: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: COLORS.border },
  btnGhost2Text: { color: COLORS.text, fontWeight: "700" },
  btnPrimary2: { backgroundColor: COLORS.accent },
  btnPrimary2Text: { color: "#fff", fontWeight: "700" },
  btnDestructive: { backgroundColor: COLORS.danger },

  // Scan modal styles (Matched to PutAwayScreen)
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.select({ ios: 44, android: 16 }),
    left: 16,
    right: 16,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(0,0,0,0.6)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 16 },
  fullscreenCloseBtn: {
    backgroundColor: "#fff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  closeBtnText: {
    fontWeight: "700", color: "#000", fontSize: 14
  },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 32,
    left: 16,
    right: 16,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    padding: 16,
    alignItems: "center",
    gap: 8,
  },
  fullscreenHint: { color: "#ccc", fontSize: 13 },
  
  focusFrameContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  focusFrame: {
    width: 260, height: 260, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24
  },
  // New Styles for Scanner Feedback
  scanFeedback: {
     alignItems: "center",
     width: "100%",
  },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 16 },
  lastScanText: { color: "#fff", fontSize: 14, marginTop: 2, textAlign: "center", width: "100%" },
  errorText: { color: "#EF4444", fontWeight: "700", fontSize: 14, marginTop: 2, textAlign: "center" },
});
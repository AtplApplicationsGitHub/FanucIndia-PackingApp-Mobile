import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  FlatList,
  Modal,
  StatusBar,
  Alert,
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
import { useKeyboardDisabled } from "../../utils/keyboard";

// Basic colors matching the app theme
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

// ---------- Dialog Component (Reused from material_fg) ----------
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

// ---------- Main Screen ----------

type ScannedItem = {
  id: string;
  location: string;
  timeISO: string;
};

const PutAwayScreen: React.FC = () => {
  const navigation = useNavigation();
  const [location, setLocation] = useState("");
  const [items, setItems] = useState<ScannedItem[]>([]);
  
  // Custom hook for global keyboard state
  const [keyboardDisabled] = useKeyboardDisabled();

  // Camera / Scan state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModal, setScanModal] = useState(false);
  
  // New state handling for multi-scan tracking
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  
  // Use a Ref to track unique codes scanned in the current session
  // This prevents the "burst" issue of reading the same code multiple times
  const sessionCodesRef = useRef<Set<string>>(new Set());

  // Helper for message dialog
  const [messageDlg, setMessageDlg] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    onOk?: () => void;
  }>({ show: false, title: "" });

  const showMessage = (title: string, subtitle?: string, onOk?: () => void) =>
    setMessageDlg({ show: true, title, subtitle, onOk });

  // Focus ref for input
  const locationInputRef = useRef<TextInput>(null);

  // --- Focus Management ---
  
  // 1. Focus when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        locationInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }, [])
  );

  // 2. Refocus when "Scan Only" (keyboardDisabled) is enabled
  //    or when modals close (scanModal or messageDlg) while in Scan Only mode.
  useEffect(() => {
    if (keyboardDisabled && !scanModal && !messageDlg.show) {
      const timer = setTimeout(() => {
        if (navigation.isFocused()) {
          locationInputRef.current?.focus();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [keyboardDisabled, scanModal, messageDlg.show, navigation]);

  // 3. Handle Blur: If in Scan Only mode, aggressively refocus unless a modal is open
  const handleBlur = () => {
    if (keyboardDisabled && !scanModal && !messageDlg.show) {
      setTimeout(() => {
        if (navigation.isFocused() && !scanModal && !messageDlg.show) {
          locationInputRef.current?.focus();
        }
      }, 100);
    }
  };

  const processLocation = (text: string) => {
    const clean = text.trim();
    if (!clean) return;

    const newItem: ScannedItem = {
      id: Date.now().toString() + Math.random().toString().slice(2, 6),
      location: clean,
      timeISO: new Date().toISOString(),
    };

    setItems((prev) => [newItem, ...prev]);
  };

  const onSave = () => {
    processLocation(location);
    setLocation(""); 
    // Keep focus after save
    setTimeout(() => {
       locationInputRef.current?.focus();
    }, 100);
  };

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    const hh = d.getHours() % 12 || 12;
    const mm = String(d.getMinutes()).padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  };

  // --- Scanner Logic ---
  const openScanner = async () => {
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

      // Permission granted - Reset session state
      sessionCodesRef.current.clear();
      setLastScannedCode(null);
      setSessionCount(0);
      setScanModal(true);
    } catch (err) {
      console.log(err);
      showMessage("Error", "Failed to access camera permission.");
    }
  };

  const closeScanner = () => setScanModal(false);

  const handleScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;

    // Strict Check: If we already scanned this code in this session, ignore it completely.
    // This fixes the issue of "automatically taking multiple times the same QR code".
    if (sessionCodesRef.current.has(value)) {
      return;
    }
    
    // Add to session set
    sessionCodesRef.current.add(value);
    
    // Feedback
    Vibration.vibrate();
    
    // Save
    processLocation(value);
    
    // Show feedback in UI
    setLastScannedCode(value);
    setSessionCount(prev => prev + 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <View style={styles.card}>
            {/* Location Input */}
            <View style={styles.field}>
              <TextInput
                ref={locationInputRef}
                style={styles.input}
                placeholder={keyboardDisabled ? "Scan Location..." : "Enter Location"}
                placeholderTextColor={COLORS.muted}
                value={location}
                onChangeText={setLocation}
                returnKeyType="done"
                onSubmitEditing={onSave}
                autoFocus={true}
                showSoftInputOnFocus={!keyboardDisabled}
                onBlur={handleBlur}
              />
              
              <View style={styles.inputDivider} />

              {/* Scan Button */}
              <Pressable onPress={openScanner} style={styles.scanIconBtn} hitSlop={10}>
                 <MaterialCommunityIcons name="qrcode-scan" size={22} color={COLORS.accent} />
              </Pressable>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={onSave} activeOpacity={0.85}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
          
          {/* Table Card */}
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.th, { flex: 0.6 }]}>S/No</Text>
              <Text style={[styles.th, { flex: 2 }]}>Location</Text>
              <Text style={[styles.th, { flex: 1.5, textAlign: "right" }]}>Time</Text>
            </View>

            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              style={styles.flatList}
              contentContainerStyle={{ paddingBottom: 8 }}
              renderItem={({ item, index }) => (
                <View
                  style={[
                    styles.tr,
                    { backgroundColor: index % 2 === 0 ? COLORS.tableStripe : "#FFFFFF" },
                  ]}
                >
                  <Text style={[styles.td, { flex: 0.6 }]}>{items.length - index}</Text>
                  <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.location}</Text>
                  <Text style={[styles.td, { flex: 1.5, textAlign: "right" }]}>{fmtTime(item.timeISO)}</Text>
                </View>
              )}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyText}>No items scanned</Text>
                </View>
              }
            />
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Message Dialog */}
      <Dialog
        visible={messageDlg.show}
        icon={
          <Ionicons
            name="information-circle-outline"
            size={24}
            color={COLORS.accent}
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

      {/* FULL-SCREEN Scanner Modal with Continuous Scan UI */}
      <Modal
        visible={scanModal}
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
            <Text style={styles.fullscreenTitle}>Multi-Scan Mode</Text>
            <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Text style={styles.closeBtnText}>Done</Text>
            </Pressable>
          </View>
          
          {/* Bottom Bar with Feedback */}
          <View style={styles.fullscreenBottomBar}>
            <Text style={styles.fullscreenHint}>Align codes within frame to scan</Text>
            {sessionCount > 0 && (
               <View style={styles.scanFeedback}>
                  <Text style={styles.scanCounter}>Scanned: {sessionCount}</Text>
                  {lastScannedCode && (
                     <Text style={styles.lastScanText} numberOfLines={1}>
                        Last: {lastScannedCode}
                     </Text>
                  )}
               </View>
            )}
          </View>
          
          {/* Focus Frame Overlay */}
          <View style={styles.focusFrameContainer} pointerEvents="none">
             <View style={[styles.focusFrame, sessionCount > 0 ? { borderColor: COLORS.success } : null]} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default PutAwayScreen;

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
  buttonsRow: { marginTop: 4 },
  btnPrimary: {
    height: 44, borderRadius: 12, backgroundColor: COLORS.accent,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  
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
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  emptyWrap: { alignItems: "center", paddingVertical: 24 },
  emptyText: { color: COLORS.muted, fontSize: 14 },

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

  // Scan modal styles
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
  scanFeedback: {
     alignItems: "center",
     width: "100%",
  },
  scanCounter: { color: "#4ADE80", fontWeight: "700", fontSize: 16 },
  lastScanText: { color: "#fff", fontSize: 14, marginTop: 2, textAlign: "center", width: "100%" },
  
  focusFrameContainer: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  focusFrame: {
    width: 260, height: 260, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', borderRadius: 24
  }
});

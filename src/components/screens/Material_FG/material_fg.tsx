import React, { useEffect, useRef, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { assignFgLocation, type AssignLocationResponse } from "../../Api/material_fg_server";

type ScanItem = {
  id: string;
  location: string;
  soNumber: string;
  timeISO: string;
};

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
};

// ---------- Helpers ----------
const fmtTime = (iso: string) => {
  const d = new Date(iso);
  const hh = d.getHours() % 12 || 12;
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ampm = d.getHours() >= 12 ? "PM" : "AM";
  return `${hh}:${mm} ${ampm}`;
};

// ---------- Dialog ----------
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
  const [location, setLocation] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);

  const locationRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  // camera / scan
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModal, setScanModal] = useState<{ visible: boolean; target: "location" | "so" | null }>({
    visible: false,
    target: null,
  });
  const scanLockRef = useRef(false);

  // dialogs
  const [confirmClear, setConfirmClear] = useState(false);
  const [messageDlg, setMessageDlg] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    onOk?: () => void;
  }>({ show: false, title: "" });

  const totalScanned = items.length;

  useEffect(() => {
    const t = setTimeout(() => locationRef.current?.focus(), 200);
    return () => clearTimeout(t);
  }, []);

  const showMessage = (title: string, subtitle?: string, onOk?: () => void) =>
    setMessageDlg({ show: true, title, subtitle, onOk });

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
      const res: AssignLocationResponse = await assignFgLocation({
        saleOrderNumber: so,
        fgLocation: loc,
      });

      // On success, add/update locally
      const existingIndex = items.findIndex(
        (item) => item.location === loc && item.soNumber === so
      );
      const newTimeISO = new Date().toISOString();

      if (existingIndex !== -1) {
        setItems((prev) =>
          prev.map((item, i) =>
            i === existingIndex ? { ...item, timeISO: newTimeISO } : item
          )
        );
      } else {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        setItems((prev) => [
          { id, location: loc, soNumber: so, timeISO: newTimeISO },
          ...prev,
        ]);
      }

      setSoNumber("");
      soRef.current?.focus();
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

  const clearForm = () => {
    setLocation("");
    setSoNumber("");
    setItems([]);
    setConfirmClear(false);
    setTimeout(() => locationRef.current?.focus(), 50);
  };

  const openScanner = async (target: "location" | "so") => {
    if (!permission?.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        showMessage("Camera permission required", "Enable camera to scan QR/barcodes.");
        return;
      }
    }
    scanLockRef.current = false;
    setScanModal({ visible: true, target });
  };

  const closeScanner = () => setScanModal({ visible: false, target: null });

  const handleScanned = async (result: BarcodeScanningResult) => {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    const value = (result?.data ?? "").trim();
    if (!value) {
      scanLockRef.current = false;
      return;
    }

    if (scanModal.target === "location") {
      setLocation(value);
      closeScanner();
      setTimeout(() => soRef.current?.focus(), 50);
      scanLockRef.current = false;
    } else if (scanModal.target === "so") {
      const currentLoc = location.trim();
      if (!currentLoc) {
        showMessage("Missing location", "Please enter or scan a location first.", () => {
          setSoNumber("");
          locationRef.current?.focus();
        });
        scanLockRef.current = false;
        return;
      }

      const so = value;
      setSoNumber(so);
      closeScanner();

      try {
        const res: AssignLocationResponse = await assignFgLocation({
          saleOrderNumber: so,
          fgLocation: currentLoc,
        });
        // On success, add/update locally
        const existingIndex = items.findIndex(
          (item) => item.location === currentLoc && item.soNumber === so
        );
        const newTimeISO = new Date().toISOString();
        if (existingIndex !== -1) {
          setItems((prev) =>
            prev.map((item, i) =>
              i === existingIndex ? { ...item, timeISO: newTimeISO } : item
            )
          );
        } else {
          const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          setItems((prev) => [
            { id, location: currentLoc, soNumber: so, timeISO: newTimeISO },
            ...prev,
          ]);
        }
        setSoNumber("");
        soRef.current?.focus();
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
      scanLockRef.current = false;
    } else {
      closeScanner();
      scanLockRef.current = false;
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
    <SafeAreaView style={styles.safe} edges={["left", "right"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <View style={styles.content}>
          {/* Form Card */}
          <View style={styles.card}>
            {/* Location with scan button */}
            <View style={styles.field}>
              <TextInput
                ref={locationRef}
                value={location}
                onChangeText={setLocation}
                placeholder="Enter/scan Location"
                placeholderTextColor={COLORS.muted}
                returnKeyType="next"
                onSubmitEditing={() => soRef.current?.focus()}
                style={styles.input}
                autoCapitalize="none"
                blurOnSubmit={false}
              />
              <View style={styles.inputDivider} />
              <Pressable onPress={() => openScanner("location")} hitSlop={8} style={styles.scanIconBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.accent} />
              </Pressable>
            </View>

            {/* SO with scan button */}
            <View style={styles.field}>
              <TextInput
                ref={soRef}
                value={soNumber}
                onChangeText={setSoNumber}
                placeholder="Enter/scan SO number"
                placeholderTextColor={COLORS.muted}
                returnKeyType="done"
                onSubmitEditing={addItem}
                style={styles.input}
                autoCapitalize="none"
                keyboardType="default"
              />
              <View style={styles.inputDivider} />
              <Pressable onPress={() => openScanner("so")} hitSlop={8} style={styles.scanIconBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.accent} />
              </Pressable>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity style={styles.btnPrimary} onPress={addItem} activeOpacity={0.85}>
                <Ionicons name="save-outline" size={18} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnGhost} onPress={() => setConfirmClear(true)} activeOpacity={0.85}>
                <Ionicons name="close-circle-outline" size={18} color={COLORS.accent} />
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
              <Text style={[styles.th, { flex: 0.6, textAlign: "left" }]}>S/No</Text>
              <Text style={[styles.th, { flex: 2 }]}>Location</Text>
              <Text style={[styles.th, { flex: 2 }]}>SO Number</Text>
              <Text style={[styles.th, { flex: 1.4 }]}>Time</Text>
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
                  <Text style={styles.emptySub}>Scan a location and SO, then press Save (or press Enter).</Text>
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
                    <Text style={[styles.td, { flex: 0.6, textAlign: "left" }]}>{index + 1}</Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.location}</Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>{item.soNumber}</Text>
                    <Text style={[styles.td, { flex: 1.4 }]}>{fmtTime(item.timeISO)}</Text>
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

      {/* FULL-SCREEN Scanner */}
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
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e", "code39", "codabar", "code93", "pdf417", "datamatrix"],
            }}
            onBarcodeScanned={scanLockRef.current ? undefined : handleScanned}
          />
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenTitle}>Scan a code</Text>
            <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles.fullscreenBottomBar}>
            <Text style={styles.fullscreenHint}>Align the code within the frame</Text>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default MaterialFGTransferScreen;

// ---------- Styles ----------
const FRAME_LEFT = 0.1;   // 10% from left
const FRAME_TOP = 0.22;   // 22% from top
const FRAME_WIDTH = 0.8;  // 80% width
const FRAME_HEIGHT = 0.56;// 56% height

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 10, paddingTop: 5, paddingBottom: 20 },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 16,
    padding: 14,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
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
    width: 36, height: 36, borderRadius: 999,
    alignItems: "center", justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)", borderWidth: 1, borderColor: COLORS.border,
  },

  buttonsRow: { flexDirection: "row", gap: 10, marginTop: 2 },
  btnPrimary: {
    flex: 1, height: 48, borderRadius: 12, backgroundColor: COLORS.accent,
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 16 },
  btnGhost: {
    flex: 1, height: 48, borderRadius: 12, backgroundColor: "#F3F4F6",
    alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8,
    borderWidth: 1, borderColor: COLORS.border,
  },
  btnGhostText: { color: COLORS.accent, fontWeight: "700", fontSize: 16 },

  tableCard: {
    flex: 1,
    marginTop: 14,
    backgroundColor: COLORS.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    overflow: "hidden",
  },
  metric: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 },
  metricLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: "600" },
  metricValue: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  tableHeader: {
    flexDirection: "row", paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: COLORS.border, borderBottomWidth: 1,
    borderBottomColor: COLORS.border, backgroundColor: "#FCFCFD",
  },
  th: { fontWeight: "700", fontSize: 12, color: COLORS.subtext },
  flatList: { flex: 1 },
  tr: { flexDirection: "row", paddingHorizontal: 14, paddingVertical: 12 },
  td: { fontSize: 14, color: COLORS.text },
  emptyWrap: { alignItems: "center", gap: 6, paddingVertical: 24 },
  emptyText: { fontWeight: "700", color: COLORS.text },
  emptySub: { color: COLORS.subtext, fontSize: 12 },

  // dialog modal
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

  // Optional focus frame / mask
  scanFullWrap: { flex: 1, backgroundColor: "#000" },
  focusFrame: {
    position: "absolute",
    left: `${FRAME_LEFT * 100}%`,
    top: `${FRAME_TOP * 100}%`,
    width: `${FRAME_WIDTH * 100}%`,
    height: `${FRAME_HEIGHT * 100}%`,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.95)",
    borderRadius: 14,
  },
  maskTop: {
    position: "absolute",
    left: 0, right: 0, top: 0,
    height: `${FRAME_TOP * 100}%`,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  maskLeft: {
    position: "absolute",
    top: `${FRAME_TOP * 100}%`,
    bottom: `${(1 - FRAME_TOP - FRAME_HEIGHT) * 100}%`,
    left: 0,
    width: `${FRAME_LEFT * 100}%`,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  maskRight: {
    position: "absolute",
    top: `${FRAME_TOP * 100}%`,
    bottom: `${(1 - FRAME_TOP - FRAME_HEIGHT) * 100}%`,
    right: 0,
    width: `${(1 - FRAME_LEFT - FRAME_WIDTH) * 100}%`,
    backgroundColor: "rgba(0,0,0,0.35)",
  },
  maskBottom: {
    position: "absolute",
    left: 0, right: 0,
    bottom: 0,
    height: `${(1 - FRAME_TOP - FRAME_HEIGHT) * 100}%`,
    backgroundColor: "rgba(0,0,0,0.35)",
  },

  // Full-screen camera UI
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.select({ ios: 44, android: 16 }),
    left: 16,
    right: 16,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.55)",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  fullscreenCloseBtn: {
    height: 28,
    width: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  fullscreenBottomBar: {
    position: "absolute",
    bottom: 24,
    left: 16,
    right: 16,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingVertical: 10,
    alignItems: "center",
  },
  fullscreenHint: { color: "#fff", fontSize: 12 },
});
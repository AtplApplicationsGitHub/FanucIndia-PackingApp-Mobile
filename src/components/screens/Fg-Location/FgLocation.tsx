import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  ActivityIndicator,
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
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as XLSX from "xlsx";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import {
  useManualFgStorage,
  type ManualFgStorageRequest,
} from "../../Api/Hooks/UseFgloaction";
import {
  clearMaterialFGData,
  loadMaterialFGData,
  saveMaterialFGData,
  loadMaterialFGLocation,
  saveMaterialFGLocation,
  clearMaterialFGLocation,
} from "../../Storage/material_fg_Storage";
import { useKeyboardDisabled } from "../../utils/keyboard";

type ScanItem = {
  id: string;
  location: string;
  soNumber: string;
  timeISO: string;
  user: string;
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

const formatDateTimeWithOffset = (iso: string) => {
  const date = new Date(iso);
  const pad = (value: number, size = 2) => String(value).padStart(size, "0");
  const offsetMinutes = -date.getTimezoneOffset();
  const offsetSign = offsetMinutes >= 0 ? "+" : "-";
  const absOffset = Math.abs(offsetMinutes);
  const offsetHours = Math.floor(absOffset / 60);
  const offsetMins = absOffset % 60;

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds()
  )}.${pad(date.getMilliseconds(), 3)}${offsetSign}${pad(
    offsetHours
  )}:${pad(offsetMins)}`;
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
  <Modal
    visible={visible}
    transparent
    animationType="fade"
    statusBarTranslucent
  >
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
            <TouchableOpacity
              style={[styles.btn, styles.btnGhost2]}
              onPress={onCancel}
            >
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
  const { uploading, uploadManualFgStorage } = useManualFgStorage();
  const [location, setLocation] = useState("");
  const [soNumber, setSoNumber] = useState("");
  const [items, setItems] = useState<ScanItem[]>([]);
  // sortMode: 'recent' (LIFO), 'asc' (A-Z), 'desc' (Z-A)
  const [sortMode, setSortMode] = useState<"recent" | "asc" | "desc">("recent");

  // Refs
  const locationRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  // Custom hook for global keyboard state
  const [keyboardDisabled] = useKeyboardDisabled();

  // Camera / Scan state
  const [permission, requestPermission] = useCameraPermissions();
  const [scanModal, setScanModal] = useState<{
    visible: boolean;
    target: "location" | "so" | null;
  }>({
    visible: false,
    target: null,
  });

  // User name state for export
  const [username, setUsername] = useState("Unknown");

  useEffect(() => {
    // Get user from storage
    AsyncStorage.getItem("displayName").then((name) => {
      if (name) setUsername(name);
    });
  }, []);

  // -- Queue / Lock for SO scanning --
  const processingRef = useRef(false);
  const pendingScansRef = useRef<{ so: string; loc: string }[]>([]);
  const [queueTrigger, setQueueTrigger] = useState(0);

  // Ref to track location value without triggering re-renders in effects
  const locationValueRef = useRef(location);

  // Update logic flow refs
  useEffect(() => {
    locationValueRef.current = location;
  }, [location]);

  // Dialogs
  const [confirmClear, setConfirmClear] = useState(false);
  const [confirmUpload, setConfirmUpload] = useState(false);
  const [messageDlg, setMessageDlg] = useState<{
    show: boolean;
    title: string;
    subtitle?: string;
    onOk?: () => void;
  }>({ show: false, title: "" });

  const totalScanned = items.length;

  // --- Focus Management ---

  // 1. Focus on mount / focus effect
  // Prioritize SO if empty, otherwise Location
  useFocusEffect(
    useCallback(() => {
      const timer = setTimeout(() => {
        if (!soRef.current?.isFocused() && !soNumber) {
          soRef.current?.focus();
        } else {
          locationRef.current?.focus();
        }
      }, 100);
      return () => clearTimeout(timer);
    }, []),
  );

  // 2. Refocus when "Scan Only" (keyboardDisabled) is enabled
  //    or when modals close.
  useEffect(() => {
    if (
      keyboardDisabled &&
      !scanModal.visible &&
      !messageDlg.show &&
      !confirmClear &&
      !confirmUpload
    ) {
      const timer = setTimeout(() => {
        if (navigation.isFocused()) {
          if (!soNumber) {
            soRef.current?.focus();
          } else {
            locationRef.current?.focus();
          }
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [
    keyboardDisabled,
    scanModal.visible,
    messageDlg.show,
    confirmClear,
    confirmUpload,
    navigation,
  ]);

  const handleBlur = () => {
    if (
      keyboardDisabled &&
      !scanModal.visible &&
      !messageDlg.show &&
      !confirmClear &&
      !confirmUpload
    ) {
      setTimeout(() => {
        if (
          navigation.isFocused() &&
          !scanModal.visible &&
          !messageDlg.show &&
          !confirmClear &&
          !confirmUpload
        ) {
          // Decide which to focus
          if (!soNumber) soRef.current?.focus();
          else locationRef.current?.focus();
        }
      }, 100);
    }
  };

  // Load persisted data
  useEffect(() => {
    const initStorage = async () => {
      const [storedData, storedLocation] = await Promise.all([
        loadMaterialFGData(),
        loadMaterialFGLocation(),
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
    // Offline Mode: Simulate successful assignment
    const newTimeISO = new Date().toISOString();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const newItem = {
      id,
      location: targetLoc,
      soNumber: targetSo,
      timeISO: newTimeISO,
      user: username,
    };
    const updatedItems = [newItem, ...items];

    setItems(updatedItems);
    saveMaterialFGData(updatedItems);
    return updatedItems;
  };

  // 3. Core Async Logic (verification + API)
  const coreAddItem = async (soVal: string, locVal: string) => {
    try {
      await performAddItem(soVal, locVal);
      // For manual flow, we might want to clear/focus.
      // But if we are in a rapid scan loop, we just move to next.

      // Manual mode success
      setSoNumber("");
      setLocation("");
      requestAnimationFrame(() => {
        soRef.current?.focus();
      });
    } catch (error: any) {
      console.log("Add failed:", error);
      // Manual mode error
      showMessage("SO Number Not Found", error.message, () => {
        // on OK
        soRef.current?.focus();
      });
    }
  };

  // 4. Effect to process the queue
  useEffect(() => {
    const process = async () => {
      if (processingRef.current) return;
      if (pendingScansRef.current.length === 0) return;

      processingRef.current = true;
      const scanTask = pendingScansRef.current.shift();

      if (scanTask) {
        await coreAddItem(scanTask.so, scanTask.loc);
      }

      processingRef.current = false;

      // Trigger next if items remain
      if (pendingScansRef.current.length > 0) {
        setQueueTrigger((c) => c + 1);
      }
    };
    process();
  }, [queueTrigger, items /* deps */]);

  // 5. Public entry point (Manual Button / Enter Key)
  const addItem = () => {
    const loc = location.trim();
    const so = soNumber.trim();

    if (!so) {
      soRef.current?.focus();
      return;
    }
    if (!loc) {
      locationRef.current?.focus();
      return;
    }

    // Manual add -> push to queue
    pendingScansRef.current.push({ so, loc });
    setSoNumber(""); // Clear UI immediately
    setLocation("");
    setQueueTrigger((c) => c + 1);

    // Focus back to SO Number after saving
    setTimeout(() => soRef.current?.focus(), 50);
  };

  const clearForm = async () => {
    setLocation("");
    setSoNumber("");
    setItems([]);
    setItems([]);
    await Promise.all([
      clearMaterialFGData(),
      clearMaterialFGLocation(), // Clear stored location too
    ]);
    setConfirmClear(false);
    setTimeout(() => soRef.current?.focus(), 50);
  };

  const deleteItem = (id: string) => {
    const updatedItems = items.filter((item) => item.id !== id);
    setItems(updatedItems);
    saveMaterialFGData(updatedItems);
  };

  const buildUploadPayload = useCallback((): ManualFgStorageRequest[] => {
    return items.map((item) => ({
      salesOrderNumber: item.soNumber.trim(),
      fgLocation: item.location.trim(),
      user: item.user?.trim() || username || "Unknown",
      dateTime: formatDateTimeWithOffset(item.timeISO),
    }));
  }, [items, username]);

  const openUploadConfirm = async () => {
    if (items.length === 0) {
      showMessage("Empty", "No scanned items to upload.");
      return;
    }

    setConfirmUpload(true);
  };

  const uploadItemsToServer = async () => {
    if (uploading) return;

    setConfirmUpload(false);

    try {
      const result = await uploadManualFgStorage(buildUploadPayload());
      await Promise.all([clearMaterialFGData(), clearMaterialFGLocation()]);
      setItems([]);
      setLocation("");
      setSoNumber("");
      showMessage(
        "Success",
        `${result.message}\nUploaded count: ${result.count}`,
        () => soRef.current?.focus()
      );
    } catch (error: any) {
      showMessage(
        "Upload Failed",
        error?.message || "Unable to upload scanned items."
      );
    }
  };

  // --- Scanner Logic ---
  const scanLockRef = useRef(false);

  const openScanner = async (target: "location" | "so") => {
    try {
      if (!permission) {
        const res = await requestPermission();
        if (!res.granted) {
          showMessage(
            "Permission Required",
            "Allow camera access to scan QR codes.",
          );
          return;
        }
      } else if (!permission.granted) {
        if (!permission.canAskAgain) {
          showMessage(
            "Camera Disabled",
            "Please enable camera access in your device settings.",
          );
          return;
        }
        const res = await requestPermission();
        if (!res.granted) {
          showMessage("Permission Denied", "Camera permission is required.");
          return;
        }
      }

      scanLockRef.current = false;
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

    if (scanLockRef.current) return;
    scanLockRef.current = true;
    Vibration.vibrate();

    if (scanModal.target === "so") {
      setSoNumber(value);
      closeScanner();
      // Wait for modal to close then focus Location
      setTimeout(() => locationRef.current?.focus(), 300);
      scanLockRef.current = false;
      return;
    }

    if (scanModal.target === "location") {
      setLocation(value);
      closeScanner();

      // Trigger auto-save if both are filled
      setTimeout(() => {
        if (soNumber && value) {
          pendingScansRef.current.push({ so: soNumber, loc: value });
          setSoNumber("");
          setLocation("");
          setQueueTrigger((c) => c + 1);
        } else {
          soRef.current?.focus();
        }
      }, 500);

      scanLockRef.current = false;
      return;
    }
  };

  // Sorting logic
  const toggleSortMode = () => {
    setSortMode((prev) => {
      if (prev === "recent") return "asc";
      if (prev === "asc") return "desc";
      return "recent";
    });
  };

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

  const sortedItems = React.useMemo(() => {
    if (sortMode === "recent") {
      return items; // Already LIFO
    }
    return [...items].sort((a, b) => {
      if (sortMode === "asc") {
        return a.soNumber.localeCompare(b.soNumber);
      } else {
        return b.soNumber.localeCompare(a.soNumber);
      }
    });
  }, [items, sortMode]);

  const viewItem = (item: ScanItem) => {
    setMessageDlg({
      show: true,
      title: "View entry",
      subtitle: `SO ${item.soNumber} @ ${item.location}\nScanned by ${item.user}`,
    });
  };

  const exportToExcel = useCallback(async () => {
    if (items.length === 0) {
      showMessage("Empty", "No items to export.");
      return;
    }
    try {
      const exportData = items.map((item) => {
        const dateObj = new Date(item.timeISO);
        // properly format date as YYYY-MM-DD HH:MM:SS
        const dtStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, "0")}-${String(dateObj.getDate()).padStart(2, "0")} ${String(dateObj.getHours()).padStart(2, "0")}:${String(dateObj.getMinutes()).padStart(2, "0")}`;
        return {
          "SO Number": item.soNumber,
          "Location": item.location,
          "User": item.user,
          "Date/Time": dtStr,
        };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Material Storage");

      const base64Data = XLSX.write(workbook, { type: "base64", bookType: "xlsx" });
      const filename = "Material Storage.xlsx";
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      if (Platform.OS === "android") {
        try {
          const permissions =
            await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
          if (permissions.granted) {
            const uri = await FileSystem.StorageAccessFramework.createFileAsync(
              permissions.directoryUri,
              filename,
              "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            );
            await FileSystem.writeAsStringAsync(uri, base64Data, {
              encoding: FileSystem.EncodingType.Base64,
            });
            showMessage("Success", "File saved to device folder successfully.");
            return;
          }
        } catch (e) {
          console.warn("SAF Error:", e);
        }
      }

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          dialogTitle: "Export Material Storage Data",
          UTI: "org.openxmlformats.spreadsheetml.sheet"
        });
      } else {
        showMessage("Export Error", "Sharing is not available on this device.");
      }
    } catch (error: any) {
      showMessage("Export Failed", error?.message || "An error occurred");
    }
  }, [items]);

  useEffect(() => {
    navigation.setOptions({
      headerTitle: () => (
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerTitleText}>FG Location</Text>
        </View>
      ),
      headerRight: () => (
        <TouchableOpacity
          style={{
            backgroundColor: "#10B981",
            paddingHorizontal: 10,
            paddingVertical: 6,
            borderRadius: 6,
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
          }}
          onPress={exportToExcel}
        >
          <MaterialCommunityIcons
            name="microsoft-excel"
            size={16}
            color="#FFF"
          />
          <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "700" }}>
            Export
          </Text>
        </TouchableOpacity>
      ),
    });
  }, [navigation, exportToExcel]);

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          {/* Form Card */}
          <View style={styles.card}>
            {/* SO Number */}
            <View style={styles.field}>
              <TextInput
                ref={soRef}
                value={soNumber}
                onChangeText={setSoNumber}
                placeholder={
                  keyboardDisabled
                    ? "Scan SO Number..."
                    : "Enter/scan SO Number"
                }
                placeholderTextColor={COLORS.muted}
                returnKeyType="next"
                onSubmitEditing={() => locationRef.current?.focus()}
                style={styles.input}
                autoCapitalize="none"
                blurOnSubmit={false}
                showSoftInputOnFocus={!keyboardDisabled}
                onBlur={handleBlur}
              />
              <View style={styles.inputDivider} />
              <Pressable
                onPress={() => openScanner("so")}
                hitSlop={8}
                style={styles.scanIconBtn}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={COLORS.accent}
                />
              </Pressable>
            </View>

            {/* Location */}
            <View style={styles.field}>
              <TextInput
                ref={locationRef}
                value={location}
                onChangeText={setLocation}
                placeholder={
                  keyboardDisabled ? "Scan Location..." : "Enter/scan Location"
                }
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
              <Pressable
                onPress={() => openScanner("location")}
                hitSlop={8}
                style={styles.scanIconBtn}
              >
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={COLORS.accent}
                />
              </Pressable>
            </View>

            <View style={styles.buttonsRow}>
              <TouchableOpacity
                style={styles.btnPrimary}
                onPress={addItem}
                activeOpacity={0.85}
              >
                <Ionicons name="save-outline" size={16} color="#FFFFFF" />
                <Text style={styles.btnPrimaryText}>Save</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.btnUpload,
                  uploading && styles.btnDisabled,
                ]}
                onPress={openUploadConfirm}
                activeOpacity={0.85}
                disabled={uploading}
              >
                {uploading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Ionicons
                    name="cloud-upload-outline"
                    size={16}
                    color="#FFFFFF"
                  />
                )}
                <Text style={styles.btnPrimaryText}>Upload</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.btnGhost}
                onPress={() => setConfirmClear(true)}
                activeOpacity={0.85}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={16}
                  color={COLORS.accent}
                />
                <Text style={styles.btnGhostText}>Clear</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Table Card */}
          <View style={styles.tableCard}>
            <View style={{ paddingBottom: 6 }}>
              <Text style={styles.metric}>
                <Text style={styles.metricLabel}>Total Scanned: </Text>
                <Text style={styles.metricValue}>{totalScanned}</Text>
              </Text>
            </View>

            <View style={styles.tableHeader}>
              <View
                style={{ flex: 2, flexDirection: "row", alignItems: "center" }}
              >
                <Text style={styles.th}>SO Number</Text>
                <TouchableOpacity
                  onPress={toggleSortMode}
                  style={{
                    padding: 4,
                    backgroundColor: "#E5E7EB", // slightly darker than #eff6ff to match this screen's theme
                    borderRadius: 6,
                    marginLeft: 6,
                  }}
                >
                  <MaterialCommunityIcons
                    name={getSortIcon()}
                    size={16}
                    color={COLORS.accent}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.th, { flex: 2 }]}>Location</Text>
              <Text style={[styles.th, { flex: 1.4, textAlign: "right" }]}>
                Time
              </Text>
              <Text style={[styles.th, { flex: 1, textAlign: "center" }]}>
                Action
              </Text>
            </View>

            <FlatList
              data={sortedItems}
              keyExtractor={(x) => x.id}
              style={styles.flatList}
              contentContainerStyle={{ paddingBottom: 8 }}
              ListEmptyComponent={
                <View style={styles.emptyWrap}>
                  <MaterialCommunityIcons
                    name="clipboard-text-outline"
                    size={28}
                    color={COLORS.muted}
                  />
                  <Text style={styles.emptyText}>No scans yet</Text>
                  <Text style={styles.emptySub}>
                    Scan a location and SO, then press Save.
                  </Text>
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
                      {
                        backgroundColor:
                          index % 2 === 0 ? COLORS.tableStripe : "#FFFFFF",
                      },
                    ]}
                  >
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                      {item.soNumber}
                    </Text>
                    <Text style={[styles.td, { flex: 2 }]} numberOfLines={1}>
                      {item.location}
                    </Text>
                    <Text
                      style={[styles.td, { flex: 1.4, textAlign: "right" }]}
                    >
                      {fmtTime(item.timeISO)}
                    </Text>
                    <View style={{ flex: 1, alignItems: "center" }}>
                      <TouchableOpacity
                        onPress={() => deleteItem(item.id)}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialCommunityIcons
                          name="delete-outline"
                          size={20}
                          color={COLORS.danger}
                        />
                      </TouchableOpacity>
                    </View>
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

      {/* Confirm Upload Dialog */}
      <Dialog
        visible={confirmUpload}
        icon={
          <Ionicons
            name="cloud-upload-outline"
            size={22}
            color={COLORS.success}
          />
        }
        title="Upload to server?"
        message={`Are you sure you want to upload ${items.length} scanned item${
          items.length === 1 ? "" : "s"
        } to server?`}
        cancelText="Cancel"
        okText="Okay"
        onCancel={() => setConfirmUpload(false)}
        onOk={uploadItemsToServer}
      />

      {/* Message Dialog */}
      <Dialog
        visible={messageDlg.show}
        icon={
          <Ionicons
            name={
              messageDlg.title === "Success"
                ? "checkmark-circle-outline"
                : "information-circle-outline"
            }
            size={22}
            color={
              messageDlg.title === "Success" ? COLORS.primary : COLORS.accent
            }
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
            onBarcodeScanned={handleScanned}
          />

          {/* Top Bar */}
          <View style={styles.fullscreenTopBar}>
            <Text style={styles.fullscreenTitle}>
              {scanModal.target === "location"
                ? "Scan Location"
                : "Scan SO Number"}
            </Text>
            <Pressable onPress={closeScanner} style={styles.fullscreenCloseBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </Pressable>
          </View>

          {/* Bottom Bar */}
          <View style={styles.fullscreenBottomBar}>
            <Text style={styles.fullscreenHint}>
              Align code within frame to scan
            </Text>
          </View>

          {/* Focus Frame Overlay */}
          <View style={styles.focusFrameContainer} pointerEvents="none">
            <View style={styles.focusFrame} />
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
  content: { flex: 1, padding: 8 },
  headerTitleWrap: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 120,
  },
  headerTitleText: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 18,
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    marginBottom: 8,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    height: 40,
    gap: 8,
  },
  input: { flex: 1, fontSize: 13, color: COLORS.text },
  inputDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 4,
  },
  scanIconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.04)",
    borderWidth: 1,
    borderColor: COLORS.border,
  },

  buttonsRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  btnPrimary: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.accent,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnPrimaryText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },
  btnUpload: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: COLORS.success,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
  },
  btnDisabled: { opacity: 0.65 },
  btnGhost: {
    flex: 1,
    height: 40,
    borderRadius: 8,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  btnGhostText: { color: COLORS.accent, fontWeight: "700", fontSize: 14 },

  tableCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    overflow: "hidden",
  },
  metric: { paddingHorizontal: 12, paddingTop: 10, paddingBottom: 6 },
  metricLabel: { color: COLORS.subtext, fontSize: 13, fontWeight: "600" },
  metricValue: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: "#F9FAFB",
  },
  th: { fontWeight: "700", fontSize: 11, color: COLORS.subtext },
  flatList: { flex: 1 },
  tr: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    alignItems: "center",
  },
  td: { fontSize: 12, color: COLORS.text },
  emptyWrap: { alignItems: "center", gap: 6, paddingVertical: 24 },
  emptyText: { fontWeight: "700", color: COLORS.text },
  emptySub: { color: COLORS.subtext, fontSize: 12 },

  // Dialog Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    justifyContent: "center",
    padding: 24,
  },
  modalBackdropTouchable: { ...StyleSheet.absoluteFillObject },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: "stretch",
    gap: 12,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  modalTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  modalMessage: { color: COLORS.subtext, fontSize: 14 },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    justifyContent: "flex-end",
  },
  btn: {
    height: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  btnGhost2: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
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
    fontWeight: "700",
    color: "#000",
    fontSize: 14,
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

  focusFrameContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  focusFrame: {
    width: 260,
    height: 260,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
    borderRadius: 24,
  },
});

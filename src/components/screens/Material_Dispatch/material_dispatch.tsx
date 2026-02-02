// material_dispatch.tsx
import React, {
  useState,
  useMemo,
  useEffect,
  useRef,
  useCallback,
} from "react";
import {
  Animated,
  Easing,
  LayoutAnimation,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  FlatList,
  Pressable,
  Modal,
  StatusBar,
  ActivityIndicator,
  Vibration,
  Platform,
} from "react-native";
import { useKeyboardDisabled } from "../../utils/keyboard";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";
import {
  createDispatchHeader,
  updateDispatchHeader,
  linkSalesOrder,
  deleteSalesOrderLink,
  getAttachments,
  type CreateDispatchHeaderRequest,
  type UpdateDispatchHeaderRequest,
  type LinkDispatchSORequest,
  type DispatchAttachment,
} from "../../Api/Hooks/Usematerial_dispatch";

import {
  loadDispatchData,
  saveDispatchData,
  clearDispatchData,
} from "../../Storage/material_dispatch_storage";

import { useFocusEffect } from "@react-navigation/native";
import UploadModal from "./Upload";

type DispatchForm = {
  transporter: string;
  vehicleNo: string;
};

type SOEntry = {
  soId: string;
  linkId: number;
  createdAt: number;
};

const C = {
  bg: "#FFFFFF",
  card: "#FFFFFF",
  border: "#E5E7EB",
  text: "#111827",
  hint: "#9CA3AF",
  accent: "#111827",
  blue: "#2151F5",
  red: "#F87171",
  grayBtn: "#F3F4F6",
  green: "#10B981",
};

const C_sales = {
  bg: "#F6F7FB",
  card: "#FFFFFF",
  border: "#E6E8EF",
  text: "#0B1220",
  sub: "#6B7280",
  blue: "#2151F5",
  pill: "#F3F4F6",
  hover: "#F9FAFB",
  danger: "#EF4444",
};

const MaterialDispatchScreen: React.FC = () => {
  const [form, setForm] = useState<DispatchForm>({
    transporter: "",
    vehicleNo: "",
  });
  const [dispatchId, setDispatchId] = useState<string | null>(null);

  // now we only track attachments that are already uploaded on server
  const [uploadedAttachments, setUploadedAttachments] = useState<
    DispatchAttachment[]
  >([]);
  const [expanded, setExpanded] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showNewFormModal, setShowNewFormModal] = useState(false);
  const [showFileModal, setShowFileModal] = useState(false);
  const [savingHeader, setSavingHeader] = useState(false);

  // Keyboard & Scan State
  const [keyboardDisabled] = useKeyboardDisabled();
  const sessionCodesRef = useRef<Set<string>>(new Set());
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [sessionCount, setSessionCount] = useState(0);

  const animatedHeight = useState(new Animated.Value(1))[0];
  const salesOpacity = useState(new Animated.Value(0))[0];
  const formHeight = 260; // reduced height because fewer fields

  const transporterRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  const onChange = (k: keyof DispatchForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const isFormValid = useMemo(() => {
    const { transporter, vehicleNo } = form;
    return !!transporter?.trim() && !!vehicleNo?.trim();
  }, [form]);

  // ✅ total attachments from server only
  const totalAttachments = uploadedAttachments.length;

  const handleClear = () => {
    setForm({ transporter: "", vehicleNo: "" });
    setDispatchId(null);
    setUploadedAttachments([]);
    setItems([]);
    setValue("");
  };

  const handleAddNew = () => {
    setShowNewFormModal(true);
  };

  const confirmNewForm = async () => {
    await clearDispatchData();
    handleClear();
    if (!expanded) toggleExpand();
    setShowNewFormModal(false);
    setTimeout(() => transporterRef.current?.focus(), 100);
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    const toValue = expanded ? 0 : 1;
    Animated.timing(animatedHeight, {
      toValue,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
    const salesToValue = expanded ? 1 : 0;
    Animated.timing(salesOpacity, {
      toValue: salesToValue,
      duration: 300,
      easing: Easing.ease,
      useNativeDriver: false,
    }).start();
    setExpanded(!expanded);

    if (!expanded) {
      setTimeout(() => {
        transporterRef.current?.focus();
      }, 350);
    }
  };

  const focusSOInput = useCallback(() => {
    setTimeout(() => {
      soRef.current?.focus();
    }, 100);
  }, []);

  /* ------------------- HEADER ------------------- */
  const handleSaveHeader = async () => {
    if (!isFormValid || savingHeader) return;

    setSavingHeader(true);
    const payload: CreateDispatchHeaderRequest = {
      transporterName: form.transporter.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    } as any;

    try {
      const result = await createDispatchHeader(payload);
      if (result.ok) {
        const id = (result.data as any).id;
        setDispatchId(id);
        if (expanded) toggleExpand();
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Failed to save.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setShowError(true);
    } finally {
      setSavingHeader(false);
    }
  };

  const handleUpdateHeader = async () => {
    if (!isFormValid || savingHeader || !dispatchId) return;

    setSavingHeader(true);
    const payload: UpdateDispatchHeaderRequest = {
      transporterName: form.transporter.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    } as any;

    try {
      const result = await updateDispatchHeader(dispatchId, payload);
      if (result.ok) {
        showToast("Updated successfully!", "success");
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Failed to update.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setShowError(true);
    } finally {
      setSavingHeader(false);
    }
  };

  /* ------------------- FILE PICKER MODAL TRIGGER ------------------- */
  const openFilePicker = () => {
    if (!dispatchId) {
      setErrorMessage("Save header first.");
      setShowError(true);
      return;
    }
    setShowFileModal(true);
  };

  const loadAttachments = async () => {
    if (!dispatchId) return;
    try {
      const result = await getAttachments(dispatchId);
      if (result.ok) setUploadedAttachments(result.data);
    } catch {
      // silent
    }
  };

  const showToast = (msg: string, type: "success" | "error" = "success") => {
    setErrorMessage(msg);
    if (type === "success") {
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 1500);
    } else {
      setShowError(true);
    }
  };

  const formHeightInterpolate = animatedHeight.interpolate({
    inputRange: [0, 1],
    outputRange: [0, formHeight],
  });

  const scaleInterpolate = animatedHeight;

  /* ------------------- SALES ORDERS ------------------- */
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const total = useMemo(() => items.length, [items]);

  function normalizeSO(raw: string) {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  const clearAndFocusSO = () => {
    setValue("");
    focusSOInput();
  };

  async function addSO(raw: string, isScan = false) {
    const so = normalizeSO(raw);
    if (!so || !dispatchId) {
      clearAndFocusSO();
      return;
    }

    if (items.some((x) => x.soId === so)) {
      if (!isScan) {
        setErrorMessage(`SO ${so} already added.`);
        setShowError(true);
      }
      clearAndFocusSO();
      return;
    }

    const payload: LinkDispatchSORequest = { saleOrderNumber: so } as any;

    try {
      const result = await linkSalesOrder(dispatchId, payload);
      if (result.ok) {
        const link = result.data;
        setItems((prev) => [
          ...prev,
          {
            soId: so,
            linkId: link.id,
            createdAt: new Date(link.createdAt).getTime(),
          },
        ]);
        clearAndFocusSO();
      } else {
        if (!isScan) {
          setErrorMessage(result.error || "Failed to link SO.");
          setShowError(true);
        }
        clearAndFocusSO();
      }
    } catch {
      if (!isScan) {
        setErrorMessage("Failed to link SO.");
        setShowError(true);
      }
      clearAndFocusSO();
    }
  }

  async function removeSO(linkId: number) {
    try {
      const result = await deleteSalesOrderLink(linkId);
      if (result.ok) {
        setItems((prev) => prev.filter((x) => x.linkId !== linkId));
        focusSOInput();
      } else {
        setErrorMessage(result.error || "Failed to remove SO.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Failed to remove SO.");
      setShowError(true);
    }
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    const hh = d.getHours() % 12 || 12;
    const mm = `${d.getMinutes()}`.padStart(2, "0");
    const ampm = d.getHours() >= 12 ? "PM" : "AM";
    return `${hh}:${mm} ${ampm}`;
  }

  /* ------------------- SCANNER ------------------- */
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  const openScanner = async () => {
    if (!dispatchId) {
      setErrorMessage("Save header first.");
      setShowError(true);
      return;
    }
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        setErrorMessage("Camera permission required.");
        setShowError(true);
        return;
      }
    }
    
    // Reset session
    sessionCodesRef.current.clear();
    setLastScannedCode(null);
    setSessionCount(0);
    setScanVisible(true);
  };

  const closeScanner = () => {
    setScanVisible(false);
    focusSOInput();
  };

  const handleScanned = (result: BarcodeScanningResult) => {
    const value = (result?.data ?? "").trim();
    if (!value) return;
    
    // Prevent duplicate scans in same session
    if (sessionCodesRef.current.has(value)) return;
    
    sessionCodesRef.current.add(value);
    Vibration.vibrate();
    
    addSO(value, true);
    
    setLastScannedCode(value);
    setSessionCount(prev => prev + 1);
  };

  const canSubmit = value.trim().length > 0;

  /* ------------------- PERSISTENCE & FOCUS ------------------- */
  useEffect(() => {
    const load = async () => {
      const data = await loadDispatchData();
      if (data) {
        const loadedForm: DispatchForm = {
          transporter: data.form?.transporter ?? "",
          // Normalize stored vehicle number: remove spaces + uppercase
          vehicleNo: (data.form?.vehicleNo ?? "").replace(/\s+/g, "").toUpperCase(),
        };
        setForm(loadedForm);
        setDispatchId(data.dispatchId);
        setItems(data.items || []);
        if (data.dispatchId) {
          setExpanded(false);
          animatedHeight.setValue(0);
          salesOpacity.setValue(1);
          await loadAttachments();
        }
      }
    };
    load();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const timeoutId = setTimeout(() => {
        if (dispatchId && !expanded) {
          soRef.current?.focus();
        } else {
          transporterRef.current?.focus();
        }
      }, 200);
      return () => clearTimeout(timeoutId);
    }, [dispatchId, expanded])
  );

  useEffect(() => {
    if (!expanded && dispatchId) focusSOInput();
  }, [expanded, dispatchId, focusSOInput]);

  useEffect(() => {
    saveDispatchData({
      form,
      dispatchId,
      items,
    });
  }, [form, dispatchId, items]);

  useEffect(() => {
    if (dispatchId) loadAttachments();
  }, [dispatchId]);

  /* ------------------- RENDER ------------------- */
  return (
    <View style={styles.safe}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerRow}>
          {dispatchId && (
            <TouchableOpacity onPress={toggleExpand} style={styles.arrowBtn}>
              <Ionicons
                name={expanded ? "chevron-up-outline" : "chevron-down-outline"}
                size={24}
                color={C.text}
              />
            </TouchableOpacity>
          )}
          <View style={styles.headerActions}>
            <TouchableOpacity onPress={handleAddNew} style={styles.addNewBtn}>
              <Text style={styles.addNewText}>Add New</Text>
            </TouchableOpacity>
            {dispatchId && (
              <TouchableOpacity
                onPress={openFilePicker}
                style={styles.attachBtn}
              >
                <Ionicons name="attach" size={22} color={C.blue} />
                {totalAttachments > 0 && (
                  <View style={styles.attachmentBadge}>
                    <Text style={styles.attachmentBadgeText}>
                      {totalAttachments}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Form */}
        <Animated.View
          style={{
            overflow: "hidden",
            height: formHeightInterpolate,
            opacity: animatedHeight,
            transform: [{ scaleY: scaleInterpolate }],
          }}
        >
          <View style={styles.card}>
            <View style={styles.row2}>
              <TextInput
                ref={transporterRef}
                style={[styles.input, styles.half]}
                placeholder={keyboardDisabled ? "" : "Transporter"}
                placeholderTextColor={C.hint}
                value={form.transporter}
                onChangeText={(t) => onChange("transporter", t)}
                showSoftInputOnFocus={!keyboardDisabled}
              />
              <TextInput
                style={[styles.input, styles.half]}
                placeholder={keyboardDisabled ? "Scan Vehicle..." : "Vehicle Number"}
                placeholderTextColor={C.hint}
                autoCapitalize="characters"
                showSoftInputOnFocus={!keyboardDisabled}
                value={form.vehicleNo}
                onChangeText={(t) => {
                  // No spaces allowed, always uppercase
                  const cleaned = t.replace(/\s+/g, "").toUpperCase();
                  onChange("vehicleNo", cleaned);
                }}
              />
            </View>

            <TouchableOpacity
              onPress={dispatchId ? handleUpdateHeader : handleSaveHeader}
              disabled={!isFormValid || savingHeader}
              style={[
                styles.saveBtn,
                (!isFormValid || savingHeader) && styles.disabledBtn,
              ]}
            >
              {savingHeader ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.saveBtnText}>
                  {dispatchId ? "Update" : "Save"}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* SO & Attachments Section */}
        <Animated.View style={{ opacity: salesOpacity, flex: 1 }}>
          <View style={styles_sales.inputRow}>
            <View style={styles_sales.inputWrap}>
              <TextInput
                ref={soRef}
                value={value}
                onChangeText={setValue}
                placeholder={keyboardDisabled ? "Scan SO..." : "Scan or enter SO"}
                placeholderTextColor={C_sales.sub}
                style={[styles_sales.input, { paddingRight: 44 }]}
                returnKeyType="done"
                onSubmitEditing={() => addSO(value)}
                autoCapitalize="characters"
                autoCorrect={false}
                showSoftInputOnFocus={!keyboardDisabled}
              />
              <Pressable onPress={openScanner} style={styles_sales.scanBtn}>
                <MaterialCommunityIcons
                  name="qrcode-scan"
                  size={20}
                  color={C.accent}
                />
              </Pressable>
            </View>
            <TouchableOpacity
              onPress={() => addSO(value)}
              disabled={!canSubmit || !dispatchId}
              style={[
                styles_sales.submitBtnOuter,
                (!canSubmit || !dispatchId) && { opacity: 0.5 },
              ]}
            >
              <Text style={styles_sales.submitTextOuter}>Submit</Text>
            </TouchableOpacity>
          </View>

          <View style={styles_sales.totalPill}>
            <Text style={styles_sales.totalText}>
              Total SOs: <Text style={styles_sales.totalNum}>{total}</Text> |
              Attachments:{" "}
              <Text style={styles_sales.totalNum}>{totalAttachments}</Text>
            </Text>
          </View>

          {/* SO List */}
          <View style={[styles_sales.tableCard, { marginTop: 12 }]}>
            <View style={[styles_sales.row, styles_sales.headerRow]}>
              <Text style={[styles_sales.th, { width: 40 }]}>S/No</Text>
              <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                <Text style={styles_sales.th}>SO Number</Text>
                <TouchableOpacity 
                    onPress={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                    style={{
                        padding: 4,
                        backgroundColor: '#E5E7EB',
                        borderRadius: 6,
                        marginLeft: 6
                    }}
                >
                    <MaterialCommunityIcons 
                        name={sortOrder === 'asc' ? "sort-ascending" : "sort-descending"} 
                        size={16} 
                        color={C.accent} 
                    />
                </TouchableOpacity>
              </View>
              <Text style={[styles_sales.th, { width: 80 }]}>Time</Text>
              <Text
                style={[styles_sales.th, { width: 72, textAlign: "right" }]}
              >
                Action
              </Text>
            </View>
            <FlatList
              style={{ flex: 1 }}
              data={items.slice().sort((a, b) => {
                const valA = a.soId || "";
                const valB = b.soId || "";
                return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
              })}
              keyExtractor={(it) => it.linkId.toString()}
              contentContainerStyle={
                items.length === 0 && { paddingVertical: 24 }
              }
              ItemSeparatorComponent={() => (
                <View style={styles_sales.divider} />
              )}
              renderItem={({ item, index }) => (
                <View style={styles_sales.row}>
                  <Text style={[styles_sales.td, { width: 40 }]}>
                    {index + 1}
                  </Text>
                  <Text style={[styles_sales.td, { flex: 1 }]}>
                    {item.soId}
                  </Text>
                  <Text style={[styles_sales.td, { width: 80 }]}>
                    {formatTime(item.createdAt)}
                  </Text>
                  <View
                    style={[
                      { width: 72, alignItems: "flex-end" },
                    ]}
                  >
                    <Pressable
                      onPress={() => removeSO(item.linkId)}
                      style={({ pressed }) => [
                        styles_sales.iconBtn,
                        pressed && { backgroundColor: C_sales.hover },
                      ]}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={18}
                        color={C_sales.danger}
                      />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>
        </Animated.View>
      </View>

      {/* ---------- MODALS ---------- */}
      <Modal visible={showNewFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Start New Form</Text>
            <Text style={styles.confirmationMessage}>
              This will clear all current data.
            </Text>
            <View style={styles.confirmationButtons}>
              <TouchableOpacity
                onPress={() => setShowNewFormModal(false)}
                style={[styles.confirmationButton, styles.cancelButton]}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmNewForm}
                style={[styles.confirmationButton, styles.confirmButton]}
              >
                <Text style={styles.confirmButtonText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showSuccess} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.successModal}>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
          </View>
        </View>
      </Modal>

      <Modal visible={showError} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.errorModal}>
            <Text style={styles.modalTitle}>{errorMessage}</Text>
            <TouchableOpacity
              onPress={() => setShowError(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ---------- FILE MODAL ---------- */}
      <UploadModal
        visible={showFileModal}
        dispatchId={dispatchId!} // guarded by openFilePicker
        onClose={() => {
          setShowFileModal(false);
          loadAttachments(); // Refresh badge count
        }}
        onUploadSuccess={() => {
          loadAttachments(); // Refresh list + badge
        }}
      />

      {/* ---------- SCANNER MODAL ---------- */}
      <Modal
        visible={scanVisible}
        onRequestClose={closeScanner}
        animationType="slide"
        presentationStyle="fullScreen"
        transparent={false}
      >
        <StatusBar hidden />
        <View style={styles_scan.fullscreenCameraWrap}>
          <CameraView
            style={styles_scan.fullscreenCamera}
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
          <View style={styles_scan.fullscreenTopBar}>
            <Text style={styles_scan.fullscreenTitle}>Multi-Scan Mode</Text>
            <Pressable onPress={closeScanner} style={styles_scan.fullscreenCloseBtn}>
              <Text style={styles_scan.closeBtnText}>Done</Text>
            </Pressable>
          </View>
          
          {/* Bottom Bar with Feedback */}
          <View style={styles_scan.fullscreenBottomBar}>
            <Text style={styles_scan.fullscreenHint}>Align codes within frame to scan</Text>
            {sessionCount > 0 && (
               <View style={styles_scan.scanFeedback}>
                  <Text style={styles_scan.scanCounter}>Scanned: {sessionCount}</Text>
                  {lastScannedCode && (
                     <Text style={styles_scan.lastScanText} numberOfLines={1}>
                        Last: {lastScannedCode}
                     </Text>
                  )}
               </View>
            )}
          </View>
          
          {/* Focus Frame Overlay */}
          <View style={styles_scan.focusFrameContainer} pointerEvents="none">
             <View style={[styles_scan.focusFrame, sessionCount > 0 ? { borderColor: "#10B981" } : null]} />
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MaterialDispatchScreen;

/* ------------------------------------------------- STYLES ------------------------------------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: {
    flex: 1,
    paddingHorizontal: 14,
    paddingTop: 10,
    backgroundColor: C.bg,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
    justifyContent: "space-between",
  },
  arrowBtn: { padding: 6 },
  headerActions: { flexDirection: "row", gap: 10, alignItems: "center" },
  addNewBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: C.grayBtn,
  },
  addNewText: { color: C.text, fontWeight: "600" },
  attachBtn: { padding: 8, position: "relative" },
  attachmentBadge: {
    position: "absolute",
    top: 0,
    right: 0,
    backgroundColor: C.red,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  attachmentBadgeText: { color: "#fff", fontSize: 10, fontWeight: "bold" },
  card: {
    backgroundColor: C.card,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    padding: 10,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 10 },
  half: { flex: 1, marginBottom: 0 },
  saveBtn: {
    backgroundColor: C.blue,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  disabledBtn: { opacity: 0.6 },
  saveBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  successModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
  errorModal: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    width: "80%",
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: C.text,
    textAlign: "center",
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: C.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  modalButtonText: { color: "#fff", fontWeight: "600" },
  confirmationModal: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 24,
    width: "100%",
    maxWidth: 340,
    alignItems: "center",
  },
  confirmationTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 12,
  },
  confirmationMessage: {
    fontSize: 15,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 24,
  },
  confirmationButtons: { flexDirection: "row", gap: 12, width: "100%" },
  confirmationButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  confirmButton: { backgroundColor: "#2151F5" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  confirmButtonText: { color: "#fff", fontWeight: "600", fontSize: 15 },
});

const styles_sales = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputWrap: { position: "relative", flex: 1 },
  input: {
    backgroundColor: C_sales.card,
    borderColor: C_sales.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: C_sales.text,
  },
  scanBtn: {
    position: "absolute",
    right: 6,
    top: 0,
    bottom: 0,
    justifyContent: "center",
    width: 36,
  },
  submitBtnOuter: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: C_sales.pill,
    borderWidth: 1,
    borderColor: C_sales.border,
  },
  submitTextOuter: { color: C_sales.blue, fontWeight: "700", fontSize: 14 },
  totalPill: {
    marginTop: 10,
    backgroundColor: C_sales.pill,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: C_sales.border,
  },
  totalText: { color: C_sales.sub, fontSize: 13 },
  totalNum: { fontWeight: "700", color: C_sales.text },
  tableCard: {
    flex: 1,
    marginTop: 4,
    backgroundColor: C_sales.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C_sales.border,
    overflow: "hidden",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  headerRow: {
    backgroundColor: "#F8FAFC",
    borderBottomWidth: 1,
    borderBottomColor: C_sales.border,
  },
  th: { fontSize: 11, fontWeight: "700", color: C_sales.text },
  td: { fontSize: 12, color: C_sales.text },
  divider: { height: 1, backgroundColor: C_sales.border },
  iconBtn: {
    height: 24,
    width: 24,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});

const styles_scan = StyleSheet.create({
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: {
    position: "absolute",
    top: Platform.OS === 'ios' ? 44 : 16,
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

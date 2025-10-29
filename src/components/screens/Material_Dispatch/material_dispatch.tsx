// material_dispatch.tsx
import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
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
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
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
  uploadAttachments,
  type CreateDispatchHeaderRequest,
  type UpdateDispatchHeaderRequest,
  type LinkDispatchSORequest,
  type ApiResult,
} from "../../Api/material_dispatch_server";
import { loadDispatchData, saveDispatchData, clearDispatchData } from "../../Storage/material_dispatch_storage";

type DispatchForm = {
  customer: string;
  address: string;
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
    customer: "",
    address: "",
    transporter: "",
    vehicleNo: "",
  });
  const [dispatchId, setDispatchId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [fileName, setFileName] = useState<string>("No file chosen");
  const [expanded, setExpanded] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showError, setShowError] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [showNewFormModal, setShowNewFormModal] = useState(false);

  // Loading states
  const [savingHeader, setSavingHeader] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);

  const animatedHeight = useState(new Animated.Value(1))[0];
  const salesOpacity = useState(new Animated.Value(0))[0];
  const formHeight = 380;

  const customerRef = useRef<TextInput>(null);
  const soRef = useRef<TextInput>(null);

  const onChange = (k: keyof DispatchForm, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const isFormValid = useMemo(() => {
    const { customer, address, transporter, vehicleNo } = form;
    return !!customer?.trim() && !!address?.trim() && !!transporter?.trim() && !!vehicleNo?.trim();
  }, [form]);

  const hasFile = !!selectedFile;

  const handleChooseFile = async () => {
    const res = await DocumentPicker.getDocumentAsync({
      multiple: false,
      copyToCacheDirectory: true,
    });
    if (res.canceled) return;
    const file = res.assets?.[0];
    if (file) {
      setSelectedFile(file);
      setFileName(file.name ?? "Selected file");
    }
  };

  const handleClear = () => {
    setForm({ customer: "", address: "", transporter: "", vehicleNo: "" });
    setDispatchId(null);
    setSelectedFile(null);
    setFileName("No file chosen");
    setItems([]);
  };

  const handleAddNew = () => {
    setShowNewFormModal(true);
  };

  const confirmNewForm = async () => {
    await clearDispatchData();
    handleClear();
    if (!expanded) toggleExpand();
    setShowNewFormModal(false);
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
  };

  // SAVE / UPDATE HEADER
  const handleSaveHeader = async () => {
    if (!isFormValid || savingHeader) return;

    setSavingHeader(true);
    const payload: CreateDispatchHeaderRequest | UpdateDispatchHeaderRequest = {
      customerName: form.customer.trim(),
      transporterName: form.transporter.trim(),
      address: form.address.trim(),
      vehicleNumber: form.vehicleNo.trim(),
    };

    try {
      let result: ApiResult;
      if (!dispatchId) {
        result = await createDispatchHeader(payload as CreateDispatchHeaderRequest);
      } else {
        result = await updateDispatchHeader(dispatchId, payload as UpdateDispatchHeaderRequest);
      }

      if (result.ok) {
        const id = dispatchId || (result.data as any).id;
        setDispatchId(id);
        showToast(" saved successfully!", "success");
        if (expanded) toggleExpand();
      } else {
        setErrorMessage(result.error || "Failed to save header.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Network error. Please try again.");
      setShowError(true);
    } finally {
      setSavingHeader(false);
    }
  };

  // UPLOAD FILE
  const handleUploadFile = async () => {
    if (!dispatchId || !hasFile || uploadingFile) return;

    setUploadingFile(true);
    try {
      const result = await uploadAttachments(dispatchId, [selectedFile!]);
      if (result.ok) {
        showToast("File uploaded successfully!", "success");
        setSelectedFile(null);
        setFileName("No file chosen");
      } else {
        setErrorMessage(result.error || "Upload failed.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Upload failed. Check your connection.");
      setShowError(true);
    } finally {
      setUploadingFile(false);
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

  /** ------------------ Sales Orders + Scanner ------------------ */
  const [value, setValue] = useState("");
  const [items, setItems] = useState<SOEntry[]>([]);
  const total = useMemo(() => items.length, [items]);

  function normalizeSO(raw: string) {
    return raw.replace(/\s+/g, "").toUpperCase();
  }

  async function addSO(raw: string) {
    const so = normalizeSO(raw);
    if (!so || !dispatchId) return;

    if (items.some((x) => x.soId === so)) {
      setErrorMessage(`SO ${so} already added.`);
      setShowError(true);
      return;
    }

    const payload: LinkDispatchSORequest = { saleOrderNumber: so };

    try {
      const result = await linkSalesOrder(dispatchId, payload);
      if (result.ok) {
        const link = result.data;
        setItems((prev) => [
          ...prev,
          { soId: so, linkId: link.id, createdAt: new Date(link.createdAt).getTime() },
        ]);
        setValue("");
      } else {
        setErrorMessage(result.error || "Failed to link SO.");
        setShowError(true);
      }
    } catch {
      setErrorMessage("Failed to link SO.");
      setShowError(true);
    }
  }

  async function removeSO(linkId: number) {
    try {
      const result = await deleteSalesOrderLink(linkId);
      if (result.ok) {
        setItems((prev) => prev.filter((x) => x.linkId !== linkId));
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

  // Scanner
  const [scanVisible, setScanVisible] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLocked, setScanLocked] = useState(false);

  const openScanner = async () => {
    if (!dispatchId) {
      setErrorMessage("Create header first.");
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
    setScanLocked(false);
    setScanVisible(true);
  };

  const closeScanner = () => {
    setScanVisible(false);
    setScanLocked(false);
  };

  const onScanned = (result: BarcodeScanningResult) => {
    if (scanLocked) return;
    setScanLocked(true);
    addSO(result.data ?? "");
    setTimeout(closeScanner, 300);
  };

  const canSubmit = value.trim().length > 0;

  // Load data
  useEffect(() => {
    const load = async () => {
      const data = await loadDispatchData();
      if (data) {
        setForm(data.form);
        setDispatchId(data.dispatchId);
        setItems(data.items || []);
        setFileName(data.fileName || "No file chosen");
        if (data.selectedFile) {
          setSelectedFile(data.selectedFile);
        }
        if (data.dispatchId) {
          setExpanded(false);
          animatedHeight.setValue(0);
          salesOpacity.setValue(1);
        }
      }
    };
    load();
  }, []);

  // Auto-focus
  useEffect(() => {
    if (dispatchId) soRef.current?.focus();
    else customerRef.current?.focus();
  }, [dispatchId]);

  // Save to storage
  useEffect(() => {
    saveDispatchData({
      form,
      dispatchId,
      items,
      fileName,
      selectedFile,
    });
  }, [form, dispatchId, items, fileName, selectedFile]);

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
            <TextInput
              ref={customerRef}
              style={styles.input}
              placeholder="Customer"
              placeholderTextColor={C.hint}
              value={form.customer}
              onChangeText={(t) => onChange("customer", t)}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Address"
              placeholderTextColor={C.hint}
              multiline
              value={form.address}
              onChangeText={(t) => onChange("address", t)}
            />
            <View style={styles.row2}>
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Transporter"
                placeholderTextColor={C.hint}
                value={form.transporter}
                onChangeText={(t) => onChange("transporter", t)}
              />
              <TextInput
                style={[styles.input, styles.half]}
                placeholder="Vehicle Number"
                placeholderTextColor={C.hint}
                autoCapitalize="characters"
                value={form.vehicleNo}
                onChangeText={(t) => onChange("vehicleNo", t)}
              />
            </View>

            <View style={styles.fileRow}>
              <TouchableOpacity onPress={handleChooseFile} style={styles.fileBtn}>
                <Text style={styles.fileBtnText}>Choose File</Text>
              </TouchableOpacity>
              <Text style={styles.fileName} numberOfLines={1}>
                {fileName}
              </Text>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity
                onPress={handleSaveHeader}
                disabled={!isFormValid || savingHeader}
                style={[
                  styles.actionBtn,
                  styles.saveHeaderBtn,
                  (!isFormValid || savingHeader) && styles.disabledBtn,
                ]}
              >
                {savingHeader ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.actionBtnText}>
                    {dispatchId ? "Update " : "Save"}
                  </Text>
                )}
              </TouchableOpacity>

              {dispatchId && hasFile && (
                <TouchableOpacity
                  onPress={handleUploadFile}
                  disabled={uploadingFile}
                  style={[
                    styles.actionBtn,
                    styles.uploadBtn,
                    uploadingFile && styles.disabledBtn,
                  ]}
                >
                  {uploadingFile ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.actionBtnText}>Upload File</Text>
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </Animated.View>

        {/* SO Section */}
        <Animated.View style={{ opacity: salesOpacity, flex: 1 }}>
          <View style={styles_sales.inputRow}>
            <View style={styles_sales.inputWrap}>
              <TextInput
                ref={soRef}
                value={value}
                onChangeText={setValue}
                placeholder="Scan or enter SO"
                placeholderTextColor={C_sales.sub}
                style={[styles_sales.input, { paddingRight: 44 }]}
                returnKeyType="done"
                onSubmitEditing={() => addSO(value)}
                autoCapitalize="characters"
                autoCorrect={false}
              />
              <Pressable onPress={openScanner} style={styles_sales.scanBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={C.accent} />
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
              Total SOs: <Text style={styles_sales.totalNum}>{total}</Text>
            </Text>
          </View>

          <View style={styles_sales.tableCard}>
            <View style={[styles_sales.row, styles_sales.headerRow]}>
              <Text style={[styles_sales.th, { width: 40 }]}>S/No</Text>
              <Text style={[styles_sales.th, { flex: 1 }]}>SO Number</Text>
              <Text style={[styles_sales.th, { width: 80 }]}>Time</Text>
              <Text style={[styles_sales.th, { width: 72, textAlign: "right" }]}>Action</Text>
            </View>
            <FlatList
              data={items}
              keyExtractor={(it) => it.linkId.toString()}
              contentContainerStyle={items.length === 0 && { paddingVertical: 24 }}
              ItemSeparatorComponent={() => <View style={styles_sales.divider} />}
              renderItem={({ item, index }) => (
                <View style={styles_sales.row}>
                  <Text style={[styles_sales.td, { width: 40 }]}>{index + 1}</Text>
                  <Text style={[styles_sales.td, { flex: 1 }]}>{item.soId}</Text>
                  <Text style={[styles_sales.td, { width: 80 }]}>{formatTime(item.createdAt)}</Text>
                  <View style={[styles_sales.td, { width: 72, alignItems: "flex-end" }]}>
                    <Pressable
                      onPress={() => removeSO(item.linkId)}
                      style={({ pressed }) => [
                        styles_sales.iconBtn,
                        pressed && { backgroundColor: C_sales.hover },
                      ]}
                    >
                      <Ionicons name="trash-outline" size={18} color={C_sales.danger} />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          </View>
        </Animated.View>
      </View>

      {/* Modals */}
      <Modal visible={showNewFormModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.confirmationModal}>
            <Text style={styles.confirmationTitle}>Start New Form</Text>
            <Text style={styles.confirmationMessage}>This will clear all current data.</Text>
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
            <TouchableOpacity onPress={() => setShowError(false)} style={styles.modalButton}>
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={scanVisible} animationType="slide" presentationStyle="fullScreen">
        <StatusBar hidden />
        <View style={styles_scan.fullscreenCameraWrap}>
          <CameraView
            style={styles_scan.fullscreenCamera}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e"],
            }}
            onBarcodeScanned={scanLocked ? undefined : onScanned}
          />
          <View style={styles_scan.fullscreenTopBar}>
            <Text style={styles_scan.fullscreenTitle}>Scan a code</Text>
            <Pressable onPress={closeScanner} style={styles_scan.fullscreenCloseBtn}>
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
          </View>
          <View style={styles_scan.fullscreenBottomBar}>
            <Text style={styles_scan.fullscreenHint}>Align code in frame</Text>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default MaterialDispatchScreen;

// Styles (updated with new buttons)
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  container: { flex: 1, paddingHorizontal: 14, paddingTop: 10, backgroundColor: C.bg },
  headerRow: { flexDirection: "row", alignItems: "center", marginBottom: 10, justifyContent: "space-between" },
  arrowBtn: { padding: 6 },
  headerActions: { flexDirection: "row", gap: 10 },
  addNewBtn: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: C.grayBtn },
  addNewText: { color: C.text, fontWeight: "600" },
  card: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10 },
  input: { borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: C.text, marginBottom: 10, backgroundColor: "#FFFFFF" },
  textArea: { minHeight: 90, textAlignVertical: "top" },
  row2: { flexDirection: "row", gap: 10, marginBottom: 10 },
  half: { flex: 1, marginBottom: 0 },
  fileRow: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: C.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, gap: 10, marginBottom: 12 },
  fileBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: C.grayBtn },
  fileBtnText: { color: C.text, fontWeight: "600" },
  fileName: { flex: 1, color: C.text },
  buttonRow: { flexDirection: "row", gap: 10 },
  actionBtn: { flex: 1, borderRadius: 10, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  saveHeaderBtn: { backgroundColor: C.blue },
  uploadBtn: { backgroundColor: C.green },
  disabledBtn: { opacity: 0.6 },
  actionBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "center", alignItems: "center", padding: 20 },
  successModal: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", width: "80%" },
  errorModal: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 24, alignItems: "center", width: "80%" },
  modalTitle: { fontSize: 16, fontWeight: "600", color: C.text, textAlign: "center", marginBottom: 20 },
  modalButton: { backgroundColor: C.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  modalButtonText: { color: "#FFFFFF", fontWeight: "600" },
  confirmationModal: { backgroundColor: "#FFFFFF", borderRadius: 20, padding: 24, width: "100%", maxWidth: 340, alignItems: "center" },
  confirmationTitle: { fontSize: 20, fontWeight: "700", color: "#111827", marginBottom: 12 },
  confirmationMessage: { fontSize: 15, color: "#6B7280", textAlign: "center", lineHeight: 20, marginBottom: 24 },
  confirmationButtons: { flexDirection: "row", gap: 12, width: "100%" },
  confirmationButton: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: "center" },
  cancelButton: { backgroundColor: "#F3F4F6", borderWidth: 1, borderColor: "#E5E7EB" },
  confirmButton: { backgroundColor: "#2151F5" },
  cancelButtonText: { color: "#374151", fontWeight: "600", fontSize: 15 },
  confirmButtonText: { color: "#FFFFFF", fontWeight: "600", fontSize: 15 },
});

const styles_sales = StyleSheet.create({
  inputRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  inputWrap: { position: "relative", flex: 1 },
  input: { backgroundColor: C_sales.card, borderColor: C_sales.border, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C_sales.text },
  scanBtn: { position: "absolute", right: 6, top: 0, bottom: 0, justifyContent: "center", width: 36 },
  submitBtnOuter: { paddingHorizontal: 14, paddingVertical: 12, borderRadius: 10, backgroundColor: C_sales.pill, borderWidth: 1, borderColor: C_sales.border },
  submitTextOuter: { color: C_sales.blue, fontWeight: "700", fontSize: 14 },
  totalPill: { marginTop: 10, backgroundColor: C_sales.pill, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: C_sales.border },
  totalText: { color: C_sales.sub, fontSize: 13 },
  totalNum: { fontWeight: "700", color: C_sales.text },
  tableCard: { marginTop: 12, backgroundColor: C_sales.card, borderRadius: 12, borderWidth: 1, borderColor: C_sales.border, overflow: "hidden", flex: 1 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  headerRow: { backgroundColor: "#F8FAFC", borderBottomWidth: 1, borderBottomColor: C_sales.border },
  th: { fontSize: 13, fontWeight: "700", color: C_sales.text },
  td: { fontSize: 14, color: C_sales.text },
  divider: { height: 1, backgroundColor: C_sales.border },
  iconBtn: { height: 30, width: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
});

const styles_scan = StyleSheet.create({
  fullscreenCameraWrap: { flex: 1, backgroundColor: "#000" },
  fullscreenCamera: { flex: 1 },
  fullscreenTopBar: { position: "absolute", top: 44, left: 16, right: 16, height: 40, borderRadius: 20, backgroundColor: "rgba(0,0,0,0.55)", flexDirection: "row", alignItems: "center", paddingHorizontal: 12 },
  fullscreenTitle: { color: "#fff", fontWeight: "700", fontSize: 14, flex: 1 },
  fullscreenCloseBtn: { height: 28, width: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  fullscreenBottomBar: { position: "absolute", bottom: 24, left: 16, right: 16, borderRadius: 12, backgroundColor: "rgba(0,0,0,0.55)", paddingVertical: 10, alignItems: "center" },
  fullscreenHint: { color: "#fff", fontSize: 12 },
});
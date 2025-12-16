// src/screens/pick_and_pack/SO_OrderDetailsScreen/OrderDetails.tsx
import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Pressable,
  Modal,
  Keyboard,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import { useCameraPermissions } from "expo-camera";
import {
  getOrderDetails,
  updateIssuedQty,
  updatePackedQty,
  isOrderIssuedComplete,
  isOrderPackedComplete,
  type StoredMaterialItem,
} from "../../../Storage/sale_order_storage";

import ViewOrderDetails from "./ViewOrderDetails";
import ScannerModal from "./ScannerModal";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  SalesOrderScreen: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  OrderDetails: { saleOrderNumber: string };
  Upload: { saleOrderNumber: string };
};

type OrderDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  "OrderDetails"
>;

type Props = { route: OrderDetailsScreenRouteProp };

type DescModalData = {
  materialCode?: string;
  description?: string;
  batchNo?: string;
  soDonorBatch?: string;
  certNo?: string;
  binNo?: string | number;
  adf?: string;
  requiredQty?: number;
  packingStage?: string;
  issuedQty?: number;
  packedQty?: number;
  issuedAt?: string;
  packedAt?: string;
};

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  greenBg: "#E6F9EC",
  accent: "#111827",
  greenText: "#166534",
  yellowBg: "#FEF3C7",
  yellowText: "#92400E",
  primaryBtn: "#111827",
  primaryBtnText: "#FFFFFF",
  icon: "#111827",
  danger: "#B91C1C",
};

const OrderDetailsScreen: React.FC<Props> = () => {
  const route = useRoute<OrderDetailsScreenRouteProp>();
  const { saleOrderNumber } = route.params;
  const navigation = useNavigation<any>();

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<StoredMaterialItem[]>([]);
  const [code, setCode] = useState("");
  const inputRef = useRef<TextInput>(null);

  // Scanner
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLock, setScanLock] = useState(false);

  // Print & Stage Control
  const [hasPrintedIssue, setHasPrintedIssue] = useState(false);
  const [hasPrintedPacking, setHasPrintedPacking] = useState(false);

  // This is the NEW key state: packing stage only becomes visible AFTER user confirms issue print
  const [packingStageUnlocked, setPackingStageUnlocked] = useState(false);

  const [initialIssuedComplete, setInitialIssuedComplete] = useState(false);
  const [initialPackedComplete, setInitialPackedComplete] = useState(false);

  // Modals
  const [descModal, setDescModal] = useState<{ visible: boolean; data?: DescModalData }>({
    visible: false,
  });

  const [dialog, setDialog] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    emphasis?: "normal" | "danger";
  }>({ visible: false });

  const openDialog = (title: string, message: string, emphasis: "normal" | "danger" = "normal") =>
    setDialog({ visible: true, title, message, emphasis });

  const closeDialog = () => {
    setDialog((d) => ({ ...d, visible: false }));

    const isIssuedCompleteNow = materials.every(
      (m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0)
    );
    const isPackedCompleteNow = materials.every(
      (m) => (m.packedQty ?? 0) >= (m.requiredQty ?? 0)
    );

    if (
      (hasPrintedIssue && !initialIssuedComplete && !isPackedCompleteNow) ||
      (hasPrintedPacking && !initialPackedComplete)
    ) {
      setTimeout(() => navigation.goBack(), 200);
    } else {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  };

  /* -------------------------- LOAD ORDER ----------------------------- */
  const loadOrder = useCallback(async () => {
    try {
      setLoading(true);
      const data = await getOrderDetails(saleOrderNumber);
      if (data && Array.isArray(data.orderDetails)) {
        const sorted = [...data.orderDetails].sort((a, b) =>
          String(a.materialCode ?? "").localeCompare(String(b.materialCode ?? ""), undefined, {
            numeric: true,
            sensitivity: "base",
          })
        );
        setMaterials(sorted);

        const issuedDone = isOrderIssuedComplete(data);
        const packedDone = isOrderPackedComplete(data);

        setInitialIssuedComplete(issuedDone);
        setInitialPackedComplete(packedDone);

        // If order was already issued before, unlock packing stage accordingly
        if (issuedDone) {
          setHasPrintedIssue(true);
          setPackingStageUnlocked(true); // already passed issue stage
        }
        if (packedDone) {
          setHasPrintedPacking(true);
        }
      } else {
        openDialog("Error", "No order details found.", "danger");
      }
    } catch (e: any) {
      openDialog("Error", e?.message ?? "Failed to load order.", "danger");
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [saleOrderNumber]);

  useEffect(() => {
    loadOrder();
  }, [loadOrder]);

  /* -------------------------- KEYBOARD FOCUS -------------------------- */
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => inputRef.current?.focus());
    return () => sub.remove();
  }, []);

  /* --------------------------- SUMMARY ------------------------------- */
  const {
    totalItems,
    completedItems,
    totalRequired,
    totalIssued,
    totalPacked,
  } = useMemo(() => {
    const ti = materials.length;
    const ci = materials.filter(
      (m) =>
        (m.issuedQty ?? 0) >= (m.requiredQty ?? 0) &&
        (m.packedQty ?? 0) >= (m.requiredQty ?? 0)
    ).length;
    const tr = materials.reduce((s, m) => s + (Number(m.requiredQty) || 0), 0);
    const tiq = materials.reduce((s, m) => s + (Number(m.issuedQty) || 0), 0);
    const tpq = materials.reduce((s, m) => s + (Number(m.packedQty) || 0), 0);
    return {
      totalItems: ti,
      completedItems: ci,
      totalRequired: tr,
      totalIssued: tiq,
      totalPacked: tpq,
    };
  }, [materials]);

  const isOrderIssuedCompleteLocal = materials.every(
    (m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0)
  );

  const isOrderPackedCompleteLocal = materials.every(
    (m) => (m.packedQty ?? 0) >= (m.requiredQty ?? 0)
  );

  /* -------------------------- SCAN / INPUT --------------------------- */
  const incrementForCode = async (materialCodeInput: string) => {
    const codeTrim = materialCodeInput.trim();
    if (!codeTrim) {
      openDialog("Invalid Input", "Please scan or type a material code.", "danger");
      setCode("");
      return;
    }

    const idx = materials.findIndex(
      (m) => String(m.materialCode).toLowerCase() === codeTrim.toLowerCase()
    );

    if (idx === -1) {
      openDialog("Invalid Material Code", `Code "${codeTrim}" not found in order.`, "danger");
      setCode("");
      return;
    }

    const row = materials[idx];
    const req = Number(row.requiredQty) || 0;

    try {
      if (packingStageUnlocked) {
        // Packing stage
        const curPacked = Number(row.packedQty) || 0;
        if (curPacked >= req) {
          openDialog("Already Complete", "This item is already packed.", "danger");
          setCode("");
          return;
        }
        await updatePackedQty(saleOrderNumber, row.materialCode, "inc", 1);
      } else {
        // Issuance stage
        const curIssued = Number(row.issuedQty) || 0;
        if (curIssued >= req) {
          openDialog("Already Complete", "This item is already issued.", "danger");
          setCode("");
          return;
        }
        await updateIssuedQty(saleOrderNumber, row.materialCode, "inc", 1);
      }

      const updated = await getOrderDetails(saleOrderNumber);
      if (updated) setMaterials(updated.orderDetails);
      setCode("");
    } catch (err: any) {
      openDialog("Error", err.message || "Failed to update quantity.", "danger");
      setCode("");
    }
  };

  const onSubmit = () => incrementForCode(code);

  /* -------------------------- PRINT LOGIC (NOW CONTROLS STAGE TRANSITION) -------------------------- */
  const onPrint = () => {
    if (!isOrderIssuedCompleteLocal) return;

    if (!hasPrintedIssue) {
      // First time completing issue stage
      openDialog(
        "Print Successful",
        "Issue stage print completed successfully.",
        "normal"
      );
      setHasPrintedIssue(true);
      // Do NOT unlock packing yet — wait for user to press OK
    } else if (isOrderPackedCompleteLocal && !hasPrintedPacking) {
      openDialog(
        "Print Successful",
        "Packing stage print completed successfully.",
        "normal"
      );
      setHasPrintedPacking(true);
    }
  };

  // Unlock packing stage ONLY when user confirms the issue print dialog
  useEffect(() => {
    if (dialog.visible === false && hasPrintedIssue && !packingStageUnlocked) {
      const wasIssuePrintDialog = dialog.message?.includes("Issue stage print completed");
      if (wasIssuePrintDialog) {
        setPackingStageUnlocked(true);
      }
    }
  }, [dialog.visible, hasPrintedIssue, packingStageUnlocked]);

  /* -------------------------- SCANNER -------------------------- */
  const openScanner = async () => {
    if (!permission?.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        openDialog("Permission Required", "Camera access is needed to scan codes.", "danger");
        return;
      }
    }
    setScanLock(false);
    setCameraOpen(true);
  };

  const closeScanner = () => {
    setCameraOpen(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const onBarcodeScanned = async (result: any) => {
    if (scanLock) return;
    const data = result?.data?.trim();
    if (!data) return;

    setScanLock(true);
    setCode(data);
    await incrementForCode(data);

    setTimeout(() => {
      setCameraOpen(false);
      setScanLock(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }, 300);
  };

  /* ----------------------- QUANTITY EDITORS -------------------------- */
  const validateNumberInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    return { isValid: digits === "" || !isNaN(Number(digits)), value: Number(digits) || 0 };
  };

  const setIssuedQtyAt = async (index: number, raw: string) => {
    const { isValid, value } = validateNumberInput(raw);
    if (!isValid && raw.trim() !== "") {
      openDialog("Invalid Input", "Please enter a valid number.", "danger");
      return;
    }
    const row = materials[index];
    const req = Number(row.requiredQty) || 0;
    const clamped = Math.max(0, Math.min(value, req));

    try {
      await updateIssuedQty(saleOrderNumber, row.materialCode, "set", clamped);
      const updated = await getOrderDetails(saleOrderNumber);
      if (updated) setMaterials(updated.orderDetails);
    } catch (err: any) {
      openDialog("Error", err.message || "Failed to update.", "danger");
    }
  };

  const setPackedQtyAt = async (index: number, raw: string) => {
    const { isValid, value } = validateNumberInput(raw);
    if (!isValid && raw.trim() !== "") {
      openDialog("Invalid Input", "Please enter a valid number.", "danger");
      return;
    }
    const row = materials[index];
    const req = Number(row.requiredQty) || 0;
    const clamped = Math.max(0, Math.min(value, req));

    try {
      await updatePackedQty(saleOrderNumber, row.materialCode, "set", clamped);
      const updated = await getOrderDetails(saleOrderNumber);
      if (updated) setMaterials(updated.orderDetails);
    } catch (err: any) {
      openDialog("Error", err.message || "Failed to update.", "danger");
    }
  };

  /* -------------------------- SHOW PRINT BUTTON -------------------------- */
  const showPrintButton =
    (isOrderIssuedCompleteLocal && !hasPrintedIssue) ||
    (isOrderPackedCompleteLocal && hasPrintedIssue && !hasPrintedPacking);

  /* ------------------------------ RENDER ------------------------------ */
  if (loading) {
    return (
      <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading order details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        {/* Fixed Header */}
        <View style={styles.fixedWrapper}>
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>Completed Items</Text>
              <Text style={styles.chipValue}>{completedItems}/{totalItems}</Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>
                {packingStageUnlocked ? "Packed" : "Issued"}
              </Text>
              <Text style={styles.chipValue}>
                {packingStageUnlocked ? totalPacked : totalIssued}/{totalRequired}
              </Text>
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputWrap}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                placeholder="Scan / Enter Material Code"
                placeholderTextColor={C.subText}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={onSubmit}
                autoFocus
              />
              <Pressable onPress={openScanner} style={styles.inputIconBtn}>
                <MaterialCommunityIcons name="qrcode-scan" size={20} color={C.icon} />
              </Pressable>
            </View>

            <Pressable style={styles.primaryBtn} onPress={onSubmit}>
              <Text style={styles.primaryBtnText}>Submit</Text>
            </Pressable>

            {/* Print Button */}
            {showPrintButton && (
              <Pressable style={styles.primaryBtn} onPress={onPrint}>
                <MaterialCommunityIcons name="printer" size={22} color="#fff" />
              </Pressable>
            )}
          </View>

          {/* Table Header */}
          <View style={styles.card}>
            <View style={styles.tableHead}>
              <View style={[styles.cell, styles.flex15, styles.left]}>
                <Text style={styles.headText}>Material Code</Text>
              </View>
              <View style={[styles.cell, styles.flex45, styles.left]}>
                <Text style={styles.headText}>Description</Text>
              </View>
              <View style={[styles.cell, styles.flex12, styles.right]}>
                <Text style={styles.headText}>Qty</Text>
              </View>
              <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                <Text style={styles.headText}>Issue</Text>
              </View>
              {packingStageUnlocked && (
                <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                  <Text style={styles.headText}>Packing</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* List */}
        <FlatList
          data={materials}
          keyExtractor={(item, i) => `${item.materialCode}-${i}`}
          contentContainerStyle={styles.bodyListContent}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          renderItem={({ item, index }) => {
            const req = Number(item.requiredQty ?? 0);
            const isIssued = Number(item.issuedQty ?? 0) >= req;
            const isPacked = Number(item.packedQty ?? 0) >= req;
            const rowBg = isPacked ? C.greenBg : isIssued ? C.yellowBg : undefined;
            const issuedColor = isPacked ? C.greenText : isIssued ? C.yellowText : C.headerText;
            const truncatedDesc =
              item.description && String(item.description).length > 30
                ? String(item.description).substring(0, 30) + "..."
                : item.description || "";

            return (
              <View style={styles.card}>
                <Pressable
                  onPress={() =>
                    setDescModal({
                      visible: true,
                      data: {
                        materialCode: String(item.materialCode ?? ""),
                        description: String(item.description ?? ""),
                        batchNo: String(item.batchNo ?? ""),
                        soDonorBatch: String(item.soDonorBatch ?? ""),
                        certNo: String(item.certNo ?? ""),
                        binNo: item.binNo,
                        adf: String(item.adf ?? ""),
                        requiredQty: req,
                        issuedQty: Number(item.issuedQty ?? 0),
                        packedQty: Number(item.packedQty ?? 0),
                        issuedAt: item.issuedAt,
                        packedAt: item.packedAt,
                      },
                    })
                  }
                  style={[styles.row, rowBg && { backgroundColor: rowBg }]}
                >
                  <View style={[styles.cell, styles.flex15, styles.left]}>
                    <Text
                      style={[
                        styles.metricText,
                        (isIssued || isPacked) && { color: issuedColor, fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.materialCode}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex45, styles.left]}>
                    <Text
                      style={[
                        styles.metricText,
                        (isIssued || isPacked) && { color: issuedColor },
                      ]}
                      numberOfLines={1}
                    >
                      {truncatedDesc}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex12, styles.right]}>
                    <Text
                      style={[
                        styles.metricText,
                        (isIssued || isPacked) && { color: issuedColor, fontWeight: "700" },
                      ]}
                    >
                      {req}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                    <TextInput
                      value={String(item.issuedQty ?? 0)}
                      onChangeText={(t) => setIssuedQtyAt(index, t)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={4}
                      style={[
                        styles.issueInput,
                        isIssued && { },
                      ]}
                    />
                  </View>

                  {/* Packing column only shown after unlock */}
                  {packingStageUnlocked && (
                    <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                      <TextInput
                        value={String(item.packedQty ?? 0)}
                        onChangeText={(t) => setPackedQtyAt(index, t)}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={4}
                        style={[
                          styles.issueInput,
                          isPacked && {  },
                        ]}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.subText}>No materials found.</Text>}
          ListFooterComponent={<View style={{ height: 20 }} />}
        />

        {/* Modals */}
        <ScannerModal
          visible={cameraOpen}
          onClose={closeScanner}
          onBarcodeScanned={onBarcodeScanned}
          scanLock={scanLock}
        />

        <ViewOrderDetails
          visible={descModal.visible}
          data={descModal.data}
          onClose={() => setDescModal({ visible: false })}
        />

        <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={closeDialog}>
          <View style={styles.appDialogOverlay}>
            <View style={styles.appDialogCard}>
              <View style={styles.appDialogHeader}>
                <Ionicons
                  name={dialog.emphasis === "danger" ? "alert-circle" : "checkmark-circle"}
                  size={24}
                  color={dialog.emphasis === "danger" ? C.danger : "#166534"}
                />
                <Text style={[styles.appDialogTitle, dialog.emphasis === "danger" && { color: C.danger }]}>
                  {dialog.title || "Success"}
                </Text>
              </View>
              {dialog.message && <Text style={styles.appDialogMessage}>{dialog.message}</Text>}
              <View style={styles.appDialogFooter}>
                <Pressable style={styles.appDialogBtn} onPress={closeDialog}>
                  <Text style={styles.appDialogBtnText}>OK</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
};

/* Styles unchanged - same as before */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.pageBg },
  content: { flex: 1 },
  fixedWrapper: { paddingHorizontal: 10, paddingTop: 8 },
  list: { flex: 1 },
  bodyListContent: { paddingHorizontal: 10, paddingBottom: 20, rowGap: 10 },
  chipsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  chip: {
    flex: 1,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  chipTitle: { color: C.subText, fontSize: 12, fontWeight: "600" },
  chipValue: { color: C.headerText, fontSize: 18, fontWeight: "700", marginTop: 2 },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: 10 },
  inputWrap: { flex: 1, position: "relative" },
  input: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingRight: 44,
    height: 44,
    color: C.headerText,
  },
  inputIconBtn: {
    position: "absolute",
    right: 8,
    top: 0,
    bottom: 0,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.primaryBtn,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: { color: C.primaryBtnText, fontWeight: "700" },
  card: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, overflow: "hidden" },
  tableHead: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headText: { color: C.subText, fontWeight: "600", fontSize: 12 },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  cell: { justifyContent: "center" },
  left: { alignItems: "flex-start" },
  right: { alignItems: "flex-end" },
  centerAlign: { alignItems: "center" },
  flex15: { flex: 1.5 },
  flex45: { flex: 4.5 },
  flex12: { flex: 1.2 },
  flex14: { flex: 1.4 },
  metricText: { fontSize: 14, fontWeight: "500", color: C.headerText },
  sep: { height: 1, backgroundColor: C.border },
  subText: { color: C.subText, fontSize: 12, textAlign: "center", marginTop: 20 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { color: C.subText },
  issueInput: {
    minWidth: 44,
    height: 45,
    paddingHorizontal: 8,
    textAlign: "center",
    color: C.headerText,
    fontWeight: "700",
  },
  appDialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  appDialogCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    padding: 20,
  },
  appDialogHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  appDialogTitle: { fontSize: 17, fontWeight: "800", color: C.headerText, flex: 1 },
  appDialogMessage: { color: C.headerText, lineHeight: 22, marginBottom: 16, fontSize: 15 },
  appDialogFooter: { alignItems: "flex-end" },
  appDialogBtn: {
    backgroundColor: C.primaryBtn,
    paddingHorizontal: 20,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  appDialogBtnText: { color: C.primaryBtnText, fontWeight: "700", fontSize: 15 },
});

export default OrderDetailsScreen;
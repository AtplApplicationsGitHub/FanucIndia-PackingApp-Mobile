import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TextInput,
  Pressable,
  Modal,
  Platform,
  StatusBar,
  Keyboard,
  FlatList,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import {
  CameraView,
  useCameraPermissions,
  type BarcodeScanningResult,
} from "expo-camera";

import {
  getOrderDetails,
  type StoredMaterialItem,
  saveOrderDetails,
} from "../../Storage/sale_order_storage";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  PickAndPack: undefined;
  MaterialFG: undefined;
  MaterialDispatch: undefined;
  OrderDetails: { saleOrderNumber: string };
  Upload: { saleOrderNumber: string };
};

type OrderDetailsScreenRouteProp = RouteProp<RootStackParamList, "OrderDetails">;

type Props = { route: OrderDetailsScreenRouteProp };

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  greenBg: "#E6F9EC",
  ccent: "#111827",
  greenText: "#166534",
  yellowBg: "#FEF3C7",
  yellowText: "#92400E",
  primaryBtn: "#111827",
  primaryBtnText: "#FFFFFF",
  icon: "#111827",
  danger: "#B91C1C",
};

type MaterialRow = StoredMaterialItem;

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
};

const OrderDetailsScreen: React.FC<Props> = () => {
  const route = useRoute<OrderDetailsScreenRouteProp>();
  const { saleOrderNumber } = route.params;
  
  const navigation = useNavigation<{
    navigate: (screen: keyof RootStackParamList, params?: any) => void;
    goBack: () => void;
  }>();

  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [code, setCode] = useState("");

  const inputRef = useRef<TextInput | null>(null);

  // camera / scanner
  const [cameraOpen, setCameraOpen] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanLock, setScanLock] = useState(false);

  // Row quick view modal
  const [descModal, setDescModal] = useState<{
    visible: boolean;
    data?: DescModalData;
  }>({ visible: false });

  // App dialog modal
  const [dialog, setDialog] = useState<{
    visible: boolean;
    title?: string;
    message?: string;
    emphasis?: "normal" | "danger";
  }>({ visible: false });

  const openDialog = (
    title: string,
    message: string,
    emphasis: "normal" | "danger" = "normal"
  ) => setDialog({ visible: true, title, message, emphasis });
  
  const closeDialog = () => setDialog((d) => ({ ...d, visible: false }));

  const [initialIssuedComplete, setInitialIssuedComplete] = useState(false);
  const [initialPackedComplete, setInitialPackedComplete] = useState(false);

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        const data = await getOrderDetails(saleOrderNumber);
        if (data && Array.isArray(data.orderDetails)) {
          const withIssued: MaterialRow[] = (data.orderDetails as any[]).map((m: any) => ({
            ...m,
            issuedQty: typeof m.issuedQty === "number" ? m.issuedQty : 0,
            packedQty: typeof m.packedQty === "number" ? m.packedQty : 0,
          }));
          withIssued.sort((a, b) =>
            String(a.materialCode ?? "").localeCompare(String(b.materialCode ?? ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
          setMaterials(withIssued);
          const isIssued = withIssued.every((m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0));
          const isPacked = withIssued.every((m) => (m.packedQty ?? 0) >= (m.requiredQty ?? 0));
          setInitialIssuedComplete(isIssued);
          setInitialPackedComplete(isPacked);
        } else {
          openDialog("Error", "No order details found or invalid data format.", "danger");
        }
      } catch (e: any) {
        openDialog("Error", e?.message ?? "Failed to load order details.", "danger");
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    loadDetails();
  }, [saleOrderNumber]);

  // ✅ NEW: AUTO REFRESH EFFECT - Triggers when ALL materials complete
  useEffect(() => {
    if (loading) return;

    const isIssuedComplete = materials.every((m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0));
    const isPackedComplete = materials.every((m) => (m.packedQty ?? 0) >= (m.requiredQty ?? 0));

    if (isIssuedComplete && !initialIssuedComplete && !isPackedComplete) {
      openDialog("All issues completed.", "Upload the issue stage.");
      setTimeout(() => {
        closeDialog();
        // ✅ REFRESH ON RETURN
        navigation.goBack();
      }, 200);
    } else if (isPackedComplete && !initialPackedComplete) {
      openDialog("All packing completed.", "Upload the packing stage.");
      setTimeout(() => {
        closeDialog();
        // ✅ REFRESH ON RETURN
        navigation.goBack();
      }, 200);
    }
  }, [materials, loading, initialIssuedComplete, initialPackedComplete, navigation]);

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      inputRef.current?.focus();
    });
    return () => sub.remove();
  }, []);

  const { totalItems, completedItems, totalRequired, totalIssued, completedPackedItems, totalPacked } = useMemo(() => {
    const ti = materials.length;
    const ci = materials.filter((m) => 
      (m.issuedQty ?? 0) >= (m.requiredQty ?? 0) && 
      (m.packedQty ?? 0) >= (m.requiredQty ?? 0)
    ).length;
    const cp = materials.filter((m) => (m.packedQty ?? 0) >= (m.requiredQty ?? 0)).length;
    const tr = materials.reduce((s, m) => s + (Number(m.requiredQty) || 0), 0);
    const tiq = materials.reduce((s, m) => s + (Number(m.issuedQty) || 0), 0);
    const tpq = materials.reduce((s, m) => s + (Number(m.packedQty) || 0), 0);
    return { totalItems: ti, completedItems: ci, completedPackedItems: cp, totalRequired: tr, totalIssued: tiq, totalPacked: tpq };
  }, [materials]);

  const isOrderIssuedComplete = materials.every((m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0));

  const persist = (rows: MaterialRow[]) => {
    saveOrderDetails(saleOrderNumber, rows as unknown as StoredMaterialItem[]);
  };

  const incrementForCode = (materialCodeInput: string) => {
    const codeTrim = materialCodeInput.trim();
    if (!codeTrim) {
      openDialog("Please scan or type a material code.", "", "danger");
      setCode("");
      return;
    }

    const idx = materials.findIndex(
      (m) => String(m.materialCode).toLowerCase() === codeTrim.toLowerCase()
    );

    if (idx === -1) {
      openDialog("Not found", `Material code "${codeTrim}" is not in this order.`, "danger");
      setCode("");
      return;
    }

    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[idx];
      const req = Number(row.requiredQty) || 0;

      if (isOrderIssuedComplete) {
        // Packing stage
        const curPacked = Number(row.packedQty) || 0;
        if (curPacked >= req) {
          openDialog("Already complete", "This material is already fully packed.", "danger");
          setCode("");
          return prev;
        }
        const nextPacked = curPacked + 1;
        clone[idx] = { ...row, packedQty: nextPacked };
      } else {
        // Issue stage
        const curIssued = Number(row.issuedQty) || 0;
        if (curIssued >= req) {
          openDialog("Already complete", "This material is already fully issued.", "danger");
          setCode("");
          return prev;
        }
        const nextIssued = curIssued + 1;
        clone[idx] = { ...row, issuedQty: nextIssued };
      }

      persist(clone);
      return clone;
    });

    setCode("");
  };

  const onSubmit = () => incrementForCode(code);

  // Scanner
  const openScanner = async () => {
    if (!permission || !permission.granted) {
      const { granted } = await requestPermission();
      if (!granted) {
        openDialog("Permission needed", "Camera access is required to scan codes.", "danger");
        return;
      }
    }
    setScanLock(false);
    setCameraOpen(true);
  };

  const closeScanner = () => {
    setCameraOpen(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const onBarcodeScanned = (result: BarcodeScanningResult) => {
    if (scanLock) return;
    const data = result?.data ?? "";
    if (!data) return;
    setScanLock(true);
    setCode(data);
    incrementForCode(data);
    setTimeout(() => {
      setCameraOpen(false);
      setScanLock(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 250);
  };

  const validateNumberInput = (raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    if (digits === "" || isNaN(Number(digits))) {
      return { isValid: false, value: 0 };
    }
    return { isValid: true, value: Number(digits) };
  };

  const setIssuedQtyAt = (index: number, raw: string) => {
    const { isValid, value } = validateNumberInput(raw);
    
    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[index];
      const req = Number(row.requiredQty) || 0;
      let val = value;

      if (!isValid) {
        if (raw.trim() !== "") {
          openDialog("Invalid Input", "Please enter a valid issue number.", "danger");
        }
        val = raw.trim() === "" ? 0 : prev[index].issuedQty ?? 0;
      } else {
        if (val > req) {
          openDialog(
            "Invalid Quantity", 
            `Issue quantity cannot exceed required quantity (${req}).`
          );
          val = req;
        }
        if (val < 0) val = 0;
      }
      
      clone[index] = { ...row, issuedQty: val };
      persist(clone);
      return clone;
    });
  };

  const setPackedQtyAt = (index: number, raw: string) => {
    const { isValid, value } = validateNumberInput(raw);
    
    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[index];
      const req = Number(row.requiredQty) || 0;
      let val = value;
      
      if (!isValid) {
        if (raw.trim() !== "") {
          openDialog("Invalid Input", "Please enter a valid pack number.", "danger");
        }
        val = raw.trim() === "" ? 0 : prev[index].packedQty ?? 0;
      } else {
        if (val > req) {
          openDialog(
            "Invalid Quantity", 
            `Packed quantity cannot exceed required quantity (${req}).`
          );
          val = req;
        }
        if (val < 0) val = 0;
      }
      
      clone[index] = { ...row, packedQty: val };
      persist(clone);
      return clone;
    });
  };

  // ----- Loading -----
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

  // ===== Main render =====
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <View style={styles.content}>
        {/* Fixed header */}
        <View style={styles.fixedWrapper}>
          {/* Summary cards */}
          <View style={styles.chipsRow}>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>Completed Items</Text>
              <Text style={styles.chipValue}>
                {completedItems}/{totalItems}
              </Text>
            </View>
            <View style={styles.chip}>
              <Text style={styles.chipTitle}>{isOrderIssuedComplete ? "Packed" : "Issued"}</Text>
              <Text style={styles.chipValue}>
                {isOrderIssuedComplete ? totalPacked : totalIssued}/{totalRequired}
              </Text>
            </View>
          </View>

          {/* Input + scan + submit */}
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
              <Pressable
                onPress={openScanner}
                style={styles.inputIconBtn}
                accessibilityLabel="Open scanner"
                hitSlop={10}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={20}  />
              </Pressable>
            </View>

            <Pressable style={styles.primaryBtn} onPress={onSubmit}>
              <Text style={styles.primaryBtnText}>Submit</Text>
            </Pressable>
          </View>

          {/* Fixed Table head */}
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
              {isOrderIssuedComplete && (
                <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                  <Text style={styles.headText}>Packing</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Scrollable body */}
        <FlatList
          data={materials}
          keyExtractor={(item, index) => `${item.materialCode}-${index}`}
          contentContainerStyle={styles.bodyListContent}
          style={styles.list}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.select({ ios: "on-drag", android: "on-drag" })}
          showsVerticalScrollIndicator
          automaticallyAdjustContentInsets={false}
          contentInsetAdjustmentBehavior="never"
          removeClippedSubviews
          initialNumToRender={20}
          maxToRenderPerBatch={20}
          windowSize={11}
          renderItem={({ item, index }) => {
            const req = Number(item.requiredQty ?? 0);
            const isIssued = Number(item.issuedQty ?? 0) >= req;
            const isPacked = Number(item.packedQty ?? 0) >= req;
            const rowBg = isPacked ? C.greenBg : (isIssued ? C.yellowBg : undefined);
            const issuedColor = isPacked ? C.greenText : (isIssued ? C.yellowText : C.headerText);
            const pillIssued = isIssued && req > 0;
            const pillPacked = isPacked && req > 0;
            const truncatedDesc = item.description
              ? String(item.description).length > 30
                ? String(item.description).substring(0, 30) + "..."
                : String(item.description)
              : "";
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
                        binNo: item.binNo as any,
                        adf: String(item.adf ?? ""),
                        requiredQty: req,
                        issuedQty: Number(item.issuedQty ?? 0),
                        packedQty: Number(item.packedQty ?? 0),
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
                      style={[styles.metricText, (isIssued || isPacked) && { color: issuedColor }]}
                      numberOfLines={1}
                    >
                      {truncatedDesc}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex12, styles.right]}>
                    <Text style={[(isIssued || isPacked) && { color: issuedColor, fontWeight: "700" }]}>
                      {item.requiredQty}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                    <TextInput
                      value={String(item.issuedQty ?? 0)}
                      onChangeText={(t) => setIssuedQtyAt(index, t)}
                      keyboardType="number-pad"
                      inputMode="numeric"
                      maxLength={3}
                      style={[styles.issueInput, pillIssued && { borderColor: C.greenText + "66" }]}
                    />
                  </View>

                  {isOrderIssuedComplete && (
                    <View style={[styles.cell, styles.flex14, styles.centerAlign]}>
                      <TextInput
                        value={String(item.packedQty ?? 0)}
                        onChangeText={(t) => setPackedQtyAt(index, t)}
                        keyboardType="number-pad"
                        inputMode="numeric"
                        maxLength={3}
                        style={[styles.issueInput, pillPacked && { borderColor: C.greenText + "66" }]}
                      />
                    </View>
                  )}
                </Pressable>
              </View>
            );
          }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.subText}>No materials found.</Text>
            </View>
          }
          ListFooterComponent={<View style={{ height: 20 }} />}
        />

        {/* Full-screen Scanner */}
        <Modal
          visible={cameraOpen}
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
                barcodeTypes: ["qr", "pdf417", "code128", "code39", "code93", "codabar", "ean13", "ean8", "upc_a", "upc_e", "itf"],
              }}
              onBarcodeScanned={scanLock ? undefined : onBarcodeScanned}
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

        {/* Row "View" Modal */}
        <Modal
          visible={descModal.visible}
          transparent
          animationType="fade"
          onRequestClose={() => setDescModal({ visible: false })}
        >
          <View style={styles.descOverlay}>
            <View style={styles.descCard}>
              <View style={styles.descHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                  <Ionicons name="cube-outline" size={18} color={C.headerText} />
                  <Text style={styles.descTitle}>{descModal.data?.materialCode ?? "Material"}</Text>
                </View>
                <Pressable onPress={() => setDescModal({ visible: false })}>
                  <Ionicons name="close" size={22} color={C.headerText} />
                </Pressable>
              </View>

              <View style={styles.descBody}>
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Description</Text>
                  <Text style={styles.infoValue}>{descModal.data?.description ?? "-"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Batch No</Text>
                  <Text style={styles.infoValue}>{descModal.data?.batchNo ?? "-"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>SO Donor Batch</Text>
                  <Text style={styles.infoValue}>{descModal.data?.soDonorBatch ?? "-"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Cert No</Text>
                  <Text style={styles.infoValue}>{descModal.data?.certNo ?? "-"}</Text>
                </View>

                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>A/D/F</Text>
                  <Text style={styles.infoValue}>{descModal.data?.adf ?? "-"}</Text>
                </View>

                <View style={styles.infoGrid}>
                  <View style={styles.infoCardSmall}>
                    <Text style={styles.infoSmallLabel}>Bin No</Text>
                    <Text style={styles.infoSmallValue}>{String(descModal.data?.binNo ?? "-")}</Text>
                  </View>
                  <View style={styles.infoCardSmall}>
                    <Text style={styles.infoSmallLabel}>Required Qty</Text>
                    <Text style={styles.infoSmallValue}>{String(descModal.data?.requiredQty ?? 0)}</Text>
                  </View>
                  <View style={styles.infoCardSmall}>
                    <Text style={styles.infoSmallLabel}>Issued Qty</Text>
                    <Text style={styles.infoSmallValue}>{String(descModal.data?.issuedQty ?? 0)}</Text>
                  </View>
                  <View style={styles.infoCardSmall}>
                    <Text style={styles.infoSmallLabel}>Packed Qty</Text>
                    <Text style={styles.infoSmallValue}>{String(descModal.data?.packedQty ?? 0)}</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </Modal>

        {/* Global App Dialog */}
        <Modal visible={dialog.visible} transparent animationType="fade" onRequestClose={closeDialog}>
          <View style={styles.appDialogOverlay}>
            <View style={styles.appDialogCard}>
              <View style={styles.appDialogHeader}>
                <Ionicons
                  name={dialog.emphasis === "danger" ? "alert-circle" : "information-circle"}
                  size={20}
                  color={dialog.emphasis === "danger" ? C.danger : C.headerText}
                />
                <Text
                  style={[styles.appDialogTitle, dialog.emphasis === "danger" && { color: C.danger }]}
                  numberOfLines={2}
                >
                  {dialog.title}
                </Text>
              </View>
              {dialog.message ? <Text style={styles.appDialogMessage}>{dialog.message}</Text> : null}
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.pageBg },
  content: { flex: 1 },
  fixedWrapper: {
    paddingHorizontal: 10,
    paddingTop: 8,
  },
  list: { flex: 1 },
  bodyListContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    rowGap: 10,
  },

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

  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
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

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
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
  emptyWrap: { padding: 16, alignItems: "center" },
  subText: { color: C.subText, fontSize: 12 },
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

  // Full-screen camera
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

  // Row View Modal
  descOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  descCard: {
    width: "100%",
    maxWidth: 560,
    backgroundColor: C.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: C.border,
    overflow: "hidden",
  },
  descHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  descTitle: { flex: 1, fontSize: 16, fontWeight: "800", color: C.headerText },
  descBody: { padding: 16, gap: 12 },

  infoRow: { gap: 6 },
  infoLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: C.subText,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: { fontSize: 14, color: C.headerText, lineHeight: 20 },

  infoGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  infoCardSmall: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#FAFAFA",
    marginBottom: 10,
  },
  infoSmallLabel: { fontSize: 11, color: C.subText, fontWeight: "700" },
  infoSmallValue: { fontSize: 16, color: C.headerText, fontWeight: "800", marginTop: 2 },

  // App Dialog
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
    padding: 16,
  },
  appDialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  appDialogTitle: { fontSize: 16, fontWeight: "800", color: C.headerText, flex: 1 },
  appDialogMessage: { color: C.headerText, lineHeight: 20, marginBottom: 12 },
  appDialogFooter: { alignItems: "flex-end" },
  appDialogBtn: {
    backgroundColor: C.primaryBtn,
    paddingHorizontal: 16,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  appDialogBtnText: { color: C.primaryBtnText, fontWeight: "700" },
});

export default OrderDetailsScreen;
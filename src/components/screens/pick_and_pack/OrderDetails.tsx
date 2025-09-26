// src/screens/OrderDetailsScreen.tsx
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
import { RouteProp } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
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
  SalesOrder_Screen: undefined;
  OrderDetails: { saleOrderNumber: string };
  MaterialFG: undefined;
  MaterialDispatch: undefined;
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
  greenText: "#166534",
  primaryBtn: "#111827",
  primaryBtnText: "#FFFFFF",
  icon: "#111827",
  danger: "#B91C1C",
};

type MaterialRow = StoredMaterialItem & { issuedQty: number };

const OrderDetailsScreen: React.FC<Props> = ({ route }) => {
  const { saleOrderNumber } = route.params;

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
    materialCode?: string;
    description?: string;
    binNo?: string | number;
    requiredQty?: number;
    issuedQty?: number;
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

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        const data = await getOrderDetails(saleOrderNumber);
        if (data && Array.isArray(data.orderDetails)) {
          const withIssued: MaterialRow[] = (data.orderDetails as any[]).map((m: any) => ({
            ...m,
            issuedQty: typeof m.issuedQty === "number" ? m.issuedQty : 0,
          }));
          withIssued.sort((a, b) =>
            String(a.materialCode ?? "").localeCompare(String(b.materialCode ?? ""), undefined, {
              numeric: true,
              sensitivity: "base",
            })
          );
          setMaterials(withIssued);
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

  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidHide", () => {
      inputRef.current?.focus();
    });
    return () => sub.remove();
  }, []);

  const { totalItems, completedItems, totalRequired, totalIssued } = useMemo(() => {
    const ti = materials.length;
    const ci = materials.filter((m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0)).length;
    const tr = materials.reduce((s, m) => s + (Number(m.requiredQty) || 0), 0);
    const tiq = materials.reduce((s, m) => s + (Number(m.issuedQty) || 0), 0);
    return { totalItems: ti, completedItems: ci, totalRequired: tr, totalIssued: tiq };
  }, [materials]);

  const persist = (rows: MaterialRow[]) => {
    saveOrderDetails(saleOrderNumber, rows as unknown as StoredMaterialItem[]);
  };

  const incrementIssueForCode = (materialCodeInput: string) => {
    const codeTrim = materialCodeInput.trim();
    if (!codeTrim) {
      openDialog("Please scan or type a material code.", "", "danger");
      return;
    }

    const idx = materials.findIndex(
      (m) => String(m.materialCode).toLowerCase() === codeTrim.toLowerCase()
    );

    if (idx === -1) {
      openDialog("Not found", `Material code "${codeTrim}" is not in this order.`, "danger");
      return;
    }

    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[idx];
      const req = Number(row.requiredQty) || 0;
      const cur = Number(row.issuedQty) || 0;

      if (cur >= req) {
        openDialog("Already complete", "This material is already fully issued.", "danger");
        return prev;
      }

      const nextIssued = cur + 1;
      clone[idx] = { ...row, issuedQty: nextIssued };
      persist(clone);
      return clone;
    });

    setCode("");
  };

  const onSubmit = () => incrementIssueForCode(code);

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
    incrementIssueForCode(data);
    setTimeout(() => {
      setCameraOpen(false);
      setScanLock(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }, 250);
  };

  const setIssuedQtyAt = (index: number, raw: string) => {
    const digits = raw.replace(/[^\d]/g, "");
    const next = digits === "" ? "0" : digits;
    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[index];
      const req = Number(row.requiredQty) || 0;
      let val = Number(next);
      if (val > req) {
        openDialog("Please enter a valid issue number.", "", "danger");
        val = req;
      }
      if (val < 0) val = 0;
      clone[index] = { ...row, issuedQty: val };
      return clone;
    });
  };

  const saveOnEndEditing = () => persist(materials);

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

  // ===== Main render: one FlatList controls the entire page (header + rows) =====
  return (
    <SafeAreaView style={styles.screen} edges={["left", "right", "bottom"]}>
      <FlatList
        data={materials}
        keyExtractor={(item, index) => `${item.materialCode}-${index}`}
        contentContainerStyle={styles.listContent}
        style={styles.list}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        // Make scrolling solid & predictable:
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.select({ ios: "on-drag", android: "on-drag" })}
        showsVerticalScrollIndicator
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        removeClippedSubviews
        initialNumToRender={20}
        maxToRenderPerBatch={20}
        windowSize={11}
        ListHeaderComponent={
          <View>
            {/* Summary cards */}
            <View style={styles.chipsRow}>
              <View style={styles.chip}>
                <Text style={styles.chipTitle}>Total Issues</Text>
                <Text style={styles.chipValue}>
                  {completedItems}/{totalItems}
                </Text>
              </View>
              <View style={styles.chip}>
                <Text style={styles.chipTitle}>Required vs Issued</Text>
                <Text style={styles.chipValue}>
                  {totalIssued}/{totalRequired}
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
                  <Ionicons name="scan-outline" size={22} color={C.icon} />
                </Pressable>
              </View>

              <Pressable style={styles.primaryBtn} onPress={onSubmit}>
                <Text style={styles.primaryBtnText}>Submit</Text>
              </Pressable>
            </View>

            {/* Table head */}
            <View style={styles.card}>
              <View style={styles.tableHead}>
                <View  style={[styles.cell, styles.flex18, styles.left]}>
                  <Text style={styles.headText}>Material Code</Text>
                </View>
                <View style={[styles.cell, styles.flex40, styles.left]}>
                  <Text style={styles.headText}>Description</Text>
                </View>
                <View style={[styles.cell, styles.flex16, styles.centerAlign]}>
                  <Text style={styles.headText}>Bin No</Text>
                </View>
                <View style={[styles.cell, styles.flex12, styles.right]}>
                  <Text style={styles.headText}>Qty</Text>
                </View>
                <View style={[styles.cell, styles.flex10, styles.centerAlign]}>
                  <Text style={styles.headText}>Issue</Text>
                </View>
              </View>
            </View>
          </View>
        }
        renderItem={({ item, index }) => {
          const isDone = Number(item.issuedQty || 0) >= Number(item.requiredQty || 0);
          const pillDone = isDone && (item.requiredQty ?? 0) > 0;
          return (
            <View style={styles.card}>
              <Pressable
                onPress={() =>
                  setDescModal({
                    visible: true,
                    materialCode: String(item.materialCode ?? ""),
                    description: String(item.description ?? ""),
                    binNo: item.binNo as any,
                    requiredQty: Number(item.requiredQty ?? 0),
                    issuedQty: Number(item.issuedQty ?? 0),
                  })
                }
                style={[styles.row, isDone && { backgroundColor: C.greenBg }]}
              >
                <View style={[styles.cell, styles.flex18, styles.left]}>
                  <Text
                    style={[
                      styles.metricText,
                      isDone && { color: C.greenText, fontWeight: "700" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.materialCode}
                  </Text>
                </View>

                <View style={[styles.cell, styles.flex40, styles.left]}>
                  <Text
                    style={[styles.metricText, isDone && { color: C.greenText }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {item.description}
                  </Text>
                </View>

                <View style={[styles.cell, styles.flex16, styles.centerAlign]}>
                  <Text style={[styles.metricText, isDone && { color: C.greenText }]} numberOfLines={1}>
                    {item.binNo}
                  </Text>
                </View>

                <View style={[styles.cell, styles.flex12, styles.right]}>
                  <Text style={[styles.metricText, isDone && { color: C.greenText, fontWeight: "700" }]}>
                    {item.requiredQty}
                  </Text>
                </View>

                <View style={[styles.cell, styles.flex10, styles.centerAlign]}>
                  <TextInput
                    value={String(item.issuedQty ?? 0)}
                    onChangeText={(t) => setIssuedQtyAt(index, t)}
                    keyboardType="number-pad"
                    inputMode="numeric"
                    maxLength={3}
                    style={[styles.issueInput, pillDone && { borderColor: C.greenText + "66" }]}
                    onEndEditing={saveOnEndEditing}
                  />
                </View>
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
              barcodeTypes: ["qr", "code128", "ean13", "ean8", "upc_a", "upc_e"],
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

      {/* Row “View” Modal */}
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
                <Text style={styles.descTitle}>{descModal.materialCode ?? "Material"}</Text>
              </View>
              <Pressable onPress={() => setDescModal({ visible: false })}>
                <Ionicons name="close" size={22} color={C.headerText} />
              </Pressable>
            </View>

            <View style={styles.descBody}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Description</Text>
                <Text style={styles.infoValue}>{descModal.description ?? "-"}</Text>
              </View>

              <View style={styles.infoGrid}>
                <View style={styles.infoCardSmall}>
                  <Text style={styles.infoSmallLabel}>Bin No</Text>
                  <Text style={styles.infoSmallValue}>{String(descModal.binNo ?? "-")}</Text>
                </View>
                <View style={styles.infoCardSmall}>
                  <Text style={styles.infoSmallLabel}>Required Qty</Text>
                  <Text style={styles.infoSmallValue}>{String(descModal.requiredQty ?? 0)}</Text>
                </View>
                <View style={styles.infoCardSmall}>
                  <Text style={styles.infoSmallLabel}>Issued Qty</Text>
                  <Text style={styles.infoSmallValue}>{String(descModal.issuedQty ?? 0)}</Text>
                </View>
              </View>

              <View style={styles.progressWrap}>
                <View style={styles.progressBarTrack}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${
                          Math.min(
                            100,
                            Math.round(
                              ((Number(descModal.issuedQty ?? 0) /
                                Math.max(1, Number(descModal.requiredQty ?? 0))) *
                                100)
                            )
                          )
                        }%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.progressText}>
                  {Number(descModal.issuedQty ?? 0)} / {Number(descModal.requiredQty ?? 0)} issued
                </Text>
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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.pageBg },
  list: { flex: 1 },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 20,
    paddingTop: 8, // small, consistent padding (no big top gap)
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
  headText: { color: C.subText, fontWeight: "600" },

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

  flex18: { flex: 1.8 },
  flex40: { flex: 4 },
  flex16: { flex: 1.6 },
  flex12: { flex: 1.2 },
  flex10: { flex: 1 },

  metricText: { fontSize: 14, fontWeight: "500", color: C.headerText },
  sep: { height: 1, backgroundColor: C.border },
  emptyWrap: { padding: 16, alignItems: "center" },
  subText: { color: C.subText, fontSize: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { color: C.subText },

  issueInput: {
    minWidth: 44,
    height: 30,
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

  infoGrid: { flexDirection: "row", gap: 10 },
  infoCardSmall: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#FAFAFA",
  },
  infoSmallLabel: { fontSize: 11, color: C.subText, fontWeight: "700" },
  infoSmallValue: { fontSize: 16, color: C.headerText, fontWeight: "800", marginTop: 2 },

  progressWrap: { gap: 8, marginTop: 4 },
  progressBarTrack: {
    height: 8,
    backgroundColor: "#EFEFEF",
    borderRadius: 999,
    overflow: "hidden",
  },
  progressBarFill: {
    height: 8,
    backgroundColor: C.greenText,
    borderRadius: 999,
  },
  progressText: { fontSize: 12, color: C.subText, textAlign: "right" },

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

// src/screens/SalesOrdersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import SalesOrdersStyledTable from "./SalesOrder_table";
import {
  fetchOrdersSummary,
  downloadOrderDetails,
  uploadIssueData,
  type OrdersSummaryItem,
} from "../../Api/SalesOrder_server";
import {
  hasOrderDetails,
  getOrderDetails,
  deleteOrderDetails,
  type StoredMaterialItem,
} from "../../Storage/sale_order_storage";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  SalesOrders: undefined;
  OrderDetails: { saleOrderNumber: string };
  Upload: { saleOrderNumber: string };
  MaterialFG: undefined;
  MaterialDispatch: undefined;
};

type Phase = "issue" | "packing";

const SalesOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [list, setList] = useState<OrdersSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // State maps
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [issueCompletedMap, setIssueCompletedMap] = useState<Record<string, boolean>>({});
  const [packCompletedMap, setPackCompletedMap] = useState<Record<string, boolean>>({});
  const [phaseMap, setPhaseMap] = useState<Record<string, Phase>>({});

  // Success/info modal state
  const [modal, setModal] = useState<{
    visible: boolean;
    title: string;
    message: string;
    type: "success" | "info";
  }>({ visible: false, title: "", message: "", type: "info" });

  const showModal = (opts: { title: string; message: string; type?: "success" | "info" }) =>
    setModal({ visible: true, title: opts.title, message: opts.message, type: opts.type ?? "info" });
  const closeModal = () => setModal((m) => ({ ...m, visible: false }));

  const computeIssueCompletion = (items: StoredMaterialItem[] | undefined) => {
    if (!items || items.length === 0) return false;
    return items.every((it) => (it.issuedQty ?? 0) >= (it.requiredQty ?? 0));
  };

  const computePackCompletion = (items: StoredMaterialItem[] | undefined) => {
    if (!items || items.length === 0) return false;
    return items.every((it) => (it.packedQty ?? 0) >= (it.requiredQty ?? 0));
  };

  const refreshMaps = useCallback(async (orders: OrdersSummaryItem[]) => {
    const dMap: Record<string, boolean> = {};
    const iMap: Record<string, boolean> = {};
    const pMap: Record<string, boolean> = {};

    await Promise.all(
      orders.map(async (o) => {
        const so = o.saleOrderNumber;
        const has = await hasOrderDetails(so);
        dMap[so] = !!has;

        if (has) {
          try {
            const stored = await getOrderDetails(so);
            iMap[so] = computeIssueCompletion(stored?.orderDetails);
            pMap[so] = computePackCompletion(stored?.orderDetails);
          } catch {
            iMap[so] = false;
            pMap[so] = false;
          }
        } else {
          iMap[so] = false;
          pMap[so] = false;
        }
      })
    );

    setDownloadedMap(dMap);
    setIssueCompletedMap(iMap);
    setPackCompletedMap(pMap);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await fetchOrdersSummary();
      setList(orders);
      setPhaseMap(
        orders.reduce(
          (acc, o) => ({ ...acc, [o.saleOrderNumber]: "issue" }),
          {} as Record<string, Phase>
        )
      );
      await refreshMaps(orders);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
    }
  }, [refreshMaps]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const orders = await fetchOrdersSummary();
      setList(orders);
      setPhaseMap(
        orders.reduce(
          (acc, o) => ({ ...acc, [o.saleOrderNumber]: "issue" }),
          {} as Record<string, Phase>
        )
      );
      await refreshMaps(orders);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [refreshMaps]);

  useEffect(() => {
    load();
  }, [load]);

  // Actions
  const handleDownload = useCallback(
    async (o: OrdersSummaryItem) => {
      try {
        await downloadOrderDetails(o.saleOrderNumber);
        await refreshMaps(list);
        // Show attractive modal instead of Alert
        showModal({
          title: "Download Complete",
          message: `Order ${o.saleOrderNumber} details have been downloaded successfully.`,
          type: "success",
        });
      } catch (e: any) {
        Alert.alert("Download failed", e?.message ?? "Try again.");
      }
    },
    [list, refreshMaps]
  );

  const handleView = useCallback(
    (o: OrdersSummaryItem) => {
      navigation.navigate("OrderDetails", { saleOrderNumber: o.saleOrderNumber });
    },
    [navigation]
  );

  const handleDocument = useCallback(
    (o: OrdersSummaryItem) => {
      navigation.navigate("Upload", { saleOrderNumber: o.saleOrderNumber });
    },
    [navigation]
  );

  const handleUpload = useCallback(
    async (o: OrdersSummaryItem) => {
      const so = o.saleOrderNumber;
      setUploading(so);
      try {
        const stored = await getOrderDetails(so);
        if (!stored || !stored.orderDetails || stored.orderDetails.length === 0) {
          throw new Error("No order details found. Please download first.");
        }

        await uploadIssueData(so, stored.orderDetails);

        const packComplete = computePackCompletion(stored?.orderDetails);
        await deleteOrderDetails(so);

        const currentPhase = phaseMap[so] || "issue";
        let newList = list;
        if (packComplete) {
          newList = list.filter((order) => order.saleOrderNumber !== so);
          setPhaseMap((prev) => {
            const newP = { ...prev };
            delete newP[so];
            return newP;
          });
        } else {
          setPhaseMap((prev) => ({ ...prev, [so]: "packing" }));
        }
        setList(newList);
        await refreshMaps(newList);

        // Replace success Alert with a polished modal
        const msg = packComplete
          ? "Order fully completed and uploaded."
          : "Issue data uploaded. Download again to proceed with packing.";
        showModal({
          title: packComplete ? "Upload Complete" : "Issue Data Uploaded",
          message: msg,
          type: "success",
        });
      } catch (e: any) {
        Alert.alert("Upload failed", e?.message ?? "Try again.");
      } finally {
        setUploading(null);
      }
    },
    [list, phaseMap, refreshMaps]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["left", "right", "bottom"]}>
      <View style={styles.container}>
        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" />
            <Text style={styles.loadingText}>Loading orders…</Text>
          </View>
        ) : (
          <SalesOrdersStyledTable
            data={list}
            refreshing={refreshing}
            onRefresh={onRefresh}
            onRowPress={() => {}}
            onDownload={handleDownload}
            onView={handleView}
            onUpload={handleUpload}
            onDocument={handleDocument}
            downloadedMap={downloadedMap}
            issueCompletedMap={issueCompletedMap}
            packCompletedMap={packCompletedMap}
            phaseMap={phaseMap}
            uploading={uploading}
          />
        )}
      </View>

      {/* Attractive, reusable success/info modal */}
      <Modal
        visible={modal.visible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconWrap}>
              <View
                style={[
                  styles.modalIconCircle,
                  modal.type === "success" ? styles.successBg : styles.infoBg,
                ]}
              >
                <Ionicons
                  name={modal.type === "success" ? "checkmark-done" : "information-circle"}
                  size={28}
                  color="#FFFFFF"
                />
              </View>
            </View>

            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMessage}>{modal.message}</Text>

            <TouchableOpacity onPress={closeModal} style={styles.modalPrimaryBtn}>
              <Text style={styles.modalPrimaryBtnText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

export default SalesOrdersScreen;

const C = {
  bg: "#FFFFFF",
  text: "#0B1220",
  sub: "#6B7280",
  border: "#E5E7EB",
  success: "#16A34A",
  info: "#2151F5",
  overlay: "rgba(0,0,0,0.35)",
  btn: "#111827",
  btnText: "#FFFFFF",
};

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  title: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { marginTop: 8, color: C.sub },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: C.overlay,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: C.bg,
    borderRadius: 16,
    padding: 20,
    paddingTop: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  modalIconWrap: { marginBottom: 12 },
  modalIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  successBg: { backgroundColor: C.success },
  infoBg: { backgroundColor: C.info },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: C.text,
    textAlign: "center",
    marginTop: 6,
  },
  modalMessage: {
    fontSize: 14,
    color: C.sub,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
  modalPrimaryBtn: {
    marginTop: 16,
    width: "100%",
    backgroundColor: C.info,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalPrimaryBtnText: { color: C.btnText, fontWeight: "700", fontSize: 16 },
});

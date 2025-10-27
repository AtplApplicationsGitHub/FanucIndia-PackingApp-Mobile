import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  StyleSheet,
  Modal,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import SalesOrdersStyledTable from "./SalesOrder_table";
import { fetchOrdersSummary, downloadOrderDetails, uploadIssueData, type OrdersSummaryItem } from "../../Api/SalesOrder_server";
import { hasOrderDetails, getOrderDetails, deleteOrderDetails, type StoredMaterialItem } from "../../Storage/sale_order_storage";

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
    type: "success" | "info" | "delete";
    onConfirmDelete?: () => void;
  }>({ visible: false, title: "", message: "", type: "info" });

  const showModal = (opts: { 
    title: string; 
    message: string; 
    type?: "success" | "info" | "delete";
    onConfirmDelete?: () => void;
  }) =>
    setModal({ 
      visible: true, 
      title: opts.title, 
      message: opts.message, 
      type: opts.type ?? "info",
      onConfirmDelete: opts.onConfirmDelete,
    });
  const closeModal = () => setModal((m) => ({ ...m, visible: false, onConfirmDelete: undefined }));

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
      setPhaseMap((prev) =>
        orders.reduce(
          (acc, o) => ({
            ...acc,
            [o.saleOrderNumber]: acc[o.saleOrderNumber] || "issue",
          }),
          prev
        )
      );
      await refreshMaps(orders);
    } catch (e: any) {
      showModal({
        title: "Error",
        message: e?.message ?? "Failed to load orders",
        type: "info",
      });
    } finally {
      setLoading(false);
    }
  }, [refreshMaps]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const orders = await fetchOrdersSummary();
      setList(orders);
      setPhaseMap((prev) =>
        orders.reduce(
          (acc, o) => ({
            ...acc,
            [o.saleOrderNumber]: acc[o.saleOrderNumber] || "issue",
          }),
          prev
        )
      );
      await refreshMaps(orders);
    } catch (e: any) {
      showModal({
        title: "Error",
        message: e?.message ?? "Refresh failed",
        type: "info",
      });
    } finally {
      setRefreshing(false);
    }
  }, [refreshMaps]);

  useEffect(() => {
    load();
  }, [load]);

  const handleDownload = useCallback(
    async (o: OrdersSummaryItem) => {
      try {
        await downloadOrderDetails(o.saleOrderNumber);
        await refreshMaps(list);
        showModal({
          title: "Download Complete",
          message: `Sales Order ${o.saleOrderNumber} details have been successfully downloaded.`,
          type: "success",
        });
      } catch (e: any) {
        showModal({
          title: "Download Failed",
          message: e?.message ?? "Please try again.",
          type: "info",
        });
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
      if (uploading) return; // Prevent multiple uploads
      setUploading(so);
      try {
        const stored = await getOrderDetails(so);
        if (!stored || !stored.orderDetails || stored.orderDetails.length === 0) {
          throw new Error("No order details found. Please download first.");
        }

        await uploadIssueData(so, stored.orderDetails);
        await deleteOrderDetails(so); // Clear local storage

        const packComplete = computePackCompletion(stored?.orderDetails);
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
        await onRefresh(); // Trigger page refresh

        const msg = packComplete
          ? ""
          : "";
        showModal({
          title: packComplete ? "Data Uploaded successfully" : "Data Uploaded successfully",
          message: msg,
          type: "success",
        });
      } catch (e: any) {
        showModal({
          title: "Upload Failed",
          message: e?.message ?? "Try again.",
          type: "info",
        });
      } finally {
        setUploading(null);
      }
    },
    [list, refreshMaps, onRefresh, uploading]
  );

  const handleDelete = useCallback(
    (o: OrdersSummaryItem) => {
      showModal({
        title: "Confirm Delete",
        message: "Are you sure you want to delete?",
        type: "delete",
        onConfirmDelete: async () => {
          try {
            await deleteOrderDetails(o.saleOrderNumber);
            await refreshMaps(list);
            showModal({
              title: "Delete Complete",
              message: `Local data for Sales Order ${o.saleOrderNumber} has been deleted.`,
              type: "success",
            });
          } catch (e: any) {
            showModal({
              title: "Delete Failed",
              message: e?.message ?? "Please try again.",
              type: "info",
            });
          }
        },
      });
    },
    [list, refreshMaps]
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
            onDelete={handleDelete}
            downloadedMap={downloadedMap}
            issueCompletedMap={issueCompletedMap}
            packCompletedMap={packCompletedMap}
            phaseMap={phaseMap}
            uploading={uploading}
          />
        )}
      </View>

      <Modal
        visible={modal.visible}
        animationType="fade"
        transparent
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{modal.title}</Text>
            <Text style={styles.modalMessage}>{modal.message}</Text>

            {modal.type === "delete" ? (
              <View style={styles.modalButtonRow}>
                <TouchableOpacity
                  onPress={closeModal}
                  style={[styles.modalButton, styles.modalSecondaryBtn]}
                >
                  <Text style={styles.modalSecondaryBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => {
                    modal.onConfirmDelete?.();
                    closeModal();
                  }}
                  style={[styles.modalButton, styles.modalDeleteBtn]}
                >
                  <Text style={styles.modalPrimaryBtnText}>Delete</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={closeModal} style={styles.modalPrimaryBtn}>
                <Text style={styles.modalPrimaryBtnText}>OK</Text>
              </TouchableOpacity>
            )}
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
  delete: "#DC2626",
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
  modalPrimaryBtnText: {
    color: C.btnText,
    fontWeight: "700",
    fontSize: 16,
  },
  modalButtonRow: {
    flexDirection: "row",
    marginTop: 16,
    width: "100%",
    justifyContent: "space-between",
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalSecondaryBtn: {
    backgroundColor: C.border,
  },
  modalSecondaryBtnText: {
    color: C.text,
    fontWeight: "700",
    fontSize: 16,
  },
  modalDeleteBtn: {
    backgroundColor: C.delete,
  },
});
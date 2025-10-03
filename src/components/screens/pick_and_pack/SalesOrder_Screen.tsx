// src/screens/SalesOrdersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
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

const SalesOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();

  const [list, setList] = useState<OrdersSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);

  // State maps
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});
  const [uploadedMap, setUploadedMap] = useState<Record<string, boolean>>({});

  const computeCompletion = (items: StoredMaterialItem[] | undefined) => {
    if (!items || items.length === 0) return false;
    return items.every((it) => (it.issuedQty ?? 0) >= (it.requiredQty ?? 0));
  };

  const refreshMaps = useCallback(async (orders: OrdersSummaryItem[]) => {
    const dMap: Record<string, boolean> = {};
    const cMap: Record<string, boolean> = {};
    const uMap: Record<string, boolean> = {};

    await Promise.all(
      orders.map(async (o) => {
        const so = o.saleOrderNumber;
        const has = await hasOrderDetails(so);
        dMap[so] = !!has;

        if (has) {
          try {
            const stored = await getOrderDetails(so);
            cMap[so] = computeCompletion(stored?.orderDetails);
            uMap[so] = (stored as any)?.uploaded ?? false; // keep default false if not present
          } catch {
            cMap[so] = false;
            uMap[so] = false;
          }
        } else {
          cMap[so] = false;
          uMap[so] = false;
        }
      })
    );

    setDownloadedMap(dMap);
    setCompletedMap(cMap);
    setUploadedMap(uMap);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orders = await fetchOrdersSummary();
      setList(orders);
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
        Alert.alert("Downloaded", `Order ${o.saleOrderNumber} details downloaded.`);
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
        await deleteOrderDetails(so);
        const newList = list.filter((order) => order.saleOrderNumber !== so);
        setList(newList);
        await refreshMaps(newList);
        Alert.alert("Uploaded", `Order ${so} data uploaded successfully.`);
      } catch (e: any) {
        Alert.alert("Upload failed", e?.message ?? "Try again.");
      } finally {
        setUploading(null);
      }
    },
    [list, refreshMaps]
  );

  return (
    // Remove TOP safe inset to reduce the gap under the nav header
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
            completedMap={completedMap}
            uploadedMap={uploadedMap}
            uploading={uploading}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default SalesOrdersScreen;

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1 },
  title: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { marginTop: 8, color: "#6B7280" },
});
// src/screens/SalesOrdersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import SalesOrdersStyledTable from "./SalesOrder_table";
import {
  fetchOrdersSummary,
  downloadOrderDetails,
  type OrdersSummaryItem,
} from "../../Api/SalesOrder_server";
import { hasOrderDetails } from "../../Storage/sale_order_storage";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  SalesOrders: undefined;
  OrderDetails: { saleOrderNumber: string };
  MaterialFG: undefined;
  MaterialDispatch: undefined;
};

const SalesOrdersScreen: React.FC = () => {
  const navigation = useNavigation<any>();          

  const [list, setList] = useState<OrdersSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Track which SOs are downloaded (to flip the icon)
  const [downloadedMap, setDownloadedMap] = useState<Record<string, boolean>>({});

  const hydrateDownloadedMap = useCallback(async (orders: OrdersSummaryItem[]) => {
    const next: Record<string, boolean> = {};
    await Promise.all(
      orders.map(async (o) => {
        next[o.saleOrderNumber] = await hasOrderDetails(o.saleOrderNumber);
      })
    );
    setDownloadedMap(next);
  }, []);

  const load = useCallback(async (showSpinner = true) => {
    try {
      showSpinner ? setLoading(true) : setRefreshing(true);
      const data = await fetchOrdersSummary();
      setList(data);
      await hydrateDownloadedMap(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to fetch orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [hydrateDownloadedMap]);

  useEffect(() => {
    load(true);
  }, [load]);

  const onDownload = async (o: OrdersSummaryItem) => {
    try {
      await downloadOrderDetails(o.saleOrderNumber); // saves only the 4 fields
      setDownloadedMap((m) => ({ ...m, [o.saleOrderNumber]: true }));
      Alert.alert("Success", "Download completed.");
    } catch (e: any) {
      Alert.alert("Download failed", e?.message ?? "Could not download details.");
    }
  };

  const onView = (o: OrdersSummaryItem) => {
    navigation.navigate("OrderDetails", { saleOrderNumber: o.saleOrderNumber });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading orders…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <SalesOrdersStyledTable
        data={list}
        refreshing={refreshing}
        onRefresh={() => load(false)}
        onRowPress={(o) => {}}
        onDownload={onDownload}
        onView={onView}
        downloadedMap={downloadedMap}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F8" ,
    paddingTop: 5,
    paddingBottom: 20,
    flexGrow: 1,
     gap: 10 
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 ,
    paddingTop: 5,
    paddingBottom: 20,
    flexGrow: 1,
  
  },
  muted: { color: "#6B7280",paddingTop: 5,
    paddingBottom: 20,
    flexGrow: 1,
     gap: 10 
     },
});

export default SalesOrdersScreen;

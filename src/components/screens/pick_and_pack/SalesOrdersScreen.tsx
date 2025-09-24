// src/screens/SalesOrdersScreen.tsx
import React, { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { SafeAreaView } from "react-native-safe-area-context";
import SalesOrdersStyledTable from "./SalesOrder_table";
import {
  fetchOrdersSummary,
  downloadOrderDetails,
  type OrdersSummaryItem,
} from "../../Api/SalesOrder_server";

const SalesOrdersScreen: React.FC = () => {
  const [list, setList] = useState<OrdersSummaryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [jsonModal, setJsonModal] = useState<{
    visible: boolean;
    content: string;
    title?: string;
  }>({ visible: false, content: "" });

  const load = useCallback(async (showSpinner = true) => {
    try {
      showSpinner ? setLoading(true) : setRefreshing(true);
      const data = await fetchOrdersSummary();
      setList(data);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to fetch orders.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true);
  }, [load]);

  const onDownload = async (o: OrdersSummaryItem) => {
    try {
      const json = await downloadOrderDetails(o.saleOrderNumber);
      const pretty = JSON.stringify(json, null, 2);
      setJsonModal({
        visible: true,
        content: pretty,
        title: `SO #${o.saleOrderNumber} — JSON`,
      });
    } catch (e: any) {
      Alert.alert(
        "Download failed",
        e?.message ?? "Could not download details."
      );
    }
  };

  const copyToClipboard = async () => {
    try {
      await Clipboard.setStringAsync(jsonModal.content);
      Alert.alert("Copied", "JSON copied to clipboard.");
    } catch {
      Alert.alert("Copy failed", "Please try again.");
    }
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
        onDownload={onDownload}
        onRowPress={(o) => {
          Alert.alert("Order", `SO #${o.saleOrderNumber}\nStatus: ${o.status}`);
        }}
      />

      {/* JSON Modal */}
      <Modal
        animationType="slide"
        visible={jsonModal.visible}
        onRequestClose={() =>
          setJsonModal((s) => ({ ...s, visible: false }))
        }
      >
        <SafeAreaView style={styles.modalWrap}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{jsonModal.title ?? "JSON"}</Text>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <Pressable onPress={copyToClipboard} style={styles.actionBtn}>
                <Text style={styles.actionText}>Copy</Text>
              </Pressable>
              <Pressable
                onPress={() =>
                  setJsonModal((s) => ({ ...s, visible: false }))
                }
                style={[styles.actionBtn, styles.secondaryBtn]}
              >
                <Text style={styles.actionText}>Close</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.jsonScroll}>
            <Text style={styles.jsonText}>{jsonModal.content}</Text>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F7F7F8" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  muted: { color: "#6B7280" },

  modalWrap: { flex: 1, backgroundColor: "#FFFFFF" },
  modalHeader: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: "#0B0F19" },
  actionBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: "#111827",
    borderRadius: 10,
  },
  secondaryBtn: { backgroundColor: "#374151" },
  actionText: { color: "white", fontWeight: "700" },
  jsonScroll: { padding: 16 },
  jsonText: {
    fontFamily: Platform.select({ ios: "Menlo", android: "monospace" }),
    fontSize: 13,
    color: "#111827",
  },
});

export default SalesOrdersScreen;

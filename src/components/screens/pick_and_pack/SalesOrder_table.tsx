// src/screens/SalesOrdersStyledTable.tsx
import React from "react";
import { View, Text, StyleSheet, FlatList, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrdersSummaryItem } from "../../Api/SalesOrder_server";

type Props = {
  data?: OrdersSummaryItem[];
  refreshing?: boolean;
  onRefresh?: () => void;
  onRowPress?: (o: OrdersSummaryItem) => void;
  onDownload?: (o: OrdersSummaryItem) => void;
  onView?: (o: OrdersSummaryItem) => void;
  downloadedMap?: Record<string, boolean>;
};

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  icon: "#111827",
};

const Row: React.FC<{
  item: OrdersSummaryItem;
  onPress?: () => void;
  onDownload?: () => void;
  onView?: () => void;
  downloaded?: boolean;
}> = ({ item, onPress, onDownload, onView, downloaded }) => {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <View style={styles.cellSO}>
        <Text style={styles.soText}>{item.saleOrderNumber}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.metricTop}>{item.status}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.metricTop}>{item.priority ?? "-"}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.metricTop}>{item.totalItems}</Text>
      </View>

      <View style={styles.cell}>
        <Text style={styles.metricTop}>{item.totalMaterials}</Text>
      </View>

      <Pressable
        hitSlop={10}
        style={styles.actionCell}
        onPress={downloaded ? onView : onDownload}
      >
        {downloaded ? (
          <Ionicons name="eye-outline" size={22} color={C.icon} />
        ) : (
          <Ionicons name="download-outline" size={22} color={C.icon} />
        )}
      </Pressable>
    </Pressable>
  );
};

const SalesOrdersStyledTable: React.FC<Props> = ({
  data = [],
  refreshing,
  onRefresh,
  onRowPress,
  onDownload,
  onView,
  downloadedMap = {},
}) => {
  return (
    <View style={styles.container}>
      <View style={styles.headerBar}>
        <Text style={styles.headerTitle}>Sales Orders</Text>
      </View>

      <View style={styles.card}>
        <View style={styles.tableHead}>
          <View style={styles.cellSO}>
            <Text style={styles.headText}>SO</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.headTextCenter}>Status</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.headTextCenter}>Priority</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.headTextCenter}>Items</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.headTextCenter}>Material</Text>
          </View>
          <View style={styles.actionCell}>
            <Ionicons name="options-outline" size={18} color="#374151" />
          </View>
        </View>

        <FlatList
          data={data}
          keyExtractor={(it) => it.saleOrderNumber}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ItemSeparatorComponent={() => <View style={styles.sep} />}
          renderItem={({ item }) => (
            <Row
              item={item}
              onPress={() => onRowPress?.(item)}
              onDownload={() => onDownload?.(item)}
              onView={() => onView?.(item)}
              downloaded={!!downloadedMap[item.saleOrderNumber]}
            />
          )}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Text style={styles.subText}>No orders found.</Text>
            </View>
          }
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 10, paddingBottom: 10 },
  headerBar: { marginBottom: 12 },
  headerTitle: { color: C.headerText, fontSize: 20, fontWeight: "700" },
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
  headTextCenter: { color: C.subText, fontWeight: "600", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 12 },
  cellSO: { flex: 2.5, alignItems: "flex-start" },
  cell: { flex: 1.5, alignItems: "center" },
  actionCell: { width: 36, alignItems: "center" },
  soText: { color: C.headerText, fontSize: 16, fontWeight: "600" },
  subText: { color: C.subText, fontSize: 12, marginTop: 2 },
  metricTop: { fontSize: 16, fontWeight: "700", color: C.headerText },
  sep: { height: 1, backgroundColor: C.border },
  emptyWrap: { padding: 16, alignItems: "center" },
});

export default SalesOrdersStyledTable;

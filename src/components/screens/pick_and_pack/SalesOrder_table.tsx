// src/screens/SalesOrder_table.tsx
import React from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { OrdersSummaryItem } from "../../Api/SalesOrder_server";

type Props = {
  data?: OrdersSummaryItem[];
  refreshing?: boolean;
  onRefresh?: () => void;

  // Actions
  onRowPress?: (o: OrdersSummaryItem) => void;
  onDownload?: (o: OrdersSummaryItem) => void;
  onView?: (o: OrdersSummaryItem) => void;
  onUpload?: (o: OrdersSummaryItem) => void;

  // State maps (keyed by saleOrderNumber)
  downloadedMap?: Record<string, boolean>;
  completedMap?: Record<string, boolean>;
  uploadedMap?: Record<string, boolean>;
  
  // Uploading state
  uploading?: string | null;
};

const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  icon: "#111827",
  greenBg: "#E7F8EE",
  greenText: "#067647",
  greenBorder: "#B7E4C7",
  gray: "#6B7280",
  blue: "#3B82F6",
};

const Col = {
  so: 1.2,
  status: 1.2,
  priority: 0.9,
  items: 0.8,
  material: 0.9,
  action: 0.8,
};

const Row: React.FC<{
  item: OrdersSummaryItem;
  onPress?: () => void;
  onDownload?: () => void;
  onView?: () => void;
  onUpload?: () => void;
  downloaded?: boolean;
  completed?: boolean;
  uploaded?: boolean;
  uploading?: boolean;
}> = ({
  item,
  onPress,
  onDownload,
  onView,
  onUpload,
  downloaded = false,
  completed = false,
  uploaded = false,
  uploading = false,
}) => {
  // Decide primary action icon
  let action: "download" | "view" | "upload" | "done" | "uploading";
  if (uploading) {
    action = "uploading";
  } else if (!downloaded) {
    action = "download";
  } else if (downloaded && !completed) {
    action = "view";
  } else if (completed && !uploaded) {
    action = "upload";
  } else {
    action = "done";
  }

  const statusText =
    (item as any)?.status ??
    (completed ? "Completed" : downloaded ? "In progress" : "Not downloaded");

  const priorityText =
    (item as any)?.priority != null ? String((item as any).priority) : "-";

  const totalItems =
    (item as any)?.totalItems != null ? String((item as any).totalItems) : "-";

  const totalMaterials =
    (item as any)?.totalMaterials != null
      ? String((item as any).totalMaterials)
      : "-";

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || uploading}
      style={[
        styles.row,
        completed && { backgroundColor: C.greenBg, borderColor: C.greenBorder },
        uploading && { opacity: 0.7 },
      ]}
    >
      {/* SO */}
      <View style={[styles.cell, { flex: Col.so }]}>
        <Text style={[styles.soText, completed && { color: C.greenText }]}>
          {item.saleOrderNumber}
        </Text>
        {uploading && (
          <Text style={styles.uploadingText}>Uploading...</Text>
        )}
      </View>

      {/* Status */}
      <View style={[styles.cell, { flex: Col.status }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.statusText,
            completed ? { color: C.greenText, fontWeight: "700" } : undefined,
            uploading ? { color: C.blue } : undefined,
          ]}
        >
          {uploading ? "Uploading..." : statusText}
        </Text>
      </View>

      {/* Priority */}
      <View style={[styles.cell, { flex: Col.priority }]}>
        <Text style={styles.metricText}>{priorityText}</Text>
      </View>

      {/* Items */}
      <View style={[styles.cell, { flex: Col.items, alignItems: "center" }]}>
        <Text style={styles.metricText}>{totalItems}</Text>
      </View>

      {/* Material */}
      <View style={[styles.cell, { flex: Col.material, alignItems: "center" }]}>
        <Text style={styles.metricText}>{totalMaterials}</Text>
      </View>

      {/* Action */}
      <View style={[styles.cell, { flex: Col.action, alignItems: "flex-end" }]}>
        {action === "download" && (
          <Pressable
            onPress={onDownload}
            style={styles.iconBtn}
            disabled={uploading}
            accessibilityLabel="Download order details"
          >
            <Ionicons name="download-outline" size={20} color={uploading ? C.gray : C.icon} />
          </Pressable>
        )}

        {action === "view" && (
          <Pressable
            onPress={onView}
            style={styles.iconBtn}
            disabled={uploading}
            accessibilityLabel="View order details"
          >
            <Ionicons name="eye-outline" size={20} color={uploading ? C.gray : C.icon} />
          </Pressable>
        )}

        {action === "upload" && (
          <Pressable
            onPress={onUpload}
            style={[styles.iconBtn, uploading && { backgroundColor: C.blue }]}
            disabled={uploading}
            accessibilityLabel="Upload data"
          >
            <Ionicons 
              name="cloud-upload-outline" 
              size={20} 
              color={uploading ? "#FFFFFF" : C.icon} 
            />
          </Pressable>
        )}

        {action === "uploading" && (
          <View style={[styles.iconBtn, { backgroundColor: C.blue }]}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        )}

        {action === "done" && (
          <View style={[styles.iconBtn, { opacity: 0.6 }]}>
            <Ionicons name="checkmark-done-outline" size={20} color={C.greenText} />
          </View>
        )}
      </View>
    </Pressable>
  );
};

const SalesOrdersStyledTable: React.FC<Props> = ({
  data = [],
  refreshing = false,
  onRefresh,
  onRowPress,
  onDownload,
  onView,
  onUpload,
  downloadedMap = {},
  completedMap = {},
  uploadedMap = {},
  uploading = null,
}) => {
  return (
    <View style={styles.container}>
      {/* Table Header */}
      <View style={styles.tableHeader}>
        <Text style={[styles.thText, { flex: Col.so }]}>SO</Text>
        <Text style={[styles.thText, { flex: Col.status }]}>Status</Text>
        <Text style={[styles.thText, { flex: Col.priority }]}>Priority</Text>
        <Text style={[styles.thText, { flex: Col.items, textAlign: "center" }]}>
          Items
        </Text>
        <Text
          style={[styles.thText, { flex: Col.material, textAlign: "center" }]}
        >
          Material
        </Text>
        <Text style={[styles.thText, { flex: Col.action, textAlign: "right" }]}>
          Action
        </Text>
      </View>

      <FlatList
        data={data}
        keyExtractor={(it) => it.saleOrderNumber}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh ?? undefined} 
            colors={[C.blue]}
            tintColor={C.blue}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => {
          const so = item.saleOrderNumber;
          const downloaded = !!downloadedMap[so];
          const completed = !!completedMap[so];
          const uploaded = !!uploadedMap[so];
          const isUploading = uploading === so;

          return (
            <Row
              item={item}
              onPress={onRowPress ? () => onRowPress(item) : undefined}
              onDownload={onDownload ? () => onDownload(item) : undefined}
              onView={onView ? () => onView(item) : undefined}
              onUpload={onUpload ? () => onUpload(item) : undefined}
              downloaded={downloaded}
              completed={completed}
              uploaded={uploaded}
              uploading={isUploading}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={C.gray} />
            <Text style={styles.emptyTitle}>No orders</Text>
            <Text style={styles.emptySub}>Pull to refresh or try again later.</Text>
          </View>
        }
        contentContainerStyle={data.length === 0 ? { flex: 1 } : undefined}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
};

export default SalesOrdersStyledTable;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: C.pageBg,
    paddingHorizontal: 12,
    paddingTop: 5,
  },
  titleWrap: { 
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  headerText: {
    fontSize: 20,
    fontWeight: "700",
    color: C.headerText,
  },
  headerSub: {
    fontSize: 12,
    color: C.subText,
    marginTop: 2,
  },

  // Table header row
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",

    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  thText: {
    fontSize: 12,
    fontWeight: "700",
    color: C.gray,
  },

  // Rows
  row: {
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
  },
  cell: {
    paddingRight: 8,
    justifyContent: "center",
  },
  soText: {
    color: "#111827",
    fontSize: 14,
    fontWeight: "700",
  },
  statusText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "600",
  },
  metricText: {
    color: "#111827",
    fontSize: 13,
    fontWeight: "500",
  },
  uploadingText: {
    color: C.blue,
    fontSize: 10,
    fontWeight: "500",
    marginTop: 2,
  },

  iconBtn: {
    height: 34,
    width: 34,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },

  sep: { 
    height: 8 
  },

  // Empty state
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: C.headerText,
    marginTop: 12,
  },
  emptySub: {
    marginTop: 4,
    color: C.subText,
    fontSize: 14,
    textAlign: "center",
  },
});
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
  onDocument?: (o: OrdersSummaryItem) => void;

  // State maps (keyed by saleOrderNumber)
  downloadedMap?: Record<string, boolean>;
  issueCompletedMap?: Record<string, boolean>;
  packCompletedMap?: Record<string, boolean>;
  phaseMap?: Record<string, "issue" | "packing">;

  // Which SO is currently uploading (SO number) — null/undefined if none
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
  blue: "#2563EB",
};

const Col = {
  so: 1.0,
  status: 1.2,
  priority: 0.9,
  items: 0.9,
  material: 1.0,
  action: 1.1,
};

const IconTap: React.FC<
  React.PropsWithChildren<{
    onPress?: () => void;
    disabled?: boolean;
    ariaLabel?: string;
    hitSlop?: number;
  }>
> = ({ onPress, disabled, ariaLabel, children, hitSlop = 10 }) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    accessibilityLabel={ariaLabel}
    style={[styles.iconTap, disabled && { opacity: 0.4 }]}
    hitSlop={hitSlop}
  >
    {children}
  </Pressable>
);

const Row: React.FC<{
  item: OrdersSummaryItem;
  onPress?: () => void;
  onDownload?: () => void;
  onView?: () => void;
  onUpload?: () => void;
  onDocument?: () => void;
  downloaded?: boolean;
  issueCompleted?: boolean;
  packCompleted?: boolean;
  phase?: "issue" | "packing";
  uploading?: boolean;
}> = ({
  item,
  onPress,
  onDownload,
  onView,
  onUpload,
  onDocument,
  downloaded = false,
  issueCompleted = false,
  packCompleted = false,
  phase = "issue",
  uploading = false,
}) => {
  const currentPhase = phase;
  const isUploading = uploading;

  const statusText =
    (item as any)?.status ??
    (isUploading
      ? "Uploading..."
      : !downloaded
      ? "Not downloaded"
      : currentPhase === "issue" && !issueCompleted
      ? "Issuing in progress"
      : currentPhase === "packing" && !packCompleted
      ? "Packing in progress"
      : "Ready to upload");

  const priorityText =
    (item as any)?.priority != null ? String((item as any).priority) : "-";

  const totalItems =
    (item as any)?.totalItems != null ? String((item as any).totalItems) : "-";

  const totalMaterials =
    (item as any)?.totalMaterials != null
      ? String((item as any).totalMaterials)
      : "-";

  // Action visibility
  const showDownloadOnly = !downloaded;
  const showProgressActions =
    downloaded &&
    ((currentPhase === "issue" && !issueCompleted) ||
      (currentPhase === "packing" && !packCompleted));
  const showReadyActions =
    (currentPhase === "issue" && issueCompleted) ||
    (currentPhase === "packing" && packCompleted);

  const rowStyle = [
    styles.row,
    showReadyActions && { backgroundColor: C.greenBg, borderColor: C.greenBorder },
    isUploading && { opacity: 0.9 },
  ];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || isUploading}
      style={rowStyle}
    >
      {/* SO */}
      <View style={[styles.cell, { flex: Col.so }]}>
        <Text style={[styles.soText, showReadyActions && { color: C.greenText }]}>
          {item.saleOrderNumber}
        </Text>
      </View>

      {/* Status */}
      <View style={[styles.cell, { flex: Col.status }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.statusText,
            showReadyActions ? { color: C.greenText, fontWeight: "700" } : undefined,
            isUploading ? { color: C.blue } : undefined,
          ]}
        >
          {statusText}
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

      {/* Actions (icons only) */}
      <View style={[styles.cell, { flex: Col.action }]}>
        <View style={styles.actionBar}>
          {showDownloadOnly && onDownload && (
            <IconTap
              onPress={onDownload}
              disabled={isUploading}
              ariaLabel="Download order details"
            >
              <Ionicons
                name="download-outline"
                size={22}
                color={isUploading ? C.gray : C.icon}
              />
            </IconTap>
          )}

          {showProgressActions && (
            <>
              {onView && (
                <IconTap
                  onPress={onView}
                  disabled={isUploading}
                  ariaLabel="View order details"
                >
                  <Ionicons
                    name="eye-outline"
                    size={22}
                    color={isUploading ? C.gray : C.icon}
                  />
                </IconTap>
              )}
              {onDocument && (
                <IconTap
                  onPress={onDocument}
                  disabled={isUploading}
                  ariaLabel="Open documents"
                >
                  <Ionicons
                    name="document-outline"
                    size={22}
                    color={isUploading ? C.gray : C.icon}
                  />
                </IconTap>
              )}
            </>
          )}

          {showReadyActions && (
            <>
              {isUploading ? (
                <ActivityIndicator size="small" color={C.blue} />
              ) : (
                onUpload && (
                  <IconTap onPress={onUpload} ariaLabel="Upload data">
                    <Ionicons
                      name="cloud-upload-outline"
                      size={22}
                      color={C.blue}
                    />
                  </IconTap>
                )
              )}
              {onDocument && (
                <IconTap
                  onPress={onDocument}
                  disabled={isUploading}
                  ariaLabel="Open documents"
                >
                  <Ionicons
                    name="document-outline"
                    size={22}
                    color={isUploading ? C.gray : C.icon}
                  />
                </IconTap>
              )}
            </>
          )}
        </View>
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
  onDocument,
  downloadedMap = {},
  issueCompletedMap = {},
  packCompletedMap = {},
  phaseMap = {},
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
          const issueCompleted = !!issueCompletedMap[so];
          const packCompleted = !!packCompletedMap[so];
          const phase = phaseMap[so] || "issue";
          const isUploading = uploading === so;

          return (
            <Row
              item={item}
              onPress={onRowPress ? () => onRowPress(item) : undefined}
              onDownload={onDownload ? () => onDownload(item) : undefined}
              onView={onView ? () => onView(item) : undefined}
              onUpload={onUpload ? () => onUpload(item) : undefined}
              onDocument={onDocument ? () => onDocument(item) : undefined}
              downloaded={downloaded}
              issueCompleted={issueCompleted}
              packCompleted={packCompleted}
              phase={phase}
              uploading={isUploading}
            />
          );
        }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="document-text-outline" size={48} color={C.gray} />
            <Text style={styles.emptyTitle}>No orders</Text>
            <Text style={styles.emptySub}>
              Pull to refresh or try again later.
            </Text>
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

  // Table header row
  tableHeader: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
    backgroundColor: "#FFF",
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
    borderRadius: 12,
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

  actionBar: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    width: "100%",
    gap: 12, // airy spacing between icons
  },

  // Icon tap area (transparent; no bg/border)
  iconTap: {
    backgroundColor: "transparent",
    borderWidth: 0,
    height: 36,
    width: 36,
    alignItems: "center",
    justifyContent: "center",
  },

  sep: { height: 8 },

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
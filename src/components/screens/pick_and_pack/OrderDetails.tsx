// src/screens/OrderDetailsScreen.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  TextInput,
  Pressable,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp } from "@react-navigation/native";
import {
  getOrderDetails,
  type StoredMaterialItem,
  // saveOrderDetails, // optional persistence
} from "../../Storage/sale_order_storage";

export type RootStackParamList = {
  Login: undefined;
  Home: { displayName?: string } | undefined;
  SalesOrders: undefined;
  OrderDetails: { saleOrderNumber: string };
  MaterialFG: undefined;
  MaterialDispatch: undefined;
};

type OrderDetailsScreenRouteProp = RouteProp<
  RootStackParamList,
  "OrderDetails"
>;

type Props = {
  route: OrderDetailsScreenRouteProp;
};

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
  secondaryBtn: "#F3F4F6",
  secondaryText: "#111827",
  pillBg: "#F3F4F6",
};

type MaterialRow = StoredMaterialItem & {
  issuedQty: number; // local working field
};

const OrderDetailsScreen: React.FC<Props> = ({ route }) => {
  const { saleOrderNumber } = route.params;
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [code, setCode] = useState("");

  useEffect(() => {
    const loadDetails = async () => {
      try {
        setLoading(true);
        const data = await getOrderDetails(saleOrderNumber);
        if (data && Array.isArray(data.orderDetails)) {
          const withIssued: MaterialRow[] = data.orderDetails.map((m: any) => ({
            ...m,
            issuedQty: typeof m.issuedQty === "number" ? m.issuedQty : 0,
          }));
          setMaterials(withIssued);
        } else {
          Alert.alert("Error", "No order details found or invalid data format.");
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Failed to load order details.");
      } finally {
        setLoading(false);
      }
    };
    loadDetails();
  }, [saleOrderNumber]);

  // Totals for chips
  const { totalItems, completedItems, totalRequired, totalIssued } = useMemo(() => {
    const ti = materials.length;
    const ci = materials.filter((m) => (m.issuedQty ?? 0) >= (m.requiredQty ?? 0)).length;
    const tr = materials.reduce((s, m) => s + (Number(m.requiredQty) || 0), 0);
    const tiq = materials.reduce((s, m) => s + (Number(m.issuedQty) || 0), 0);
    return { totalItems: ti, completedItems: ci, totalRequired: tr, totalIssued: tiq };
  }, [materials]);

  const incrementIssueForCode = (materialCodeInput: string) => {
    const codeTrim = materialCodeInput.trim();
    if (!codeTrim) {
      Alert.alert("Enter a code", "Please scan or type a material code.");
      return;
    }

    const idx = materials.findIndex(
      (m) => String(m.materialCode).toLowerCase() === codeTrim.toLowerCase()
    );

    if (idx === -1) {
      Alert.alert("Not found", `Material code "${codeTrim}" is not in this order.`);
      return;
    }

    setMaterials((prev) => {
      const clone = [...prev];
      const row = clone[idx];
      const req = Number(row.requiredQty) || 0;
      const cur = Number(row.issuedQty) || 0;

      if (cur >= req) {
        Alert.alert("Already complete", "This material is already fully issued.");
        return prev;
      }

      const nextIssued = cur + 1;
      clone[idx] = { ...row, issuedQty: nextIssued };

      // saveOrderDetails(saleOrderNumber, { orderDetails: clone }); // optional persist
      return clone;
    });

    setCode(""); // clear input after submit
  };

  const onSubmit = () => incrementIssueForCode(code);

  const onUpload = () => {
    Alert.alert("Upload", "Connect this button to your upload/import flow.");
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading order details…</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.headerBar}>
          <Text style={styles.headerTitle}>Order Details: SO #{saleOrderNumber}</Text>
        </View>

        {/* Top summary chips */}
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

        {/* Scan/Enter + Submit + Upload */}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Scan / Enter Material Code"
            placeholderTextColor={C.subText}
            value={code}
            onChangeText={setCode}
            autoCapitalize="characters"
            autoCorrect={false}
            returnKeyType="done"
            onSubmitEditing={onSubmit}
          />
          <Pressable style={styles.primaryBtn} onPress={onSubmit}>
            <Text style={styles.primaryBtnText}>Submit</Text>
          </Pressable>
          <Pressable style={styles.secondaryBtn} onPress={onUpload}>
            <Text style={styles.secondaryBtnText}>Upload</Text>
          </Pressable>
        </View>

        {/* Table */}
        <View style={styles.card}>
          <View style={styles.tableHead}>
            <View style={[styles.cell, styles.flex18, styles.left]}>
              <Text style={styles.headText}>Material Code</Text>
            </View>
            <View style={[styles.cell, styles.flex40, styles.left]}>
              <Text style={styles.headText}>Description</Text>
            </View>
            <View style={[styles.cell, styles.flex16, styles.centerAlign]}>
              <Text style={styles.headText}>Bin No</Text>
            </View>
            <View style={[styles.cell, styles.flex12, styles.right]}>
              <Text style={styles.headText}>Required Qty</Text>
            </View>
            <View style={[styles.cell, styles.flex10, styles.centerAlign]}>
              <Text style={styles.headText}>Issue Stage</Text>
            </View>
          </View>

          <FlatList
            data={materials}
            keyExtractor={(item, index) => `${item.materialCode}-${index}`}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            renderItem={({ item }) => {
              const isDone =
                Number(item.issuedQty || 0) >= Number(item.requiredQty || 0);
              const pillDone = isDone && (item.requiredQty ?? 0) > 0;
              return (
                <View
                  style={[
                    styles.row,
                    isDone && { backgroundColor: C.greenBg },
                  ]}
                >
                  <View style={[styles.cell, styles.flex18, styles.left]}>
                    <Text
                      style={[styles.metricText, isDone && { color: C.greenText, fontWeight: "700" }]}
                      numberOfLines={1}
                    >
                      {item.materialCode}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex40, styles.left]}>
                    <Text
                      style={[styles.metricText, isDone && { color: C.greenText }]}
                      numberOfLines={2}
                    >
                      {item.description}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex16, styles.centerAlign]}>
                    <Text
                      style={[styles.metricText, isDone && { color: C.greenText }]}
                      numberOfLines={1}
                    >
                      {item.binNo}
                    </Text>
                  </View>

                  <View style={[styles.cell, styles.flex12, styles.right]}>
                    <Text
                      style={[styles.metricText, isDone && { color: C.greenText, fontWeight: "700" }]}
                    >
                      {item.requiredQty}
                    </Text>
                  </View>

                  {/* Single-digit Issue Stage (current issued only) */}
                  <View style={[styles.cell, styles.flex10, styles.centerAlign]}>
                    <View
                      style={[
                        styles.issuePill,
                        pillDone && { backgroundColor: C.greenText + "20" }, // subtle when complete
                      ]}
                    >
                      <Text
                        style={[
                          styles.issuePillText,
                          pillDone && { color: C.greenText, fontWeight: "800" },
                        ]}
                      >
                        {item.issuedQty ?? 0}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <Text style={styles.subText}>No materials found.</Text>
              </View>
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.pageBg },
  container: { flex: 1, paddingHorizontal: 10, paddingBottom: 10, gap: 10 },
  headerBar: { marginTop: 4, marginBottom: 4 },
  headerTitle: { color: C.headerText, fontSize: 20, fontWeight: "700" },

  chipsRow: { flexDirection: "row", gap: 10 },
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

  inputRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: C.card,
    borderColor: C.border,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 44,
    color: C.headerText,
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
  secondaryBtn: {
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: C.secondaryBtn,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  secondaryBtnText: { color: C.secondaryText, fontWeight: "700" },

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

  // NEW: Issue Stage badge
  issuePill: {
    minWidth: 30,
    paddingHorizontal: 8,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  issuePillText: {
    fontSize: 14,
    fontWeight: "700",
    color: C.headerText,
  },
});

export default OrderDetailsScreen;

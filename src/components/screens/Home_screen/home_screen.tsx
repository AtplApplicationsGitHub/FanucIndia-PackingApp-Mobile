import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import {
  useSafeAreaInsets,
  SafeAreaView,
} from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { useKeyboardDisabled } from "../../utils/keyboard";

type MenuItem = {
  id: "pick" | "transfer" | "dispatch" | "customer" | "vehicle" | "location_accuracy" | "content_accuracy" | "put_away";
  title: string;
  subtitle: string;
  iconName: string;
};

type Props = NativeStackScreenProps<RootStackParamList, "Home">;

const PRIMARY = "#FACC15"; // yellow-400
const HEADER_TEXT = "#0B0F19";
const BODY_TEXT = "#111827";
const MUTED = "#6B7280";
const CARD_BG = "#FFFFFF";
const SOFT_YELLOW = "#FFF7CC";

const MENU: MenuItem[] = [
  // {
  //   id: "pick",
  //   title: "Pick and Pack",
  //   subtitle: "Process materials",
  //   iconName: "cube-outline",
  // },
  {
    id: "customer",
    title: "Customer Label Print",
    subtitle: "Print customer labels",
    iconName: "printer-outline",
  },
  {
    id: "transfer",
    title: "Material FG / Transfer",
    subtitle: "Finished goods & movement",
    iconName: "swap-horizontal",
  },
  {
    id: "vehicle",
    title: "Vehicle Entry",
    subtitle: "Register vehicle arrival",
    iconName: "car-outline",
  },
  {
    id: "dispatch",
    title: "Material Dispatch",
    subtitle: "Ready for shipment",
    iconName: "truck-outline",
  },
  // {
  //   id: "location_accuracy",
  //   title: "Location Accuracy",
  //   subtitle: "Check location accuracy",
  //   iconName: "target",
  // },
  // {
  //   id: "content_accuracy",
  //   title: "Content Accuracy",
  //   subtitle: "Verify content details",
  //   iconName: "checkbox-marked-circle-outline",
  // },
  {
    id: "put_away",
    title: "Put Away Location",
    subtitle: "Store items in location",
    iconName: "arrow-down-bold-box-outline",
  },
];

function pickBestName(input?: {
  displayName?: string;
  user?: { name?: string; username?: string; email?: string };
}) {
  const fromParams =
    input?.displayName ||
    input?.user?.name ||
    input?.user?.username ||
    input?.user?.email;
  if (fromParams && typeof fromParams === "string") return fromParams.trim();
  return undefined;
}

function computeGreeting(d = new Date()) {
  const h = d.getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  return "Good evening";
}

const HomeScreen: React.FC<Props> = ({ navigation, route }) => {
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState<string>("User");
  const [greeting, setGreeting] = useState<string>(computeGreeting());

  // Global keyboard toggle
  const [keyboardDisabled, setKeyboardDisabled] = useKeyboardDisabled();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);

  // Update greeting every minute
  useEffect(() => {
    const tick = () => setGreeting(computeGreeting());
    const id = setInterval(tick, 60 * 1000);
    return () => clearInterval(id);
  }, []);

  // Name from route params
  useEffect(() => {
    const byParams = pickBestName(route?.params as any);
    if (byParams) setDisplayName(byParams);
  }, [route?.params]);

  // Load User & Permissions from AsyncStorage
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [k1, k2, k3] = await Promise.all([
          AsyncStorage.getItem("displayName"),
          AsyncStorage.getItem("username"),
          AsyncStorage.getItem("user"),
        ]);
        
        let parsedUser: any = null;
        if (k3) {
          try {
            parsedUser = JSON.parse(k3);
          } catch {
            parsedUser = null;
          }
        }

        const fromStorage =
          (k1 && k1.trim()) ||
          (k2 && k2.trim()) ||
          (parsedUser?.name as string) ||
          (parsedUser?.username as string) ||
          (parsedUser?.email as string);

        if (mounted) {
          if (fromStorage && !route?.params) {
            setDisplayName(String(fromStorage).trim());
          }

          
          if (parsedUser) {
            const newMenu = MENU.filter((item) => {
              switch (item.id) {
                case "customer":
                  return !!parsedUser.accessLabelPrint;
                case "transfer":
                  return !!parsedUser.accessMaterialFgTransfer;
                case "dispatch":
                  return !!parsedUser.accessMaterialDispatch;
                case "vehicle":
                  return !!parsedUser.accessVehicleEntry;
                case "location_accuracy":
                case "content_accuracy":
                case "put_away":
                    return true;
                default:
                  return false;
              }
            });
            setMenuItems(newMenu);
          } else {
             // Fallback if no user object (shouldn't happen on fresh login)
            setMenuItems([]); 
          }
        }
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, [route?.params]);

  const onPressItem = (item: MenuItem) => () => {
    switch (item.id) {
      case "pick":
        // navigation.navigate("PickAndPack");
        break;
      case "transfer":
        navigation.navigate("MaterialFG");
        break;
      case "dispatch":
        navigation.navigate("MaterialDispatch");
        break;
      case "customer":
        navigation.navigate("LabelPrint");
        break;
      case "vehicle":
        navigation.navigate("VehicleEntry");
        break;
      case "location_accuracy":
      case "content_accuracy":
      case "put_away":
        navigation.navigate("PutAway");
        break;
      default:
        console.warn("Unknown menu item:", item.id);
    }
  };

  const onLogout = async () => {
    try {
      await SecureStore.deleteItemAsync("authToken");
      await AsyncStorage.multiRemove(["displayName", "username", "user"]);
    } catch (err) {
      console.warn("Logout cleanup error:", err);
    }
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  const username = useMemo(() => {
    const name = displayName || "User";
    if (name.includes("@")) return name.split("@")[0];
    return name;
  }, [displayName]);

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header */}
      <SafeAreaView edges={["top"]} style={{ backgroundColor: PRIMARY }}>
        <View style={[styles.header, { paddingHorizontal: 12 }]}>
          <View style={styles.brandLeft} accessible accessibilityRole="header">
            <View style={styles.logoBadge}>
              <Ionicons name="flash" size={18} color={HEADER_TEXT} />
            </View>
            <Text style={styles.brandText} numberOfLines={1} adjustsFontSizeToFit>
              <Text style={{ fontWeight: "700" }}>Scan Pack</Text>
              <Text style={{ fontWeight: "700" }}> · FANUC India</Text>
            </Text>
          </View>
          <TouchableOpacity
            onPress={onLogout}
            activeOpacity={0.85}
            style={styles.logoutBtn}
            accessibilityRole="button"
            accessibilityLabel="Logout"
          >
            <Text style={styles.logoutText}>Logout</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Main Content */}
      <View style={styles.content}>
        {/* Greeting + Keyboard Toggle */}
        <View style={styles.greetingContainer}>
          <Text style={styles.greeting}>
            {greeting},{" "}
            <Text style={{ fontWeight: "700" }}>{username}</Text>
          </Text>

          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>
              {keyboardDisabled ? "Scan Only" : "Keyboard"}
            </Text>
            <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setKeyboardDisabled(!keyboardDisabled)}
                style={{
                  width: 52,
                  height: 30,
                  borderRadius: 15,
                  borderWidth: 2,
                  borderColor: !keyboardDisabled ? PRIMARY : "#9CA3AF",
                  backgroundColor: "transparent",
                  justifyContent: "center",
                  paddingHorizontal: 3,
                  alignItems: !keyboardDisabled ? "flex-end" : "flex-start",
                }}
            >
              <View 
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: 10,
                  backgroundColor: !keyboardDisabled ? PRIMARY : "#9CA3AF",
                }} 
              />
            </TouchableOpacity>
          </View>
        </View>

        <FlatList
          style={{ flex: 1 }}
          data={menuItems}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{
            paddingVertical: 8,
            paddingBottom: 16 + insets.bottom,
            flexGrow: 1,
            justifyContent: menuItems.length === 0 ? "center" : undefined,
          }}
          ListEmptyComponent={
            <View style={{ padding: 20, alignItems: "center" }}>
              <Text style={{ color: "#DC2626", fontSize: 10, fontWeight: "600", textAlign: "center" }}>
                No modules available. Please contact admin.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.9}
              onPress={onPressItem(item)}
            >
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons
                  name={item.iconName as any}
                  size={22}
                  color="#DC2626"
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{item.title}</Text>
                <Text style={styles.cardSubtitle}>{item.subtitle}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={MUTED} />
            </TouchableOpacity>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={Platform.OS === "android"}
        />
        <View style={{ alignItems: "center", paddingVertical: 10 }}>
          <TouchableOpacity
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              backgroundColor: "#E5E7EB",
              borderRadius: 20,
            }}
          >
            <Text style={{ fontSize: 12, color: "#6B7280", fontWeight: "600" }}>
              Vr:0.02
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    backgroundColor: PRIMARY,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    ...Platform.select({
      android: { elevation: 2 },
      ios: {
        shadowColor: "#000",
        shadowOpacity: 0.05,
        shadowRadius: 6,
        shadowOffset: { width: 0, height: 2 },
      },
    }),
  },
  brandLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    minHeight: 44,
  },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FDE047",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandText: {
    fontSize: 16,
    color: HEADER_TEXT,
    fontWeight: "600",
    flexShrink: 1,
  },
  logoutBtn: {
    backgroundColor: "#FFE380",
    paddingHorizontal: 14,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#F5D24E",
    marginLeft: 10,
  },
  logoutText: { color: HEADER_TEXT, fontSize: 13, fontWeight: "700" },
  content: { flex: 1, paddingHorizontal: 12, paddingTop: 4 },
  greetingContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  greeting: { fontSize: 18, color: BODY_TEXT },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggleLabel: {
    fontSize: 14,
    color: MUTED,
    fontWeight: "600",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    marginVertical: 4,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: SOFT_YELLOW,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: {
    fontSize: 15,
    color: BODY_TEXT,
    fontWeight: "700",
    marginBottom: 2,
  },
  cardSubtitle: { fontSize: 12.5, color: MUTED },
});

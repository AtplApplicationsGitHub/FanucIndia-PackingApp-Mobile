// src/screens/HomeScreen.tsx
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Platform,
} from "react-native";
import { useSafeAreaInsets, SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../App";

type MenuItem = {
  id: "pick" | "transfer" | "dispatch";
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

  const onLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

const MENU: MenuItem[] = [
  { id: "pick", title: "Pick and Pack", subtitle: "Process materials", iconName: "cube-outline" },
  {
    id: "transfer",
    title: "Material FG / Transfer",
    subtitle: "Finished goods & movement",
    iconName: "swap-horizontal",
  },
  { id: "dispatch", title: "Material Dispatch", subtitle: "Ready for shipment", iconName: "truck-outline" },
];

const HomeScreen: React.FC<Props> = ({ navigation }) => {
  const insets = useSafeAreaInsets();

  const onPressItem = (item: MenuItem) => () => {
    switch (item.id) {
      case "pick":
        navigation.navigate("PickAndPack");
        break;
      case "transfer":
        navigation.navigate("MaterialFG");
        break;
      case "dispatch":
        navigation.navigate("MaterialDispatch");
        break;
      default:
        break;
    }
  };

  const onLogout = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: "Login" }],
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={["bottom"]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            paddingTop: Math.max(insets.top, 8),
            paddingBottom: 12,
          },
        ]}
      >
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
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      {/* Body */}
      <View style={styles.content}>
        <Text style={styles.greeting}>
          Hi, <Text style={{ fontWeight: "700" }}>User</Text> 👋
        </Text>

        <FlatList
          data={MENU}
          keyExtractor={(it) => it.id}
          contentContainerStyle={{ paddingVertical: 8, paddingBottom: 16 + insets.bottom }}
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={onPressItem(item)}>
              <View style={styles.iconWrap}>
                <MaterialCommunityIcons name={item.iconName as any} size={22} color="#DC2626" />
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
      </View>
    </SafeAreaView>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },

  header: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  brandLeft: { flexDirection: "row", alignItems: "center", flex: 1, minHeight: 44 },
  logoBadge: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: "#FDE047",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  brandText: { fontSize: 16, color: HEADER_TEXT, fontWeight: "600", flexShrink: 1 },

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

  content: { flex: 1, paddingHorizontal: 12, paddingTop: 16 },
  greeting: { fontSize: 18, color: BODY_TEXT, marginBottom: 12 },

  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: CARD_BG,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 16,
    marginVertical: 8,
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
  cardTitle: { fontSize: 15, color: BODY_TEXT, fontWeight: "700", marginBottom: 2 },
  cardSubtitle: { fontSize: 12.5, color: MUTED },
});

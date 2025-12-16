import React, { useMemo, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../../App";
import { loginApiWithEmail } from "../../Api/Hooks/Auth";
import { getBaseUrl, setBaseUrl } from "../../Api/Endpoints";

type NavProps = NativeStackScreenProps<RootStackParamList, "Login">;

const PRIMARY_YELLOW = "#FACC15";
const ACCENT = "#111827";
const MUTED = "#6B7280";
const SURFACE = "#FFF9DB";
const FIELD_BG = "#FAFAFA";
const FIELD_BORDER = "#E5E7EB";

const LoginScreen: React.FC<NavProps> = ({ navigation }) => {
  const [email, setEmail] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentVersion, setCurrentVersion] = useState("Vr.0.02");

  const [modal, setModal] = useState<{ visible: boolean; title: string; message: string }>({
    visible: false,
    title: "",
    message: "",
  });

  // Settings modal for API URL
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [apiUrl, setApiUrl] = useState<string>("");

  const canSubmit = useMemo(() => Boolean(email && pwd && !loading), [email, pwd, loading]);

  const showModal = (title: string, message: string) =>
    setModal({ visible: true, title, message });

  const closeModal = () => setModal((m) => ({ ...m, visible: false }));

  // On first time, force user to enter API URL (no default)
  useEffect(() => {
    const initApiUrl = async () => {
      try {
        const stored = await AsyncStorage.getItem("apiBaseUrl");
        if (stored) {
          setApiUrl(stored);
          setBaseUrl(stored);
        } else {
          // First time: open settings modal and require URL
          setApiUrl("");
          setSettingsVisible(true);
        }
      } catch {
        setApiUrl("");
        setSettingsVisible(true);
      }
    };
    initApiUrl();
  }, []);

  const handleSaveApiUrl = async () => {
    const trimmed = apiUrl.trim().replace(/\/+$/, "");
    if (!trimmed) {
      showModal("Invalid URL", "Please enter a valid API base URL.");
      return;
    }

    try {
      setBaseUrl(trimmed);
      await AsyncStorage.setItem("apiBaseUrl", trimmed);
      setSettingsVisible(false);
    } catch (err) {
      showModal("Error", "Failed to save API URL. Please try again.");
    }
  };

  const handleLogin = async () => {
    if (!canSubmit) {
      showModal("Missing fields", "Please enter your email/username and password.");
      return;
    }

    const base = getBaseUrl();
    if (!base) {
      showModal("API URL Required", "Please set the API Base URL from the settings icon before logging in.");
      setSettingsVisible(true);
      return;
    }

    try {
      setLoading(true);

      const result = await loginApiWithEmail(email.trim(), pwd);

      const token =
        result?.token || result?.accessToken || result?.data?.token || result?.data?.accessToken;

      if (!token && result?.success !== true) {
        throw new Error(result?.message || "Login failed (no token in response).");
      }

      const userData = (result as any)?.data?.user;
      const displayName =
        userData?.name || userData?.displayName || userData?.username || email.trim();

      await SecureStore.setItemAsync("authToken", String(token));
      await AsyncStorage.setItem("displayName", String(displayName));

      navigation.reset({ index: 0, routes: [{ name: "Home" }] });
    } catch (err: any) {
      showModal("Login Failed", err?.message || "Unable to connect. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      {/* Top-right Settings icon */}
      <TouchableOpacity
        style={styles.settingsButton}
        activeOpacity={0.7}
        onPress={() => setSettingsVisible(true)}
      >
        <Ionicons name="settings-outline" size={24} color={ACCENT} />
      </TouchableOpacity>

      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.kav}
      >
        <View style={styles.centerWrap}>
          <Text style={styles.welcome}>Welcome back, Fanuc.</Text>

          <View style={styles.card}>
            {/* Email / Username */}
            <InputField
              label="Email / Username"
              icon={<Ionicons name="person-outline" size={20} color={MUTED} />}
              value={email}
              onChangeText={setEmail}
              placeholderTextColor={MUTED}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="username"
              returnKeyType="next"
            />

            {/* Password */}
            <InputField
              label="Password"
              icon={<MaterialCommunityIcons name="lock-outline" size={20} color={MUTED} />}
              value={pwd}
              onChangeText={setPwd}
              placeholderTextColor={MUTED}
              secureTextEntry={!showPwd}
              textContentType="password"
              autoComplete="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
              rightAdornment={
                <TouchableOpacity onPress={() => setShowPwd((s) => !s)}>
                  <Ionicons
                    name={showPwd ? "eye-outline" : "eye-off-outline"}
                    size={20}
                    color={MUTED}
                  />
                </TouchableOpacity>
              }
            />

            <TouchableOpacity
              activeOpacity={0.9}
              onPress={handleLogin}
              disabled={!canSubmit}
              style={[styles.cta, !canSubmit ? styles.ctaDisabled : null]}
            >
              {loading ? (
                <ActivityIndicator size="small" color={ACCENT} />
              ) : (
                <Text style={styles.ctaText}>Sign In</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* Version Control Button */}
      <TouchableOpacity activeOpacity={0.7} style={styles.versionButton}>
        <Text style={styles.versionText}>{currentVersion}</Text>
      </TouchableOpacity>

      {/* ---------- Error Modal Popup ---------- */}
      <Modal animationType="fade" transparent visible={modal.visible} onRequestClose={closeModal}>
        <View style={mstyles.backdrop}>
          <View style={mstyles.sheet}>
            <View style={mstyles.headerRow}>
              <Ionicons name="information-circle-outline" size={22} color={ACCENT} />
              <Text style={mstyles.title}>{modal.title}</Text>
            </View>
            <Text style={mstyles.message}>{modal.message}</Text>

            <View style={mstyles.actions}>
              <TouchableOpacity style={mstyles.primaryBtn} onPress={closeModal}>
                <Text style={mstyles.primaryBtnText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* --------------------------------- */}

      {/* ---------- Settings Modal (API URL) ---------- */}
      <Modal
        animationType="fade"
        transparent
        visible={settingsVisible}
        onRequestClose={() => setSettingsVisible(false)}
      >
        <View style={mstyles.backdrop}>
          <View style={mstyles.sheet}>
            <View style={mstyles.headerRow}>
              <Ionicons name="settings-outline" size={22} color={ACCENT} />
              <Text style={mstyles.title}>API Settings</Text>
            </View>
            <View style={{ marginTop: 12 }}>
              <TextInput
                value={apiUrl}
                onChangeText={setApiUrl}
                placeholder="https://your-domain.com/api"
                placeholderTextColor={MUTED}
                autoCapitalize="none"
                autoCorrect={false}
                style={styles.apiInput}
              />
            </View>

            <View style={mstyles.actions}>
              <TouchableOpacity
                style={[mstyles.primaryBtn, styles.cancelBtn]}
                onPress={() => setSettingsVisible(false)}
              >
                <Text style={[mstyles.primaryBtnText, styles.cancelBtnText]}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity style={mstyles.primaryBtn} onPress={handleSaveApiUrl}>
                <Text style={mstyles.primaryBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      {/* --------------------------------- */}
    </SafeAreaView>
  );
};

export default LoginScreen;

type InputProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: React.ReactNode;
  rightAdornment?: React.ReactNode;
};

const InputField: React.FC<InputProps> = ({
  label,
  icon,
  rightAdornment,
  value,
  style,
  onFocus,
  onBlur,
  placeholder,
  placeholderTextColor = MUTED,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const borderColor = focused ? PRIMARY_YELLOW : FIELD_BORDER;

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.field, { borderColor }]}>
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}

        <View style={{ flex: 1, justifyContent: "center" }}>
          <TextInput
            {...rest}
            value={value}
            placeholder={placeholder ?? label}
            placeholderTextColor={placeholderTextColor}
            onFocus={(e) => {
              setFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setFocused(false);
              onBlur?.(e);
            }}
            style={[styles.input, style]}
          />
        </View>

        {rightAdornment ? <View style={{ marginLeft: 8 }}>{rightAdornment}</View> : null}
      </View>
    </View>
  );
};

/* ------------------------------ Styles ------------------------------ */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: SURFACE },
  kav: { flex: 1 },
  centerWrap: { flex: 1, justifyContent: "center", alignItems: "center", padding: 16, gap: 12 },
  welcome: { width: "92%", maxWidth: 420, fontSize: 22, fontWeight: "800", color: ACCENT },
  card: {
    width: "92%",
    maxWidth: 420,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 16,
    gap: 14,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: FIELD_BORDER,
    backgroundColor: FIELD_BG,
    paddingHorizontal: 12,
    height: 56,
    borderRadius: 14,
  },
  input: { flex: 1, fontSize: 15, color: ACCENT },
  cta: {
    backgroundColor: PRIMARY_YELLOW,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#F59E0B",
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.6 },
  ctaText: { color: ACCENT, fontWeight: "800", fontSize: 16, letterSpacing: 0.3 },

  // Version Button Styles
  versionButton: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  versionText: {
    fontSize: 12,
    color: MUTED,
    fontWeight: "500",
  },

  // Settings button (top-right)
  settingsButton: {
    position: "absolute",
    top: 40,
    right: 16,
    zIndex: 10,
    padding: 6,
  },

  // API settings input styles
  apiLabel: {
    fontSize: 13,
    marginBottom: 4,
    color: ACCENT,
    fontWeight: "600",
  },
  apiInput: {
    borderWidth: 1.5,
    borderColor: FIELD_BORDER,
    backgroundColor: FIELD_BG,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: ACCENT,
  },

  cancelBtn: {
    backgroundColor: "#E5E7EB",
    marginRight: 8,
  },
  cancelBtnText: {
    color: ACCENT,
  },
});

/* ------------------------------ Modal Styles ------------------------------ */
const mstyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  sheet: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "white",
    borderRadius: 20,
    paddingVertical: 18,
    paddingHorizontal: 16,
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  title: { fontSize: 18, fontWeight: "800", color: ACCENT },
  message: { fontSize: 14, color: "#111827", marginTop: 2, lineHeight: 20 },
  actions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 16 },
  primaryBtn: {
    backgroundColor: PRIMARY_YELLOW,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 18,
  },
  primaryBtnText: { color: ACCENT, fontWeight: "800", fontSize: 14 },
});

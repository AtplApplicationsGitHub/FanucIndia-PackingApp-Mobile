import React, { useMemo, useRef, useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../App";

type OwnProps = {
  onLogin?: (username: string) => Promise<void> | void;
};

type NavProps = NativeStackScreenProps<RootStackParamList, "Login">;
type Props = OwnProps & NavProps;

const PRIMARY_YELLOW = "#FACC15";
const ACCENT = "#111827";
const MUTED = "#6B7280";
const SURFACE = "#FFF9DB";
const FIELD_BG = "#FAFAFA";
const FIELD_BORDER = "#E5E7EB";

const LoginScreen: React.FC<Props> = ({ onLogin, navigation }) => {
  const [username, setUsername] = useState("");
  const [pwd, setPwd] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);

  const canSubmit = useMemo(() => Boolean(username && pwd && !loading), [username, pwd, loading]);

  const handleLogin = async () => {
    if (!canSubmit) {
      Alert.alert("Missing fields", "Please enter your username/email and password.");
      return;
    }
    try {
      setLoading(true);
      // simulate API
      await new Promise((r) => setTimeout(r, 900));
      if (onLogin) await onLogin(username);

      // ✅ Navigate to Home and clear Login from history
      navigation.reset({
        index: 0,
        routes: [{ name: "Home" }],
      });
    } catch {
      Alert.alert("Login failed", "Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.select({ ios: "padding", android: undefined })}
        style={styles.kav}
      >
        <View style={styles.centerWrap}>
          <Text style={styles.welcome}>Welcome back, Fanuc.</Text>

          <View style={styles.card}>
            <FloatingLabelInput
              label="Username or Email"
              icon={<Ionicons name="person-outline" size={20} color={MUTED} />}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="next"
            />

            <FloatingLabelInput
              label="Password"
              icon={<MaterialCommunityIcons name="lock-outline" size={20} color={MUTED} />}
              value={pwd}
              onChangeText={setPwd}
              secureTextEntry={!showPwd}
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
    </SafeAreaView>
  );
};

export default LoginScreen;

/* ----------------------- Floating Label Input ----------------------- */
type FProps = React.ComponentProps<typeof TextInput> & {
  label: string;
  icon?: React.ReactNode;
  rightAdornment?: React.ReactNode;
};

const FloatingLabelInput: React.FC<FProps> = ({
  label,
  icon,
  rightAdornment,
  value,
  style,
  onFocus,
  onBlur,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const hasText = !!value && String(value).length > 0;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: focused || hasText ? 1 : 0,
      duration: 150,
      useNativeDriver: false,
    }).start();
  }, [focused, hasText, anim]);

  const labelTop = anim.interpolate({ inputRange: [0, 1], outputRange: [16, 6] });
  const labelFont = anim.interpolate({ inputRange: [0, 1], outputRange: [15, 12] });
  const labelColor = anim.interpolate({ inputRange: [0, 1], outputRange: [MUTED, "#6B7280"] });

  const borderColor = focused ? PRIMARY_YELLOW : FIELD_BORDER;

  return (
    <View style={{ gap: 6 }}>
      <View style={[styles.field, { borderColor }]}>
        {icon ? <View style={{ marginRight: 8 }}>{icon}</View> : null}
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Animated.Text
            pointerEvents="none"
            style={{
              position: "absolute",
              left: 0,
              top: labelTop as unknown as number,
              fontSize: labelFont as unknown as number,
              color: labelColor as unknown as string,
            }}
          >
            {label}
          </Animated.Text>
          <TextInput
            {...rest}
            value={value}
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
  input: { flex: 1, fontSize: 15, color: ACCENT, paddingTop: 16, paddingBottom: 6 },
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
});

// UploadAttachmentsModal.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as SecureStore from "expo-secure-store";

type AttachmentItem = {
  name: string;
  uri: string;
  mimeType?: string | null;
  size?: number | null;
  description: string;
  status: "ready" | "uploading" | "uploaded" | "failed";
  error?: string;
};

type Props = {
  visible: boolean;
  saleOrderNumber: string | null;
  onClose: () => void;
  /** optional: called after ALL files reach uploaded status */
  onUploaded?: () => void;
};

// ---- API config (adjust if needed) ----
const BASE_URL = "https://fanuc.goval.app:444/api";
const ORDER_ATTACH_URL = `${BASE_URL}/user-dashboard/orders/son/{SO_NUMBER}/attachments`; // <— change if your API differs
const AUTH_KEY = "authToken"; // where you stored the JWT/Token in SecureStore

// ---- Colors shared with the rest of your app ----
const C = {
  pageBg: "#F7F7F8",
  headerText: "#0B0F19",
  subText: "#667085",
  card: "#FFFFFF",
  border: "#E5E7EB",
  icon: "#111827",
  primary: "#0A7AFF",
  primaryBtnText: "#FFFFFF",
  danger: "#DC2626",
  success: "#16A34A",
};

const UploadAttachmentsModal: React.FC<Props> = ({
  visible,
  saleOrderNumber,
  onClose,
  onUploaded,
}) => {
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [uploading, setUploading] = useState(false);

  const hasItems = attachments.length > 0;

  const titleText = useMemo(
    () => `Upload Attachments for SO ${saleOrderNumber ?? ""}`,
    [saleOrderNumber]
  );

  const closeUploadModal = () => {
    if (uploading) return;
    onClose();
  };

  const addAttachment = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: "*/*",
      });

      if (res.canceled) return;

      const picked = res.assets?.map<AttachmentItem>((a) => ({
        name: a.name ?? "attachment",
        uri: a.uri,
        mimeType: a.mimeType ?? undefined,
        size: a.size ?? undefined,
        description: "",
        status: "ready",
      })) ?? [];

      setAttachments((prev) => [...prev, ...picked]);
    } catch (e: any) {
      Alert.alert("Picker Error", e?.message ?? "Failed to pick file(s).");
    }
  };

  const updateDescription = (index: number, text: string) => {
    setAttachments((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], description: text };
      return copy;
    });
  };

  const removeAttachment = (index: number) => {
    if (uploading) return;
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const uploadSingle = async (item: AttachmentItem, idx: number) => {
    // Swap SO into URL
    const url = ORDER_ATTACH_URL.replace("{SO_NUMBER}", String(saleOrderNumber ?? ""));

    // Read auth token (adjust if you use a different key/header)
    const token = (await SecureStore.getItemAsync(AUTH_KEY)) ?? "";

    const form = new FormData();
    // Backend field names: adjust if your API expects different keys
    form.append("description", item.description ?? "");
    // For React Native fetch, file part needs a special object:
    // iOS requires explicit file extension in name for proper mime on server sometimes.
    const fileName =
      item.name ||
      `attachment${idx}${item.mimeType && item.mimeType.includes("/") ? "." + item.mimeType.split("/")[1] : ""}`;

    form.append("file", {
      // @ts-ignore — RN's FormData file typing
      uri: item.uri,
      name: fileName,
      type: item.mimeType || "application/octet-stream",
    });

    // If your API wants sale order number as a field too:
    form.append("saleOrderNumber", String(saleOrderNumber ?? ""));

    // Mark as uploading
    setAttachments((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], status: "uploading", error: undefined };
      return copy;
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        // Do NOT set 'Content-Type': multipart boundary is set by RN automatically
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form as any,
    });

    if (!res.ok) {
      let msg = "";
      try {
        const j = await res.json();
        msg = j?.message || j?.error || JSON.stringify(j);
      } catch {
        msg = await res.text();
      }
      throw new Error(msg || `Upload failed with status ${res.status}`);
    }
  };

  const handleUpload = async () => {
    if (!saleOrderNumber) {
      Alert.alert("Missing SO", "No Sales Order selected.");
      return;
    }
    if (!hasItems) {
      Alert.alert("No Attachments", "Please add at least one file to upload.");
      return;
    }

    setUploading(true);
    try {
      // sequential upload (safer for many servers). Change to Promise.all if your API supports parallel.
      for (let i = 0; i < attachments.length; i++) {
        const item = attachments[i];
        try {
          await uploadSingle(item, i);
          // mark uploaded
          setAttachments((prev) => {
            const copy = [...prev];
            copy[i] = { ...copy[i], status: "uploaded", error: undefined };
            return copy;
          });
        } catch (err: any) {
          setAttachments((prev) => {
            const copy = [...prev];
            copy[i] = {
              ...copy[i],
              status: "failed",
              error: err?.message ?? "Upload failed",
            };
            return copy;
          });
        }
      }

      const allOk = attachments.every((a) => a.status === "uploaded" || a.status === "ready");
      if (allOk) {
        Alert.alert("Success", "All attachments uploaded.");
        onUploaded?.();
        // optional: auto-close and clear
        setAttachments([]);
        onClose();
      } else {
        const failedCount = attachments.filter((a) => a.status === "failed").length;
        Alert.alert("Partial Success", `${failedCount} attachment(s) failed. You can retry them.`);
      }
    } finally {
      setUploading(false);
    }
  };

  if (!visible) return null;

  return (
    <View style={uploadStyles.overlay}>
      <View style={uploadStyles.card}>
        <View style={uploadStyles.header}>
          <Text style={uploadStyles.title}>{titleText}</Text>
          <Pressable onPress={closeUploadModal} disabled={uploading}>
            <Ionicons name="close" size={22} color={C.headerText} />
          </Pressable>
        </View>

        <View style={uploadStyles.body}>
          <Pressable style={uploadStyles.addBtn} onPress={addAttachment} disabled={uploading}>
            <Ionicons name="attach-outline" size={20} color={C.primaryBtnText} />
            <Text style={uploadStyles.addText}>Add Attachment</Text>
          </Pressable>

          <View style={uploadStyles.tableHead}>
            <Text style={uploadStyles.headText}>Sl. No</Text>
            <Text style={uploadStyles.headText}>File Name</Text>
            <Text style={uploadStyles.headText}>Description</Text>
            <Text style={uploadStyles.headText}>Status</Text>
            <View style={{ width: 40 }} />
          </View>

          <FlatList
            data={attachments}
            keyExtractor={(_, i) => i.toString()}
            renderItem={({ item, index }) => (
              <View style={uploadStyles.row}>
                <Text style={uploadStyles.cellText}>{index + 1}</Text>
                <Text style={[uploadStyles.cellText, { flex: 1 }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <TextInput
                  style={uploadStyles.descInput}
                  value={item.description}
                  onChangeText={(t) => updateDescription(index, t)}
                  placeholder="Description"
                  placeholderTextColor={C.subText}
                  editable={!uploading}
                />
                <Text
                  style={[
                    uploadStyles.cellText,
                    {
                      color:
                        item.status === "uploaded"
                          ? C.success
                          : item.status === "failed"
                          ? C.danger
                          : C.icon,
                    },
                  ]}
                >
                  {item.status}
                </Text>
                <Pressable
                  style={uploadStyles.removeBtn}
                  onPress={() => removeAttachment(index)}
                  disabled={uploading}
                >
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                </Pressable>
              </View>
            )}
            ListEmptyComponent={<Text style={uploadStyles.empty}>No attachments added.</Text>}
            contentContainerStyle={!hasItems ? { flexGrow: 1, justifyContent: "center" } : undefined}
          />
        </View>

        <View style={uploadStyles.footer}>
          <Pressable
            style={[
              uploadStyles.uploadBtn,
              { opacity: uploading || !hasItems ? 0.6 : 1 },
            ]}
            onPress={handleUpload}
            disabled={uploading || !hasItems}
          >
            {uploading ? (
              <ActivityIndicator color={C.primaryBtnText} />
            ) : (
              <Text style={uploadStyles.uploadText}>Upload</Text>
            )}
          </Pressable>
        </View>
      </View>
    </View>
  );
};

export default UploadAttachmentsModal;

const uploadStyles = StyleSheet.create({
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  card: {
    width: "100%",
    maxWidth: 720,
    backgroundColor: C.card,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: C.border,
    overflow: "hidden",
  },
  header: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  title: { fontSize: 16, color: C.headerText, fontWeight: "600" },
  body: { padding: 12, gap: 12 },
  addBtn: {
    alignSelf: "flex-start",
    backgroundColor: C.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  addText: { color: C.primaryBtnText, fontWeight: "600" },
  tableHead: {
    flexDirection: "row",
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: "#F3F4F6",
    borderRadius: 6,
    alignItems: "center",
    gap: 8,
  },
  headText: {
    flex: 1,
    fontSize: 12,
    color: C.subText,
    fontWeight: "600",
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: 8,
  },
  cellText: { width: 56, fontSize: 12, color: C.icon },
  descInput: {
    flex: 1,
    height: 36,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 12,
    color: C.icon,
  },
  removeBtn: {
    width: 40,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  empty: {
    textAlign: "center",
    color: C.subText,
    paddingVertical: 24,
  },
  footer: {
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    alignItems: "flex-end",
  },
  uploadBtn: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  uploadText: { color: C.primaryBtnText, fontWeight: "700" },
});

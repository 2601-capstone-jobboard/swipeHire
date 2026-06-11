import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { api, type OutreachDraft } from "../lib/api";
import { space, radius, font, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";

export function OutreachModal({
  jobId,
  visible,
  onClose,
}: {
  jobId: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [loading, setLoading] = useState(false);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!visible || !jobId) return;
    (async () => {
      setLoading(true);
      setDraft(null);
      try {
        const d = await api.getOutreachDraft(jobId);
        setDraft(d);
        setSubject(d.draft.subject);
        setBody(d.draft.body);
      } catch (err: any) {
        Alert.alert("Couldn't load draft", err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, jobId]);

  async function send() {
    if (!jobId) return;
    setSending(true);
    try {
      const res = await api.sendOutreach(jobId, { subject, body });
      if (res.sent) {
        Alert.alert("Sent", "Your message is on its way to the recruiter.");
        onClose();
      } else {
        Alert.alert(
          "Saved as draft",
          res.note ?? res.error ?? "Sending isn't set up yet.",
        );
      }
    } catch (err: any) {
      Alert.alert("Couldn't send", err.message);
    } finally {
      setSending(false);
    }
  }

  const noRecruiter = draft && !draft.recruiter.email;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onClose} hitSlop={16} style={s.closeBtn}>
            <Text style={s.close}>✕ Cancel</Text>
          </TouchableOpacity>
          <Text style={s.header} numberOfLines={1}>
            Reach out
          </Text>
        </View>

        {loading ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={s.scroll}
            keyboardShouldPersistTaps="handled"
          >
            {draft && (
              <View style={s.toCard}>
                <Text style={s.toLabel}>To</Text>
                <Text style={s.toValue}>
                  {draft.recruiter.name ? `${draft.recruiter.name} · ` : ""}
                  {draft.recruiter.email ?? "No recruiter contact on file"}
                </Text>
              </View>
            )}

            {noRecruiter && (
              <Text style={s.warn}>
                This company doesn't have a recruiter contact yet, so this
                message can't be sent. You can still draft and copy it.
              </Text>
            )}

            {draft && !draft.sendingConfigured && !noRecruiter && (
              <Text style={s.warn}>
                Email sending isn't configured on the server — your message will
                be saved as a draft.
              </Text>
            )}

            <Text style={s.label}>Subject</Text>
            <TextInput
              style={s.input}
              value={subject}
              onChangeText={setSubject}
              maxLength={200}
            />

            <Text style={s.label}>Message</Text>
            <TextInput
              style={[s.input, s.inputMultiline]}
              value={body}
              onChangeText={setBody}
              multiline
              maxLength={8000}
            />

            <TouchableOpacity
              style={[s.sendBtn, (sending || noRecruiter) && s.btnDisabled]}
              onPress={send}
              disabled={sending || Boolean(noRecruiter)}
            >
              <Text style={s.sendBtnText}>
                {sending
                  ? "Sending…"
                  : draft?.canSend
                    ? "Send message"
                    : "Save draft"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      paddingHorizontal: space.xl,
      paddingTop: 56,
      paddingBottom: space.md,
      backgroundColor: theme.card,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.border,
    },
    header: { ...font.title3, flex: 1, color: theme.text },
    closeBtn: { paddingVertical: 6, paddingRight: 6 },
    close: { ...font.body, color: theme.primary, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: space.lg, gap: space.sm },
    toCard: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: radius.md,
      padding: space.lg,
      marginBottom: space.xs,
      ...shadow.card,
    },
    toLabel: {
      ...font.caption,
      color: theme.secondaryText,
      textTransform: "uppercase",
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    toValue: { ...font.callout, color: theme.text, marginTop: 2 },
    warn: {
      backgroundColor: theme.mode === "dark" ? "#3D2C0A" : "#FEF3C7",
      color: theme.mode === "dark" ? "#FCD34D" : "#9A6200",
      padding: space.md,
      borderRadius: radius.sm,
      ...font.footnote,
      lineHeight: 19,
    },
    label: {
      ...font.footnote,
      fontWeight: "600",
      color: theme.secondaryText,
      marginTop: space.md,
      marginBottom: space.xs,
    },
    input: {
      backgroundColor: theme.card,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: radius.sm,
      padding: space.md,
      fontSize: 15,
      color: theme.text,
    },
    inputMultiline: { minHeight: 220, textAlignVertical: "top" },
    sendBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 15,
      borderRadius: radius.md,
      alignItems: "center",
      marginTop: space.lg,
    },
    sendBtnText: { ...font.headline, color: "#fff" },
    btnDisabled: { opacity: 0.45 },
  });

import { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { api, type User } from "../lib/api";
import { space, radius, font, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
import { Switch } from "react-native";

export function SettingsModal({
  visible,
  email,
  onClose,
  onEmailChanged,
  onSignOut,
}: {
  visible: boolean;
  email: string;
  onClose: () => void;
  onEmailChanged: (user: User) => void;
  onSignOut: () => void | Promise<void>;
}) {
  const { theme, themeMode, toggleTheme } = useTheme();
  const s = createStyles(theme);
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);
  const [savingPw, setSavingPw] = useState(false);
  const [resumeText, setResumeText] = useState("");
  const [resumeStatus, setResumeStatus] = useState<string | null>(null);
  const [savingResume, setSavingResume] = useState(false);

  useEffect(() => {
    if (visible) {
      setNewEmail("");
      setEmailPassword("");
      setCurrentPw("");
      setNewPw("");
      setResumeText("");
      api
        .getResume()
        .then((r) =>
          setResumeStatus(
            r.hasResume ? `Resume on file · ${r.keywordCount} keywords` : null,
          ),
        )
        .catch(() => setResumeStatus(null));
    }
  }, [visible]);

  async function saveResume() {
    if (resumeText.trim().length < 50) {
      Alert.alert(
        "Resume too short",
        "Paste your full resume text (at least 50 characters).",
      );
      return;
    }
    setSavingResume(true);
    try {
      const res = await api.saveResume(resumeText.trim());
      setResumeStatus(`Resume on file · ${res.keywordCount} keywords`);
      setResumeText("");
      Alert.alert(
        "Resume scanned",
        `Extracted ${res.keywordCount} keywords. Your feed is now matched against your resume.`,
      );
    } catch (err: any) {
      Alert.alert("Couldn't save resume", err.message);
    } finally {
      setSavingResume(false);
    }
  }

  async function saveEmail() {
    if (!newEmail.trim() || !emailPassword) {
      Alert.alert("Missing info", "Enter your new email and current password.");
      return;
    }
    setSavingEmail(true);
    try {
      const res = await api.updateEmail(emailPassword, newEmail.trim());
      onEmailChanged(res.user);
      setNewEmail("");
      setEmailPassword("");
      Alert.alert("Email updated", "Your email has been changed.");
    } catch (err: any) {
      Alert.alert("Couldn't update email", err.message);
    } finally {
      setSavingEmail(false);
    }
  }

  async function savePassword() {
    if (!currentPw || newPw.length < 8) {
      Alert.alert(
        "Check your input",
        "New password must be at least 8 characters.",
      );
      return;
    }
    setSavingPw(true);
    try {
      await api.updatePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      Alert.alert(
        "Password changed",
        "Use your new password next time you log in.",
      );
    } catch (err: any) {
      Alert.alert("Couldn't change password", err.message);
    } finally {
      setSavingPw(false);
    }
  }

  function confirmDelete() {
    Alert.alert(
      "Delete account?",
      "This permanently deletes your account, saved jobs, and reviews. This can't be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api.deleteAccount();
            } catch (err: any) {
              Alert.alert("Couldn't delete account", err.message);
              return;
            }
            await onSignOut();
          },
        },
      ],
    );
  }
  //dark mode toggle UI
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.header}>
          <TouchableOpacity onPress={onClose} hitSlop={16}>
            <Text style={s.close}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={s.title}>Account</Text>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={s.signedInLabel}>Signed in as</Text>
          <Text style={s.signedInEmail}>{email}</Text>

          <Text style={s.section}>Appearance</Text>

          <View style={s.card}>
            <View style={s.themeRow}>
              <View>
                <Text style={s.themeTitle}>Dark mode</Text>

                <Text style={s.themeSub}>
                  Switch between light and dark theme
                </Text>
              </View>

              <Switch
                value={themeMode === "dark"}
                onValueChange={toggleTheme}
                trackColor={{
                  false: "#D1D5DB",
                  true: theme.primary,
                }}
                thumbColor="#fff"
              />
            </View>
          </View>

          {/* Resume (powers SmartFeed's scanner layer) */}
          <Text style={s.section}>Resume</Text>
          <View style={s.card}>
            {resumeStatus ? (
              <Text style={s.resumeStatus}>✓ {resumeStatus}</Text>
            ) : (
              <Text style={s.resumeHint}>
                Paste your resume and we'll match jobs against it. Your swipes
                refine it from there.
              </Text>
            )}
            <TextInput
              style={[s.input, s.resumeInput]}
              placeholder="Paste your resume text here…"
              placeholderTextColor={theme.secondaryText}
              value={resumeText}
              onChangeText={setResumeText}
              multiline
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingResume && s.btnDisabled]}
              onPress={saveResume}
              disabled={savingResume}
            >
              <Text style={s.primaryBtnText}>
                {savingResume
                  ? "Scanning…"
                  : resumeStatus
                    ? "Replace resume"
                    : "Scan resume"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Email */}
          <Text style={s.section}>Change email</Text>
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="New email"
              placeholderTextColor={theme.secondaryText}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
            />
            <TextInput
              style={s.input}
              placeholder="Current password"
              placeholderTextColor={theme.secondaryText}
              value={emailPassword}
              onChangeText={setEmailPassword}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingEmail && s.btnDisabled]}
              onPress={saveEmail}
              disabled={savingEmail}
            >
              <Text style={s.primaryBtnText}>
                {savingEmail ? "Updating…" : "Update email"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Password */}
          <Text style={s.section}>Change password</Text>
          <View style={s.card}>
            <TextInput
              style={s.input}
              placeholder="Current password"
              placeholderTextColor={theme.secondaryText}
              value={currentPw}
              onChangeText={setCurrentPw}
              secureTextEntry
            />
            <TextInput
              style={s.input}
              placeholder="New password (min 8 characters)"
              placeholderTextColor={theme.secondaryText}
              value={newPw}
              onChangeText={setNewPw}
              secureTextEntry
            />
            <TouchableOpacity
              style={[s.primaryBtn, savingPw && s.btnDisabled]}
              onPress={savePassword}
              disabled={savingPw}
            >
              <Text style={s.primaryBtnText}>
                {savingPw ? "Saving…" : "Change password"}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Session */}
          <TouchableOpacity style={s.logoutBtn} onPress={() => onSignOut()}>
            <Text style={s.logoutText}>Log out</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
            <Text style={s.deleteText}>Delete account</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    header: {
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
    title: { ...font.title3, color: theme.text, flex: 1 },
    close: { ...font.body, color: theme.primary, fontWeight: "600" },
    scroll: { padding: space.lg },
    signedInLabel: {
      ...font.caption,
      color: theme.secondaryText,
      textTransform: "uppercase",
      fontWeight: "700",
      letterSpacing: 0.4,
    },
    signedInEmail: { ...font.headline, color: theme.text, marginTop: 2 },
    section: {
      ...font.footnote,
      fontWeight: "600",
      color: theme.secondaryText,
      textTransform: "uppercase",
      letterSpacing: 0.4,
      marginTop: space.xxl,
      marginBottom: space.sm,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.sm,
      ...shadow.card,
    },
    resumeStatus: { ...font.footnote, color: "#22C55E", fontWeight: "600" },
    resumeHint: {
      ...font.footnote,
      color: theme.secondaryText,
      lineHeight: 18,
    },
    resumeInput: { minHeight: 120, textAlignVertical: "top" },
    input: {
      backgroundColor: theme.background,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: theme.border,
      borderRadius: radius.sm,
      paddingHorizontal: space.md,
      paddingVertical: 12,
      fontSize: 15,
      color: theme.text,
    },
    primaryBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 13,
      borderRadius: radius.sm,
      alignItems: "center",
      marginTop: space.xs,
    },
    primaryBtnText: { ...font.subhead, color: "#fff", fontWeight: "600" },
    btnDisabled: { opacity: 0.5 },
    logoutBtn: {
      backgroundColor: theme.card,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: "center",
      marginTop: space.xxl,
      ...shadow.card,
    },
    logoutText: { ...font.headline, color: theme.primary },
    deleteBtn: {
      paddingVertical: 14,
      alignItems: "center",
      marginTop: space.sm,
    },
    deleteText: { ...font.subhead, color: theme.danger, fontWeight: "600" },
    themeRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    themeTitle: { ...font.headline, color: theme.text },
    themeSub: { ...font.footnote, color: theme.secondaryText, marginTop: 2 },
  });

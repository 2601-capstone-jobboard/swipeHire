import { useState, useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Linking,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { api, type SavedJob, type TrackStatus } from "../lib/api";
import { OutreachModal } from "../components/OutreachModal";
import { JobDetailModal } from "../components/JobDetailModal";
import { Avatar } from "../components/Avatar";
import { space, radius, font, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";

// Application pipeline stages and their badge styling.
const STATUS_ORDER: TrackStatus[] = [
  "saved",
  "applied",
  "screening",
  "interview",
  "accepted",
  "rejected",
];

const getStatusMeta = (theme: any) => ({
  saved: { label: "Saved", bg: theme.card, fg: theme.secondaryText },

  applied: {
    label: "Applied",
    bg: theme.mode === "dark" ? "#1E3A8A" : "#DBEAFE",
    fg: theme.primary,
  },

  screening: {
    label: "Screening",
    bg: theme.mode === "dark" ? "#3D2C0A" : "#FEF3C7",
    fg: "#9A6200",
  },

  interview: {
    label: "Interview",
    bg: theme.mode === "dark" ? "#312E81" : "#EEEDFD",
    fg: "#5E5CE6",
  },

  accepted: {
    label: "Accepted",
    bg: theme.mode === "dark" ? "#16331D" : "#DCFCE7",
    fg: "#22C55E",
  },

  rejected: {
    label: "Rejected",
    bg: theme.mode === "dark" ? "#3B1212" : "#FEE2E2",
    fg: theme.danger,
  },
});

export function SavedScreen() {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const STATUS_META = getStatusMeta(theme);
  const [items, setItems] = useState<SavedJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const [outreachJobId, setOutreachJobId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getSaved();
      setItems(res.items);
    } catch (err) {
      console.warn("Failed to load saved jobs:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      load();
    }, [load]),
  );

  function onRefresh() {
    setRefreshing(true);
    load();
  }

  function setStatus(jobId: string, status: TrackStatus) {
    // Optimistic update; reload on failure.
    setItems((prev) =>
      prev.map((j) => (j.id === jobId ? { ...j, trackStatus: status } : j)),
    );
    api.setTrackStatus(jobId, status).catch((err: any) => {
      Alert.alert("Couldn't update status", err.message);
      load();
    });
  }

  function openStatusPicker(item: SavedJob) {
    Alert.alert("Application status", item.title, [
      ...STATUS_ORDER.map((st) => ({
        text: (st === item.trackStatus ? "✓ " : "") + STATUS_META[st].label,
        onPress: () => setStatus(item.id, st),
      })),
      { text: "Cancel", style: "cancel" as const },
    ]);
  }

  function handleUnsave(jobId: string) {
    Alert.alert(
      "Remove saved job?",
      "This job will no longer appear in your saved list.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            // Optimistic removal.
            setItems((prev) => prev.filter((j) => j.id !== jobId));
            try {
              await api.unsave(jobId);
            } catch (err: any) {
              Alert.alert("Couldn't unsave", err.message);
              load();
            }
          },
        },
      ],
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (items.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.emptyEmoji}>🔖</Text>
        <Text style={s.emptyTitle}>No saved jobs yet</Text>
        <Text style={s.emptySubtitle}>
          Swipe right on roles you like in Discover and they'll appear here.
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListHeaderComponent={
          <View style={s.headerBlock}>
            <Text style={s.header}>Saved</Text>
            <Text style={s.headerCount}>
              {items.length} role{items.length === 1 ? "" : "s"}
            </Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.primary}
          />
        }
        renderItem={({ item }) => {
          // Defensive: fall back to "saved" if the API hasn't been migrated yet.
          const meta = STATUS_META[item.trackStatus] ?? STATUS_META.saved;
          return (
            <Pressable style={s.card} onPress={() => setDetailJobId(item.id)}>
              <View style={s.cardHeaderRow}>
                <Avatar
                  name={item.company}
                  logoUrl={item.companyLogoUrl}
                  size={40}
                />
                <View style={s.cardHeaderText}>
                  <Text style={s.cardCompany}>{item.company}</Text>
                  {item.companyRating != null && item.companyReviewCount > 0 ? (
                    <Text style={s.cardRating}>
                      <Text style={s.cardRatingStar}>★ </Text>
                      {item.companyRating.toFixed(1)} ·{" "}
                      {item.companyReviewCount}
                    </Text>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[s.statusBadge, { backgroundColor: meta.bg }]}
                  onPress={(e) => {
                    e.stopPropagation();
                    openStatusPicker(item);
                  }}
                  hitSlop={6}
                >
                  <Text style={[s.statusBadgeText, { color: meta.fg }]}>
                    {meta.label}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={s.cardTitle}>{item.title}</Text>
              <View style={s.metaRow}>
                {item.location ? (
                  <Text style={s.cardLocation}>{item.location}</Text>
                ) : null}
                {item.salary ? (
                  <Text style={s.cardSalary}>{item.salary}</Text>
                ) : null}
              </View>

              <Text style={s.expandHint}>
                Tap for details, reviews & salary
              </Text>

              <TouchableOpacity
                style={s.applyButton}
                activeOpacity={0.85}
                onPress={(e) => {
                  e.stopPropagation();
                  Linking.openURL(item.applyUrl);
                  // First tap on Apply moves the job into the "Applied" stage.
                  if (item.trackStatus === "saved")
                    setStatus(item.id, "applied");
                }}
              >
                <Text style={s.applyButtonText}>Apply on company site</Text>
              </TouchableOpacity>

              <View style={s.secondaryRow}>
                <TouchableOpacity
                  style={s.secondaryBtn}
                  onPress={(e) => {
                    e.stopPropagation();
                    setOutreachJobId(item.id);
                  }}
                >
                  <Text style={s.secondaryBtnText}>Reach out</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.secondaryBtn, s.unsaveBtn]}
                  onPress={(e) => {
                    e.stopPropagation();
                    handleUnsave(item.id);
                  }}
                >
                  <Text style={[s.secondaryBtnText, s.unsaveText]}>Unsave</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          );
        }}
      />

      <OutreachModal
        jobId={outreachJobId}
        visible={outreachJobId !== null}
        onClose={() => setOutreachJobId(null)}
      />
      <JobDetailModal
        jobId={detailJobId}
        visible={detailJobId !== null}
        onClose={() => setDetailJobId(null)}
      />
    </SafeAreaView>
  );
}

const createStyles = (theme: any) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      padding: space.xxl,
      backgroundColor: theme.background,
    },
    emptyEmoji: { fontSize: 44, marginBottom: space.md },
    list: { paddingHorizontal: space.lg, paddingBottom: space.xxl },
    headerBlock: { paddingTop: space.sm, paddingBottom: space.lg },
    header: { ...font.largeTitle, color: theme.text },
    headerCount: { ...font.subhead, color: theme.secondaryText, marginTop: 2 },
    card: {
      backgroundColor: theme.card,
      borderRadius: radius.lg,
      padding: space.lg,
      marginBottom: space.md,
      ...shadow.card,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginBottom: space.md,
    },
    cardHeaderText: { flex: 1, gap: 1 },
    cardCompany: {
      ...font.caption,
      fontWeight: "700",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cardRating: {
      ...font.caption,
      color: theme.secondaryText,
      fontWeight: "600",
    },
    cardRatingStar: { color: "#FBBF24" },
    statusBadge: {
      paddingHorizontal: space.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
    },
    statusBadgeText: { ...font.caption, fontWeight: "700" },
    cardTitle: { ...font.title3, color: theme.text, marginBottom: space.sm },
    metaRow: {
      flexDirection: "row",
      alignItems: "center",
      flexWrap: "wrap",
      gap: space.md,
      marginBottom: space.md,
    },
    cardLocation: { ...font.footnote, color: theme.secondaryText },
    cardSalary: {
      ...font.footnote,
      color: theme.secondaryText,
      fontWeight: "600",
    },
    expandHint: {
      ...font.caption,
      color: theme.secondaryText,
      marginBottom: space.md,
    },
    applyButton: {
      backgroundColor: theme.primary,
      paddingVertical: 12,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    applyButtonText: { ...font.subhead, color: "#FFF", fontWeight: "600" },
    secondaryRow: { flexDirection: "row", gap: space.sm, marginTop: space.sm },
    secondaryBtn: {
      flex: 1,
      paddingVertical: 11,
      borderRadius: radius.sm,
      alignItems: "center",
      backgroundColor: theme.card,
    },
    secondaryBtnText: {
      ...font.footnote,
      color: theme.primary,
      fontWeight: "600",
    },
    unsaveBtn: {
      backgroundColor: theme.mode === "dark" ? "#3B1212" : "#FEE2E2",
    },
    unsaveText: { color: theme.danger },
    emptyTitle: { ...font.title2, color: theme.text, marginBottom: space.xs },
    emptySubtitle: {
      ...font.subhead,
      color: theme.secondaryText,
      textAlign: "center",
      lineHeight: 21,
    },
  });

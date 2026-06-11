import { useState, useEffect, useCallback } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Pressable,
  Linking,
  useWindowDimensions,
} from "react-native";
import RenderHTML from "react-native-render-html";
import { api, type JobDetail, type ReviewsResponse } from "../lib/api";
import { OutreachModal } from "./OutreachModal";
import { Avatar } from "./Avatar";
import { space, radius, font, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";

function Stars({
  value,
  size = 16,
  theme,
}: {
  value: number;
  size?: number;
  theme: any;
}) {
  return (
    <Text
      style={{
        fontSize: size,
        color: "#FBBF24",
        letterSpacing: 1,
      }}
    >
      {"★★★★★".slice(0, value)}

      <Text
        style={{
          color: theme.border,
        }}
      >
        {"★★★★★".slice(value)}
      </Text>
    </Text>
  );
}

export function JobDetailModal({
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
  const { width } = useWindowDimensions();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [reviews, setReviews] = useState<ReviewsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [outreachOpen, setOutreachOpen] = useState(false);

  // Review compose
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const loadReviews = useCallback(async () => {
    if (!jobId) return;
    try {
      setReviews(await api.getReviews(jobId));
    } catch (err: any) {
      console.warn("reviews load failed", err.message);
    }
  }, [jobId]);

  useEffect(() => {
    if (!visible || !jobId) return;
    setJob(null);
    setReviews(null);
    setRating(0);
    setTitle("");
    setBody("");
    setLoading(true);
    (async () => {
      try {
        const [j] = await Promise.all([api.getJob(jobId), loadReviews()]);
        setJob(j);
      } catch (err: any) {
        Alert.alert("Couldn't load job", err.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [visible, jobId, loadReviews]);

  async function submitReview() {
    if (!jobId || rating === 0) {
      Alert.alert("Pick a rating", "Tap a star to rate this company first.");
      return;
    }
    setSubmitting(true);
    try {
      await api.submitReview(jobId, {
        rating,
        title: title.trim() || undefined,
        body: body.trim() || undefined,
      });
      setTitle("");
      setBody("");
      setRating(0);
      await loadReviews();
    } catch (err: any) {
      Alert.alert("Couldn't submit review", err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const recruiter = job?.recruiter;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={s.container}>
        <View style={s.headerRow}>
          <TouchableOpacity onPress={onClose} hitSlop={16} style={s.closeBtn}>
            <Text style={s.close}>✕ Close</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle} numberOfLines={1}>
            {job ? job.company : "Job details"}
          </Text>
        </View>

        {loading || !job ? (
          <View style={s.center}>
            <ActivityIndicator size="large" color={theme.primary} />
          </View>
        ) : (
          <ScrollView contentContainerStyle={s.scroll}>
            {/* Title block */}
            <View style={s.titleRow}>
              <Avatar
                name={job.company}
                logoUrl={job.companyLogoUrl}
                size={52}
              />
              <Text style={s.company}>{job.company}</Text>
            </View>
            <Text style={s.title}>{job.title}</Text>
            {job.location ? (
              <Text style={s.meta}>📍 {job.location}</Text>
            ) : null}
            <View style={s.chipRow}>
              {job.employmentType ? (
                <Text style={s.chip}>
                  {job.employmentType.replace("_", " ")}
                </Text>
              ) : null}
              {job.remote ? <Text style={s.chip}>Remote</Text> : null}
            </View>

            {/* Salary */}
            <View style={s.salaryCard}>
              <Text style={s.salaryLabel}>Salary</Text>
              <Text style={s.salaryValue}>{job.salary ?? "Not disclosed"}</Text>
            </View>

            <TouchableOpacity
              style={s.applyButton}
              onPress={() => Linking.openURL(job.applyUrl)}
            >
              <Text style={s.applyButtonText}>Apply on company site →</Text>
            </TouchableOpacity>

            {/* Recruiter */}
            <Text style={s.sectionTitle}>Recruiter</Text>
            <View style={s.recruiterCard}>
              {recruiter?.email ? (
                <>
                  <Text style={s.recruiterName}>
                    {recruiter.name ?? "Recruiting team"}
                    {recruiter.title ? ` · ${recruiter.title}` : ""}
                  </Text>
                  <Text style={s.recruiterEmail}>{recruiter.email}</Text>
                </>
              ) : (
                <Text style={s.recruiterEmpty}>
                  No recruiter contact on file yet.
                </Text>
              )}
              <TouchableOpacity
                style={[s.reachBtn, !recruiter?.email && s.reachBtnMuted]}
                onPress={() => setOutreachOpen(true)}
              >
                <Text style={s.reachBtnText}>Reach out</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={s.sectionTitle}>Description</Text>
            <View style={s.descCard}>
              {job.descriptionHtml ? (
                <RenderHTML
                  contentWidth={width - 64}
                  source={{ html: job.descriptionHtml }}
                  baseStyle={s.descText}
                  tagsStyles={htmlTagStyles(theme)}
                />
              ) : (
                <Text style={s.recruiterEmpty}>No description provided.</Text>
              )}
            </View>

            {/* Reviews */}
            <Text style={s.sectionTitle}>
              Reviews
              {reviews && reviews.summary.count > 0
                ? `  ·  ${reviews.summary.averageRating?.toFixed(1)} (${reviews.summary.count})`
                : ""}
            </Text>

            <View style={s.composeCard}>
              <Text style={s.composeTitle}>Rate this company</Text>
              <View style={s.starsPickerRow}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable key={n} onPress={() => setRating(n)} hitSlop={6}>
                    <Text style={[s.pickStar, n <= rating && s.pickStarOn]}>
                      ★
                    </Text>
                  </Pressable>
                ))}
              </View>
              <TextInput
                style={s.input}
                placeholder="Title (optional)"
                placeholderTextColor={theme.secondaryText}
                value={title}
                onChangeText={setTitle}
                maxLength={120}
              />
              <TextInput
                style={[s.input, s.inputMultiline]}
                placeholder="Share your experience (optional)"
                placeholderTextColor={theme.secondaryText}
                value={body}
                onChangeText={setBody}
                multiline
                maxLength={4000}
              />
              <TouchableOpacity
                style={[s.submitBtn, submitting && s.btnDisabled]}
                onPress={submitReview}
                disabled={submitting}
              >
                <Text style={s.submitBtnText}>
                  {submitting ? "Submitting…" : "Submit review"}
                </Text>
              </TouchableOpacity>
            </View>

            {reviews?.reviews.length === 0 && (
              <Text style={s.empty}>No reviews yet. Be the first!</Text>
            )}
            {reviews?.reviews.map((r) => (
              <View key={r.id} style={s.reviewCard}>
                <View style={s.reviewHead}>
                  <Stars value={r.rating} theme={theme} />
                  <Text style={s.badge}>
                    {r.source === "glassdoor"
                      ? "Glassdoor"
                      : r.isMine
                        ? "You"
                        : "SwipeHire"}
                  </Text>
                </View>
                {r.title ? <Text style={s.reviewTitle}>{r.title}</Text> : null}
                {r.authorTitle ? (
                  <Text style={s.reviewAuthor}>{r.authorTitle}</Text>
                ) : null}
                {r.body ? <Text style={s.reviewBody}>{r.body}</Text> : null}
                {r.pros ? <Text style={s.pros}>＋ {r.pros}</Text> : null}
                {r.cons ? <Text style={s.cons}>－ {r.cons}</Text> : null}
              </View>
            ))}

            <View style={{ height: 40 }} />
          </ScrollView>
        )}

        <OutreachModal
          jobId={outreachOpen ? jobId : null}
          visible={outreachOpen}
          onClose={() => setOutreachOpen(false)}
        />
      </View>
    </Modal>
  );
}

const htmlTagStyles = (theme: any) => ({
  p: {
    marginBottom: 10,
    fontSize: 15,
    lineHeight: 22,
    color: theme.secondaryText,
  },
  li: {
    marginBottom: 6,
    fontSize: 15,
    lineHeight: 22,
    color: theme.secondaryText,
  },
  strong: { fontWeight: "600" as const, color: theme.text },
  b: { fontWeight: "600" as const, color: theme.text },
  h1: {
    fontSize: 18,
    fontWeight: "700" as const,
    marginVertical: 8,
    color: theme.text,
  },
  h2: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginVertical: 8,
    color: theme.text,
  },
  h3: {
    fontSize: 15,
    fontWeight: "700" as const,
    marginVertical: 6,
    color: theme.text,
  },
  a: { color: theme.primary },
});

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
    headerTitle: { ...font.headline, flex: 1, color: theme.text },
    closeBtn: { paddingVertical: 6, paddingRight: 6 },
    close: { ...font.body, color: theme.primary, fontWeight: "600" },
    center: { flex: 1, justifyContent: "center", alignItems: "center" },
    scroll: { padding: space.lg },

    titleRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginBottom: space.md,
    },
    company: {
      ...font.footnote,
      fontWeight: "700",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
      flex: 1,
    },
    title: {
      ...font.title1,
      color: theme.text,
      marginTop: space.xs,
      marginBottom: space.sm,
    },
    meta: {
      ...font.subhead,
      color: theme.secondaryText,
      marginBottom: space.md,
    },
    chipRow: {
      flexDirection: "row",
      gap: space.sm,
      marginBottom: space.lg,
      flexWrap: "wrap",
    },
    chip: {
      ...font.caption,
      fontWeight: "600",
      color: theme.secondaryText,
      backgroundColor: theme.background,
      paddingHorizontal: space.md,
      paddingVertical: 5,
      borderRadius: radius.pill,
      textTransform: "capitalize",
      overflow: "hidden",
    },

    salaryCard: {
      backgroundColor: theme.mode === "dark" ? "#16331D" : "#DCFCE7",
      borderRadius: radius.md,
      padding: space.lg,
      marginBottom: space.md,
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    salaryLabel: { ...font.subhead, fontWeight: "600", color: "#22C55E" },
    salaryValue: {
      ...font.headline,
      color: theme.mode === "dark" ? "#86EFAC" : "#1E7A3D",
      flexShrink: 1,
      textAlign: "right",
    },

    applyButton: {
      backgroundColor: theme.primary,
      paddingVertical: 14,
      borderRadius: radius.md,
      alignItems: "center",
    },
    applyButtonText: { ...font.headline, color: "#FFF" },

    sectionTitle: {
      ...font.title3,
      color: theme.text,
      marginTop: space.xxl,
      marginBottom: space.md,
    },

    recruiterCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.xs,
      ...shadow.card,
    },
    recruiterName: { ...font.callout, fontWeight: "600", color: theme.text },
    recruiterEmail: { ...font.subhead, color: theme.primary },
    recruiterEmpty: { ...font.subhead, color: theme.secondaryText },
    reachBtn: {
      backgroundColor: theme.mode === "dark" ? "#172554" : "#DBEAFE",
      paddingVertical: 12,
      borderRadius: radius.sm,
      alignItems: "center",
      marginTop: space.md,
    },
    reachBtnMuted: { backgroundColor: theme.background },
    reachBtnText: { ...font.subhead, color: theme.primary, fontWeight: "600" },

    descCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: space.lg,
      ...shadow.card,
    },
    descText: { ...font.subhead, lineHeight: 22, color: theme.secondaryText },

    composeCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.md,
      ...shadow.card,
    },
    composeTitle: { ...font.headline, color: theme.text },
    starsPickerRow: { flexDirection: "row", gap: space.sm },
    pickStar: { fontSize: 36, color: theme.border },
    pickStarOn: { color: "#FBBF24" },
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
    inputMultiline: { minHeight: 90, textAlignVertical: "top" },
    submitBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 13,
      borderRadius: radius.sm,
      alignItems: "center",
    },
    submitBtnText: { ...font.subhead, color: "#fff", fontWeight: "600" },
    btnDisabled: { opacity: 0.5 },

    empty: {
      ...font.subhead,
      textAlign: "center",
      color: theme.secondaryText,
      marginTop: space.lg,
    },
    reviewCard: {
      backgroundColor: theme.card,
      borderRadius: radius.md,
      padding: space.lg,
      gap: space.sm,
      marginTop: space.md,
      ...shadow.card,
    },
    reviewHead: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    badge: {
      ...font.caption,
      color: theme.secondaryText,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    reviewTitle: { ...font.callout, fontWeight: "600", color: theme.text },
    reviewAuthor: { ...font.caption, color: theme.secondaryText },
    reviewBody: { ...font.subhead, color: theme.secondaryText, lineHeight: 22 },
    pros: { ...font.footnote, color: "#22C55E" },
    cons: { ...font.footnote, color: theme.danger },
  });

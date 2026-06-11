import { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  Alert,
  ActivityIndicator,
  TouchableOpacity,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Swiper from "react-native-deck-swiper";
import RenderHTML from "react-native-render-html";
import { api, type User, type Job } from "../lib/api";
import { JobDetailModal } from "../components/JobDetailModal";
import { Avatar } from "../components/Avatar";
//import { colors, space, radius, font, shadow } from "../theme";
//alan
import { space, radius, font, shadow } from "../theme";
import { useTheme } from "../context/ThemeContext";
//alan

export function DiscoverScreen({ user }: { user: User }) {
  const { theme } = useTheme();
  const s = createStyles(theme);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [empty, setEmpty] = useState(false);
  const [undoCount, setUndoCount] = useState(0);
  const [detailJobId, setDetailJobId] = useState<string | null>(null);
  const swiperRef = useRef<Swiper<Job>>(null);
  const undoingRef = useRef(false);
  const canUndo = undoCount > 0;

  useEffect(() => {
    loadFeed();
  }, []);

  async function loadFeed(cur?: string) {
    try {
      setLoading(true);
      const res = await api.getFeed(cur);
      if (res.items.length === 0 && !cur) {
        setEmpty(true);
      } else {
        setJobs((prev) => (cur ? [...prev, ...res.items] : res.items));
        setCursor(res.nextCursor);
      }
    } catch (err: any) {
      Alert.alert("Error loading jobs", err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSwipe(jobIndex: number, direction: "left" | "right") {
    const job = jobs[jobIndex];
    if (!job) return;
    setUndoCount((c) => c + 1);
    api.swipe(job.id, direction).catch((err) => {
      console.warn("Swipe failed:", err.message);
    });
  }

  // Swipe up opens the full detail page (description, salary, recruiter,
  // reviews), then restores the card so it isn't discarded.
  function handleSwipedTop(jobIndex: number) {
    const job = jobs[jobIndex];
    swiperRef.current?.swipeBack();
    if (job) setDetailJobId(job.id);
  }

  async function handleUndo() {
    // Step back one card at a time; stays available while there's history.
    if (undoCount === 0 || undoingRef.current) return;
    undoingRef.current = true;
    swiperRef.current?.swipeBack();
    setUndoCount((c) => Math.max(0, c - 1));
    try {
      await api.undoSwipe();
    } catch (err: any) {
      console.warn("Undo failed:", err.message);
    }
    // Brief lockout so a fast double-tap can't outrun the swipe-back animation.
    setTimeout(() => {
      undoingRef.current = false;
    }, 350);
  }
  if (loading && jobs.length === 0) {
    return (
      <SafeAreaView style={s.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  if (empty) {
    return (
      <SafeAreaView style={s.center}>
        <Text style={s.emptyEmoji}>🎉</Text>
        <Text style={s.emptyTitle}>You're all caught up</Text>
        <Text style={s.emptySubtitle}>Check back later for fresh roles.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.deckContainer} edges={["left", "right", "bottom"]}>
      <View style={s.topBar}>
        <TouchableOpacity
          style={[s.undoBtn, !canUndo && s.undoBtnDisabled]}
          onPress={handleUndo}
          disabled={!canUndo}
          hitSlop={8}
        >
          <Text style={[s.undoText, !canUndo && s.undoTextDisabled]}>
            ↺ Undo{undoCount > 1 ? ` (${undoCount})` : ""}
          </Text>
        </TouchableOpacity>
      </View>

      <View style={s.deck}>
        <Swiper
          ref={swiperRef}
          cards={jobs}
          renderCard={(job) =>
            job ? (
              <JobCard
                job={job}
                theme={theme}
                onDetails={() => setDetailJobId(job.id)}
              />
            ) : (
              <View style={s.card} />
            )
          }
          onSwipedLeft={(i) => handleSwipe(i, "left")}
          onSwipedRight={(i) => handleSwipe(i, "right")}
          onSwipedTop={(i) => handleSwipedTop(i)}
          onSwipedAll={() => {
            if (cursor) loadFeed(cursor);
            else setEmpty(true);
          }}
          cardIndex={0}
          backgroundColor="transparent"
          stackSize={3}
          stackSeparation={12}
          animateCardOpacity
          animateOverlayLabelsOpacity
          overlayLabels={getOverlayLabels(theme)}
          verticalSwipe
          disableBottomSwipe
        />
      </View>

      <JobDetailModal
        jobId={detailJobId}
        visible={detailJobId !== null}
        onClose={() => setDetailJobId(null)}
      />
    </SafeAreaView>
  );
}

function JobCard({
  job,
  onDetails,
  theme,
}: {
  job: Job;
  onDetails: () => void;
  theme: any;
}) {
  const { width } = useWindowDimensions();
  const s = createStyles(theme);

  return (
    <View style={s.card}>
      <View style={s.cardHeaderRow}>
        <Avatar name={job.company} logoUrl={job.companyLogoUrl} size={46} />
        <View style={s.cardHeaderText}>
          <Text style={s.cardCompany}>{job.company}</Text>
          {job.companyRating != null && job.companyReviewCount > 0 ? (
            <Text style={s.cardRating}>
              <Text style={s.cardRatingStar}>★ </Text>
              {job.companyRating.toFixed(1)} · {job.companyReviewCount} review
              {job.companyReviewCount === 1 ? "" : "s"}
            </Text>
          ) : null}
        </View>
      </View>
      <Text style={s.cardTitle}>{job.title}</Text>
      <View style={s.cardMetaRow}>
        {job.location ? (
          <Text style={s.cardLocation}>{job.location}</Text>
        ) : null}
        {job.remote ? (
          <View style={s.remotePill}>
            <Text style={s.remotePillText}>Remote</Text>
          </View>
        ) : null}
      </View>

      <View style={s.descriptionContainer} pointerEvents="none">
        {job.descriptionText ? (
          <RenderHTML
            contentWidth={width - 80}
            source={{ html: job.descriptionText }}
            baseStyle={s.cardDescription}
            tagsStyles={htmlTagStyles(theme)}
            defaultTextProps={{ selectable: false }}
          />
        ) : null}
        <View style={s.fade} pointerEvents="none" />
      </View>

      <TouchableOpacity
        style={s.actionBtn}
        onPress={onDetails}
        activeOpacity={0.7}
      >
        <Text style={s.actionBtnText}>View details, reviews & salary</Text>
      </TouchableOpacity>

      <Text style={s.cardHint}>
        Swipe ← pass · save → right · ↑ up for details
      </Text>
    </View>
  );
}

// Tinder-style stamps that fade in as you drag the card.
const stampBase = {
  fontSize: 30,
  fontWeight: "800" as const,
  borderWidth: 3,
  borderRadius: 12,
  paddingHorizontal: 14,
  paddingVertical: 4,
  overflow: "hidden" as const,
  backgroundColor: "rgba(255,255,255,0.9)",
};

const getOverlayLabels = (theme: any) => ({
  left: {
    title: "PASS",
    style: {
      label: {
        ...stampBase,
        color: theme.danger,
        borderColor: theme.danger,
        transform: [{ rotate: "8deg" }],
      },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "flex-end" as const,
        justifyContent: "flex-start" as const,
        marginTop: 36,
        marginLeft: -36,
      },
    },
  },

  right: {
    title: "SAVE",
    style: {
      label: {
        ...stampBase,
        color: "#22C55E",
        borderColor: "#22C55E",
        transform: [{ rotate: "-8deg" }],
      },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "flex-start" as const,
        justifyContent: "flex-start" as const,
        marginTop: 36,
        marginLeft: 36,
      },
    },
  },

  top: {
    title: "DETAILS",
    style: {
      label: {
        ...stampBase,
        color: theme.primary,
        borderColor: theme.primary,
      },
      wrapper: {
        flexDirection: "column" as const,
        alignItems: "center" as const,
        justifyContent: "center" as const,
      },
    },
  },
});

const htmlTagStyles = (theme: any) => ({
  p: {
    marginBottom: 8,
    fontSize: 15,
    lineHeight: 22,
    color: theme.secondaryText,
  },

  li: {
    marginBottom: 4,
    fontSize: 15,
    lineHeight: 22,
    color: theme.secondaryText,
  },

  strong: {
    fontWeight: "600" as const,
    color: theme.text,
  },

  b: {
    fontWeight: "600" as const,
    color: theme.text,
  },

  h1: {
    fontSize: 16,
    fontWeight: "700" as const,
    marginVertical: 6,
    color: theme.text,
  },

  h2: {
    fontSize: 15,
    fontWeight: "700" as const,
    marginVertical: 6,
    color: theme.text,
  },

  h3: {
    fontSize: 14,
    fontWeight: "700" as const,
    marginVertical: 4,
    color: theme.text,
  },

  a: {
    color: theme.primary,
  },

  div: {
    marginBottom: 4,
  },
});

const createStyles = (theme: any) =>
  StyleSheet.create({
    deckContainer: { flex: 1, backgroundColor: theme.background },
    center: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
      padding: space.xxl,
    },
    emptyEmoji: { fontSize: 44, marginBottom: space.md },
    emptyTitle: { ...font.title2, color: theme.text, marginBottom: space.xs },
    emptySubtitle: {
      ...font.subhead,
      color: theme.secondaryText,
      textAlign: "center",
    },

    deck: { flex: 1 },
    card: {
      height: "86%",
      borderRadius: radius.xl,
      backgroundColor: theme.card,
      padding: space.xxl,
      ...shadow.card,
    },
    cardHeaderRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.md,
      marginBottom: space.lg,
    },
    cardHeaderText: { flex: 1, gap: 2 },
    cardCompany: {
      ...font.footnote,
      fontWeight: "700",
      color: theme.primary,
      textTransform: "uppercase",
      letterSpacing: 0.6,
    },
    cardRating: {
      ...font.footnote,
      color: theme.secondaryText,
      fontWeight: "600",
    },
    cardRatingStar: { color: "#FBBF24" },
    cardTitle: { ...font.title1, color: theme.text, marginBottom: space.md },
    cardMetaRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: space.sm,
      marginBottom: space.lg,
    },
    cardLocation: { ...font.subhead, color: theme.secondaryText },
    remotePill: {
      backgroundColor: theme.mode === "dark" ? "#16331D" : "#DCFCE7",
      paddingHorizontal: space.md,
      paddingVertical: 3,
      borderRadius: radius.pill,
    },
    remotePillText: { ...font.caption, fontWeight: "600", color: "#22C55E" },
    descriptionContainer: { flex: 1, overflow: "hidden" },
    cardDescription: {
      ...font.subhead,
      color: theme.secondaryText,
      lineHeight: 22,
    },
    fade: { position: "absolute", left: 0, right: 0, bottom: 0, height: 48 },
    actionBtn: {
      backgroundColor: theme.primary,
      paddingVertical: 13,
      borderRadius: radius.md,
      alignItems: "center",
      marginTop: space.lg,
    },
    actionBtnText: { ...font.subhead, color: "#fff", fontWeight: "600" },
    cardHint: {
      ...font.caption,
      color: theme.secondaryText,
      textAlign: "center",
      marginTop: space.md,
    },

    topBar: {
      // Floating overlay so it doesn't push the card deck down.
      position: "absolute",
      top: space.sm,
      left: space.lg,
      zIndex: 10,
      flexDirection: "row",
      alignItems: "center",
    },
    undoBtn: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: theme.card,
      paddingHorizontal: space.lg,
      paddingVertical: space.sm,
      borderRadius: radius.pill,
      ...shadow.floating,
    },
    undoBtnDisabled: { opacity: 0.35 },
    undoText: { ...font.subhead, fontWeight: "700", color: theme.primary },
    undoTextDisabled: { color: theme.secondaryText },
  });

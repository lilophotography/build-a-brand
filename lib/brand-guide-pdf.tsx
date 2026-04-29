import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FAF7F2",
    paddingTop: 60,
    paddingBottom: 60,
    paddingHorizontal: 56,
    fontFamily: "Helvetica",
  },
  coverPage: {
    backgroundColor: "#2B2B2B",
    paddingTop: 80,
    paddingBottom: 80,
    paddingHorizontal: 56,
    justifyContent: "center",
    minHeight: "100%",
  },
  eyebrow: {
    fontSize: 8,
    letterSpacing: 3,
    color: "#C9A96E",
    textTransform: "uppercase",
    marginBottom: 16,
  },
  coverTitle: {
    fontSize: 40,
    color: "#FFFFFF",
    fontFamily: "Times-Roman",
    lineHeight: 1.3,
    marginBottom: 24,
  },
  coverSubtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
    lineHeight: 1.6,
    maxWidth: 360,
    marginBottom: 48,
  },
  coverDivider: {
    width: 48,
    height: 1,
    backgroundColor: "#C9A96E",
    marginBottom: 24,
  },
  coverMeta: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    letterSpacing: 1,
  },
  sectionHeader: {
    backgroundColor: "#2B2B2B",
    paddingVertical: 32,
    paddingHorizontal: 0,
    marginBottom: 32,
  },
  sectionNum: {
    fontSize: 9,
    letterSpacing: 2,
    color: "#C9A96E",
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 28,
    color: "#FFFFFF",
    fontFamily: "Times-Roman",
  },
  sectionDesc: {
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
    marginTop: 8,
    lineHeight: 1.5,
  },
  contentBlock: {
    marginBottom: 24,
  },
  contentLabel: {
    fontSize: 8,
    letterSpacing: 2,
    color: "#AF493B",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  contentText: {
    fontSize: 11,
    color: "#2B2B2B",
    lineHeight: 1.8,
  },
  divider: {
    height: 1,
    backgroundColor: "#2B2B2B",
    opacity: 0.1,
    marginVertical: 24,
  },
  footer: {
    position: "absolute",
    bottom: 32,
    left: 56,
    right: 56,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  footerBrand: {
    fontSize: 8,
    letterSpacing: 2,
    color: "#C9A96E",
    textTransform: "uppercase",
  },
  footerPage: {
    fontSize: 8,
    color: "#6B6560",
  },
  emptyState: {
    padding: 24,
    backgroundColor: "#F0EBE3",
    borderRadius: 4,
    marginBottom: 16,
  },
  emptyStateText: {
    fontSize: 11,
    color: "#6B6560",
    fontStyle: "italic",
  },
});

const V_META: Record<string, { num: string; title: string; tagline: string }> = {
  vision: {
    num: "01",
    title: "Vision",
    tagline: "Mission, vision, and the values that guide every decision.",
  },
  value: {
    num: "02",
    title: "Value",
    tagline: "What makes you irreplaceable: your story, skills, and ideal client.",
  },
  voice: {
    num: "03",
    title: "Voice",
    tagline: "Your messaging, 'I Help' statement, and copy that converts.",
  },
  visuals: {
    num: "04",
    title: "Visuals",
    tagline: "Brand vibe, color palette, logo direction, and typography.",
  },
  visibility: {
    num: "05",
    title: "Visibility",
    tagline: "Where to show up, what to create, and how to attract your people.",
  },
};

const TOOLS_ORDER = ["vision", "value", "voice", "visuals", "visibility"];

interface ProgressItem {
  tool: string;
  completed: boolean;
  summary?: string;
}

export function BrandGuidePDF({
  progress,
  date,
}: {
  progress: ProgressItem[];
  date: string;
}) {
  const progressMap = Object.fromEntries(
    progress.map((p) => [p.tool, p])
  );

  return (
    <Document
      title="Brand Guide: LiLo Photography & Branding"
      author="LiLo Photography & Branding"
    >
      {/* Cover */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.eyebrow}>Build a Brand · The Course</Text>
        <Text style={styles.coverTitle}>
          Your Brand Guide
        </Text>
        <Text style={styles.coverSubtitle}>
          This guide captures your completed brand foundation across all five
          workshops. Use it as your north star for every business decision,
          every piece of content, and every client conversation.
        </Text>
        <View style={styles.coverDivider} />
        <Text style={styles.coverMeta}>
          Generated {date} · LiLo Photography &amp; Branding
        </Text>
      </Page>

      {/* One page per V */}
      {TOOLS_ORDER.map((tool) => {
        const meta = V_META[tool];
        const item = progressMap[tool];
        const summary = item?.summary?.trim();

        return (
          <Page key={tool} size="A4" style={styles.page}>
            {/* Section header bar */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionNum}>{meta.num}: The {meta.title}</Text>
              <Text style={styles.sectionTitle}>{meta.title}</Text>
              <Text style={styles.sectionDesc}>{meta.tagline}</Text>
            </View>

            {/* Content */}
            {summary ? (
              <View style={styles.contentBlock}>
                <Text style={styles.contentLabel}>Your {meta.title} Summary</Text>
                <Text style={styles.contentText}>{summary}</Text>
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>
                  This workshop hasn't been completed yet. Complete the{" "}
                  {meta.title} workshop in your Brand Builder to unlock this
                  section.
                </Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Footer */}
            <View style={styles.footer} fixed>
              <Text style={styles.footerBrand}>
                LiLo Photography &amp; Branding
              </Text>
              <Text style={styles.footerPage} render={({ pageNumber, totalPages }) =>
                `${pageNumber} / ${totalPages}`
              } />
            </View>
          </Page>
        );
      })}
    </Document>
  );
}

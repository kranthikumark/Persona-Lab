import { nativeCopy, englishReportCopy } from "./localized-copy";
import type { ReportDocument } from "./data";
// Shared native Word/PDF presentation, independent of the scoring engine.
export function indicSections(data: ReportDocument) {
  const copy = nativeCopy(data.locale ?? "en-IN") ?? englishReportCopy;
  const checks = data.categories.flatMap((c) => c.checks);
  const group = (status: "demonstrated" | "concern" | "insufficient") =>
    checks.filter((c) => c.status === status);
  return {
    copy,
    sections: [
      {
        title: copy.scores,
        paragraphs: data.categories.map(
          (c) => `${c.label}: ${Math.round(c.score)}/100 (${c.weight}%)`,
        ),
      },
      { title: copy.next, paragraphs: [data.nextAction] },
      ...(data.corrections?.length
        ? [
            {
              title:
                data.locale === "hi-IN"
                  ? "बाद में किए गए सुधार"
                  : "తరువాత చేసిన సవరణలు",
              paragraphs: data.corrections.map(
                (c) =>
                  `${c.label}: ${c.earlierTurns.join(", ")} → ${c.correctedTurns.join(", ")}. ${data.locale === "hi-IN" ? "पूर्ण इतिहास के अंकों में पहले की चिंता बनी रहती है।" : "మొత్తం సంభాషణ స్కోరులో ముందటి ఆందోళన అలాగే ఉంటుంది."}`,
              ),
            },
          ]
        : []),
      {
        title: copy.positives,
        paragraphs: group("demonstrated").map((c) => c.achievement),
      },
      {
        title: copy.concerns,
        paragraphs: group("concern").map((c) => `${c.label}: ${c.guidance}`),
      },
      {
        title: copy.improvements,
        paragraphs: [...group("concern"), ...group("insufficient")].map(
          (c) => `${c.label}: ${c.guidance}`,
        ),
      },
      ...(data.length
        ? [
            {
              title: copy.length,
              paragraphs: [
                copy.lengthNote,
                ...data.length.map(
                  (r) =>
                    `${copy.turn} ${r.turn}: ${r.wordCount} / 70 (${r.status})`,
                ),
              ],
            },
          ]
        : []),
      ...checks.map((c) => ({
        title: c.label,
        paragraphs: [
          copy.statuses[c.status],
          c.guidance,
          ...c.evidence.map(
            (e) => `${copy.turn} ${e.turn} (${e.scope}): “${e.excerpt}”`,
          ),
        ],
      })),
      {
        title: copy.limitations,
        paragraphs: [
          copy.limitNote,
          `Rubric: ${data.rubric}. Category score = demonstrated checks / category checks × 100; weighted total rounded.`,
        ],
      },
    ],
  };
}

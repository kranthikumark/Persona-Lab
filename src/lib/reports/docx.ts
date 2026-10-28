import "server-only";
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { type ReportDocument, reportLimitations, statusLabel } from "./data";
const violet = "6840BD",
  muted = "616176",
  ink = "242033",
  pale = "F1EBFA",
  line = "DDD6EA";
const run = (text: string, bold = false, color = ink, size = 21) =>
  new TextRun({ text, bold, color, size });
const p = (
  text: string,
  options: {
    bold?: boolean;
    color?: string;
    size?: number;
    after?: number;
    keepNext?: boolean;
  } = {},
) =>
  new Paragraph({
    children: [run(text, options.bold, options.color, options.size)],
    spacing: { after: options.after ?? 110, line: 300 },
    keepNext: options.keepNext,
  });
const heading = (text: string) =>
  new Paragraph({
    text,
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 280, after: 140 },
    keepNext: true,
  });
const cell = (children: Paragraph[], fill = "FFFFFF") =>
  new TableCell({
    children,
    shading: { type: ShadingType.CLEAR, fill },
    margins: { top: 130, bottom: 130, left: 180, right: 180 },
  });
export async function reportDOCX(data: ReportDocument) {
  const checks = data.categories.flatMap((c) => c.checks),
    positives = checks.filter((c) => c.status === "demonstrated"),
    concerns = checks.filter((c) => c.status === "concern"),
    gaps = checks.filter((c) => c.status === "insufficient");
  const children: (Paragraph | Table)[] = [
    p("PERSONA LAB", { bold: true, color: violet, size: 20, after: 210 }),
    new Paragraph({
      text: "Session report card",
      heading: HeadingLevel.TITLE,
      spacing: { after: 180 },
    }),
    p(data.title, { size: 27, after: 90 }),
    p(data.approach, { color: muted }),
    p(
      `Revision ${data.revision}  |  ${data.turns} turns  |  ${new Date(data.createdAt).toISOString().slice(0, 16).replace("T", " ")} UTC`,
      { color: muted, size: 18, after: 240 },
    ),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [2200, 7200],
      rows: [
        new TableRow({
          children: [
            cell(
              [
                p(`${data.score} / 100`, {
                  bold: true,
                  color: violet,
                  size: 48,
                  after: 60,
                }),
              ],
              pale,
            ),
            cell(
              [
                p(
                  data.turns === 0
                    ? "Not started"
                    : data.coverage < 10
                      ? "Provisional practice score"
                      : "Practice rubric score",
                  { bold: true, size: 24, after: 70 },
                ),
                p(`${data.coverage} of 10 checks with recognized evidence`, {
                  color: muted,
                  size: 19,
                  after: 0,
                }),
              ],
              pale,
            ),
          ],
        }),
      ],
      borders: {
        top: { style: BorderStyle.NONE },
        bottom: { style: BorderStyle.NONE },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
      },
    }),
    p("", { size: 8, after: 0 }),
    p(
      "Review your strengths, observed concerns and evidence gaps, then choose one improvement for your next practice.",
      { color: muted, after: 100 },
    ),
    heading("Category scores"),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      columnWidths: [6500, 1450, 1450],
      rows: [
        new TableRow({
          tableHeader: true,
          children: [
            cell([p("Category", { bold: true, after: 0 })], pale),
            cell([p("Score", { bold: true, after: 0 })], pale),
            cell([p("Weight", { bold: true, after: 0 })], pale),
          ],
        }),
        ...data.categories.map(
          (c) =>
            new TableRow({
              cantSplit: true,
              children: [
                cell([p(c.label, { after: 0 })]),
                cell([
                  p(`${c.score}/100`, { bold: true, color: violet, after: 0 }),
                ]),
                cell([p(`${c.weight}%`, { color: muted, after: 0 })]),
              ],
            }),
        ),
      ],
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: line },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: line },
        left: { style: BorderStyle.NONE },
        right: { style: BorderStyle.NONE },
        insideVertical: { style: BorderStyle.NONE },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: line },
      },
    }),
    p(
      `Each demonstrated check earns 50 category points. Rubric: ${data.rubric}.`,
      { color: muted, size: 18 },
    ),
    heading("Next practice action"),
    p(data.nextAction),
    new Paragraph({
      text: "Feedback and next steps",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
      keepNext: true,
    }),
    heading("Positives"),
  ];
  if (!positives.length)
    children.push(
      p("No strengths evidenced yet. Record a response to build your report.", {
        color: muted,
      }),
    );
  for (const c of positives)
    children.push(
      p(c.achievement, { bold: true, after: 40, keepNext: true }),
      p(
        `Supporting evidence: ${c.evidence.map((e) => `turn ${e.turn} (${e.scope.toLowerCase()})`).join(", ")}.`,
        { color: muted, size: 19 },
      ),
    );
  children.push(heading("Needs attention"));
  if (!concerns.length)
    children.push(
      p(
        "No negative findings matched the current rules. This is not proof of complete accuracy.",
        { color: muted },
      ),
    );
  for (const c of concerns)
    children.push(
      p(c.label, { bold: true, after: 40, keepNext: true }),
      p(c.guidance, { color: muted }),
    );
  children.push(heading("What to improve"));
  const improvements = [...concerns, ...gaps];
  if (!improvements.length)
    children.push(
      p(
        "All rubric skills have supporting evidence. Try a shorter alternative response or a different objection.",
        { color: muted },
      ),
    );
  improvements.forEach((c, i) =>
    children.push(
      p(`${i + 1}. ${c.label}`, { bold: true, after: 40, keepNext: true }),
      p(`${statusLabel(c.status)}. ${c.guidance}`, { color: muted }),
    ),
  );
  children.push(
    new Paragraph({
      text: "Evidence and scoring",
      heading: HeadingLevel.HEADING_1,
      pageBreakBefore: true,
      spacing: { after: 200 },
      keepNext: true,
    }),
    p(
      `Full effective history through turn ${data.turns}${data.forkTurn !== null ? `; fork after turn ${data.forkTurn}` : ""}. Selected excerpts are included below.`,
      { color: muted },
    ),
  );
  for (const c of checks) {
    children.push(
      new Paragraph({
        text: c.label,
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 210, after: 80 },
        keepNext: true,
      }),
      p(statusLabel(c.status), {
        bold: true,
        color: violet,
        size: 19,
        after: 60,
        keepNext: true,
      }),
      p(c.guidance, {
        color: muted,
        size: 20,
        keepNext: c.evidence.length > 0,
      }),
    );
    if (!c.evidence.length)
      children.push(
        p("No matching evidence was recorded for this check.", {
          color: muted,
          size: 19,
        }),
      );
    for (const e of c.evidence)
      children.push(
        p(`Turn ${e.turn} / ${e.scope}`, {
          bold: true,
          size: 19,
          after: 45,
          keepNext: true,
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `“${e.excerpt}”`,
              italics: true,
              color: muted,
              size: 20,
            }),
          ],
          indent: { left: 200 },
          spacing: { after: 150, line: 300 },
        }),
      );
  }
  children.push(
    heading("How to read this score"),
    p(reportLimitations, { color: muted, size: 19 }),
  );
  const doc = new Document({
    creator: "PERSONA LAB",
    title: "Session report card",
    subject: data.title,
    styles: {
      default: {
        document: {
          run: { font: "Arial", size: 21, color: ink },
          paragraph: { spacing: { line: 300 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { size: 58, bold: true, color: "000000" },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 30, bold: true, color: violet },
          paragraph: { keepNext: true },
        },
        {
          id: "Heading2",
          name: "Heading 2",
          basedOn: "Normal",
          next: "Normal",
          run: { size: 24, bold: true, color: ink },
          paragraph: { keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 850, right: 900, bottom: 850, left: 900 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [
                  run(
                    "PERSONA LAB  |  Fictional practice  |  ",
                    false,
                    muted,
                    16,
                  ),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: muted,
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}

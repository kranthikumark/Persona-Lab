import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { type ReportDocument, reportLimitations, statusLabel } from "./data";
const color = (hex: string) =>
  rgb(
    parseInt(hex.slice(0, 2), 16) / 255,
    parseInt(hex.slice(2, 4), 16) / 255,
    parseInt(hex.slice(4, 6), 16) / 255,
  );
const ink = color("242033"),
  muted = color("616176"),
  violet = color("6840BD"),
  pale = color("F1EBFA"),
  border = color("DDD6EA"),
  amber = color("895518");
export async function reportPDF(data: ReportDocument) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const [regular, bold] = await Promise.all(
    ["Regular", "Bold"].map(async (weight) =>
      pdf.embedFont(
        await readFile(
          path.join(
            process.cwd(),
            "assets/report-fonts",
            `NotoSans-${weight}.ttf`,
          ),
        ),
        { subset: true },
      ),
    ),
  );
  pdf.setTitle("PERSONA LAB Practice Report");
  pdf.setAuthor("PERSONA LAB");
  pdf.setSubject(data.title);
  const chars = new Set(regular.getCharacterSet());
  const safe = (s: string) =>
    Array.from(s.replace(/[\u0000-\u0008\u000b-\u001f]/g, ""))
      .map((c) => (chars.has(c.codePointAt(0)!) ? c : "?"))
      .join("");
  const width = 595.28,
    height = 841.89,
    margin = 46,
    body = width - margin * 2;
  let page!: PDFPage,
    y = 0;
  function newPage() {
    page = pdf.addPage([width, height]);
    page.drawText("PERSONA LAB", {
      x: margin,
      y: height - 34,
      size: 9,
      font: bold,
      color: violet,
    });
    page.drawText("PRACTICE REPORT", {
      x: width - 156,
      y: height - 34,
      size: 8,
      font: regular,
      color: muted,
    });
    y = height - 72;
  }
  function room(h: number) {
    if (y - h < 56) newPage();
  }
  function lines(text: string, size: number, font: PDFFont, maxWidth: number) {
    const result: string[] = [];
    for (const paragraph of safe(text).split("\n")) {
      let line = "";
      for (const word of paragraph.split(/\s+/)) {
        if (!word) continue;
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          if (line) {
            result.push(line);
            line = "";
          }
          let part = "";
          for (const char of word) {
            if (font.widthOfTextAtSize(part + char, size) > maxWidth) {
              result.push(part);
              part = "";
            }
            part += char;
          }
          line = part;
        } else if (
          line &&
          font.widthOfTextAtSize(line + " " + word, size) > maxWidth
        ) {
          result.push(line);
          line = word;
        } else line += `${line ? " " : ""}${word}`;
      }
      result.push(line);
    }
    return result;
  }
  function text(
    t: string,
    size = 10,
    font = regular,
    c = ink,
    maxWidth = body,
    x = margin,
  ) {
    for (const line of lines(t, size, font, maxWidth)) {
      room(size * 1.55);
      page.drawText(line, { x, y: y - size, size, font, color: c });
      y -= size * 1.55;
    }
  }
  function heading(t: string) {
    room(65);
    y -= 14;
    text(t, 17, bold, violet);
    y -= 9;
  }
  function item(title: string, detail?: string) {
    room(62);
    text(title, 10, bold);
    if (detail) text(detail, 9, regular, muted);
    y -= 8;
  }
  newPage();
  text("Session report card", 29, bold);
  y -= 7;
  text(data.title, 14, regular, muted);
  y -= 10;
  text(data.approach, 11, bold);
  const date =
    new Date(data.createdAt).toISOString().replace("T", " ").slice(0, 16) +
    " UTC";
  text(
    `${date}   |   Revision ${data.revision}   |   ${data.turns} turns`,
    8,
    regular,
    muted,
  );
  y -= 20;
  room(108);
  page.drawRectangle({
    x: margin,
    y: y - 100,
    width: body,
    height: 100,
    color: pale,
    borderColor: border,
    borderWidth: 0.6,
  });
  page.drawText(String(data.score), {
    x: margin + 20,
    y: y - 65,
    size: 44,
    font: bold,
    color: violet,
  });
  page.drawText("/ 100", {
    x: margin + 92,
    y: y - 64,
    size: 13,
    font: regular,
    color: muted,
  });
  const scoreTop = y;
  y -= 19;
  text(
    data.turns === 0
      ? "Not started"
      : data.coverage < 10
        ? "Provisional score"
        : "Practice rubric score",
    12,
    bold,
    ink,
    body - 186,
    margin + 172,
  );
  text(
    `${data.coverage} of 10 checks with evidence`,
    10,
    regular,
    muted,
    body - 186,
    margin + 172,
  );
  text(
    "Recognized skills, not a competence rating",
    8,
    regular,
    muted,
    body - 186,
    margin + 172,
  );
  y = scoreTop - 118;
  heading("Your category scores");
  for (const c of data.categories) {
    room(43);
    page.drawText(safe(c.label), {
      x: margin,
      y: y - 10,
      size: 10,
      font: regular,
      color: ink,
    });
    page.drawText(`${c.score}/100  |  ${c.weight}% weight`, {
      x: width - margin - 133,
      y: y - 10,
      size: 9,
      font: regular,
      color: muted,
    });
    y -= 22;
    page.drawRectangle({
      x: margin,
      y: y - 4,
      width: body,
      height: 5,
      color: pale,
    });
    if (c.score)
      page.drawRectangle({
        x: margin,
        y: y - 4,
        width: (body * c.score) / 100,
        height: 5,
        color: violet,
      });
    y -= 17;
  }
  const checks = data.categories.flatMap((c) => c.checks),
    positives = checks.filter((c) => c.status === "demonstrated"),
    concerns = checks.filter((c) => c.status === "concern"),
    gaps = checks.filter((c) => c.status === "insufficient");
  heading("At a glance");
  text(
    `Positives: ${positives.length}   |   Observed concerns: ${concerns.length}   |   Evidence gaps: ${gaps.length}`,
    10,
    bold,
  );
  y -= 8;
  text(data.nextAction, 10, regular, muted);
  newPage();
  text("Feedback and next steps", 25, bold);
  text(
    "Keep what worked. Focus your next practice on one useful change.",
    10,
    regular,
    muted,
  );
  heading("Positives");
  if (!positives.length)
    item(
      "No strengths evidenced yet",
      "Record a response so the report can identify what you did well.",
    );
  for (const c of positives)
    item(
      c.achievement,
      c.evidence.length
        ? `Supporting evidence: turn ${c.evidence[0].turn}, ${c.evidence[0].scope.toLowerCase()}.`
        : undefined,
    );
  heading("Needs attention");
  if (!concerns.length)
    text(
      "No negative findings matched the current rules. This is not proof of complete accuracy.",
      10,
      regular,
      muted,
    );
  for (const c of concerns) item(c.label, c.guidance);
  heading("What to improve");
  const improvements = [...concerns, ...gaps];
  if (!improvements.length)
    text(
      "All rubric skills have supporting evidence. Try a shorter alternative response or a different objection.",
      10,
      regular,
      muted,
    );
  improvements.forEach((c, i) =>
    item(`${i + 1}. ${c.label}`, `${statusLabel(c.status)}. ${c.guidance}`),
  );
  newPage();
  text("Evidence and scoring", 25, bold);
  text(
    `Full effective history through turn ${data.turns}${data.forkTurn !== null ? `; fork after turn ${data.forkTurn}` : ""}.`,
    9,
    regular,
    muted,
  );
  for (const c of checks) {
    const evidenceHeight = c.evidence.reduce(
      (sum, e) =>
        sum +
        7 +
        9 * 1.55 +
        lines(`“${e.excerpt}”`, 9, regular, body).length * 9 * 1.55,
      0,
    );
    room(
      14 +
        lines(c.label, 17, bold, body).length * 17 * 1.55 +
        9 +
        9 * 1.55 +
        lines(c.guidance, 9, regular, body).length * 9 * 1.55 +
        evidenceHeight +
        10,
    );
    heading(c.label);
    text(
      statusLabel(c.status),
      9,
      bold,
      c.status === "concern" ? amber : violet,
    );
    text(c.guidance, 9, regular, muted);
    if (!c.evidence.length) {
      y -= 5;
      text(
        "No matching evidence was recorded for this check.",
        9,
        regular,
        muted,
      );
    }
    for (const e of c.evidence) {
      y -= 7;
      text(`Turn ${e.turn} / ${e.scope}`, 9, bold);
      text(`“${e.excerpt}”`, 9, regular, muted);
    }
    y -= 5;
  }
  room(150);
  heading("How to read this score");
  text(reportLimitations, 9, regular, muted);
  text(
    "Category weights: 30 / 20 / 20 / 15 / 15. Each demonstrated check earns 50 category points. Scores are rounded to the nearest whole number.",
    9,
    regular,
    muted,
  );
  y -= 8;
  text(
    `Rubric: ${data.rubric}. Evidence excerpts are selected highlights, not the full transcript.`,
    8,
    regular,
    muted,
  );
  for (const [i, p] of pdf.getPages().entries()) {
    p.drawLine({
      start: { x: margin, y: 39 },
      end: { x: width - margin, y: 39 },
      thickness: 0.5,
      color: border,
    });
    p.drawText(
      `PERSONA LAB  |  Fictional practice  |  Revision ${data.revision}`,
      { x: margin, y: 25, size: 7, font: regular, color: muted },
    );
    p.drawText(`${i + 1} / ${pdf.getPageCount()}`, {
      x: width - margin - 34,
      y: 25,
      size: 8,
      font: regular,
      color: muted,
    });
  }
  return pdf.save();
}

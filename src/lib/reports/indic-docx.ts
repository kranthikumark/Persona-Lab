import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Footer,
  PageNumber,
} from "docx";
import type { ReportDocument } from "./data";
import { indicSections } from "./indic-sections";
import { scriptFontFiles, scriptRuns } from "./script-fonts";
export async function indicDOCX(data: ReportDocument) {
  const { copy, sections } = indicSections(data);
  const family =
    data.locale === "hi-IN" ? "Noto Sans Devanagari" : "Noto Sans Telugu";
  const fonts = await Promise.all(
    scriptFontFiles.map(async (f) => ({
      name: f.name,
      data: await readFile(path.join(process.cwd(), f.path)),
    })),
  );
  const text = (value: string) =>
    new Paragraph({
      children: scriptRuns(value).map(
        (run) =>
          new TextRun({
            text: run.text,
            font: {
              ascii: run.font,
              hAnsi: run.font,
              cs: run.font,
              eastAsia: run.font,
            },
            language: { value: data.locale },
            size: 22,
          }),
      ),
      spacing: { after: 150, line: 400 },
      widowControl: true,
    });
  const doc = new Document({
    creator: "PERSONA LAB",
    title: copy.title,
    subject: data.title,
    fonts,
    styles: {
      default: {
        document: {
          run: {
            font: {
              ascii: family,
              hAnsi: family,
              cs: family,
              eastAsia: family,
            },
            size: 22,
            language: { value: data.locale },
          },
          paragraph: { spacing: { line: 400 } },
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          run: { size: 48, color: "000000", bold: true },
        },
        {
          id: "Heading1",
          name: "Heading 1",
          basedOn: "Normal",
          run: { size: 30, color: "6840BD", bold: true },
          paragraph: { keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838 },
            margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun("PERSONA LAB · "),
                  new TextRun({ children: [PageNumber.CURRENT] }),
                ],
              }),
            ],
          }),
        },
        children: [
          new Paragraph({ text: copy.title, heading: HeadingLevel.TITLE }),
          text(data.title),
          text(data.approach),
          text(
            `Revision ${data.revision} · ${data.turns} turns · ${new Date(data.createdAt).toISOString()}`,
          ),
          new Paragraph({
            children: [
              new TextRun({
                text: `${data.score} / 100`,
                size: 58,
                bold: true,
                color: "6840BD",
              }),
            ],
            spacing: { before: 240, after: 240 },
          }),
          text(
            `${copy.provisional} · ${data.coverage} / ${data.totalChecks} ${copy.coverage}`,
          ),
          text(copy.draft),
          ...sections.flatMap((s) => [
            new Paragraph({
              text: s.title,
              heading: HeadingLevel.HEADING_1,
              spacing: { before: 300, after: 180 },
              keepNext: true,
            }),
            ...(s.paragraphs.length ? s.paragraphs : [copy.empty]).map(text),
          ]),
        ],
      },
    ],
  });
  return Packer.toBuffer(doc);
}

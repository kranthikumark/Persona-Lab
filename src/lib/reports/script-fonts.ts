export const scriptFontFiles = [
  { name: "Noto Sans", path: "assets/report-fonts/NotoSans-Regular.ttf" },
  { name: "Noto Sans Devanagari", path: "public/fonts/NotoSansDevanagari.ttf" },
  { name: "Noto Sans Telugu", path: "public/fonts/NotoSansTelugu.ttf" },
] as const;
export const needsIndic = (data: unknown) =>
  /[\u0900-\u097f\u0c00-\u0c7f]/u.test(JSON.stringify(data));
export function scriptRuns(text: string) {
  const runs: { text: string; font: string }[] = [];
  for (const { segment: char } of new Intl.Segmenter("en", {
    granularity: "grapheme",
  }).segment(text)) {
    const font = /[\u0900-\u097f]/u.test(char)
      ? "Noto Sans Devanagari"
      : /[\u0c00-\u0c7f]/u.test(char)
        ? "Noto Sans Telugu"
        : "Noto Sans";
    if (runs.at(-1)?.font === font) runs.at(-1)!.text += char;
    else runs.push({ text: char, font });
  }
  return runs;
}

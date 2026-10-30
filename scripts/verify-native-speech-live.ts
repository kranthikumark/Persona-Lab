import { loadEnvFile } from "node:process";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { transcribeMeta } from "../src/lib/speech/provider";
import { validateWav } from "../src/lib/speech/wav";
loadEnvFile(".env");
if (!process.argv.includes("--consent-meta-processing"))
  throw new Error(
    "Explicit --consent-meta-processing required; uses selected public FLEURS fixtures in /tmp only.",
  );
function words(s: string) {
  return s
    .normalize("NFC")
    .toLocaleLowerCase()
    .replace(/[\p{P}\p{S}]/gu, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
}
function distance(a: string[], b: string[]) {
  let row = b.map((_, i) => i + 1);
  row.unshift(0);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++)
      next.push(
        Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1)),
      );
    row = next;
  }
  return row[b.length];
}
const evidence = [];
for (const locale of ["hi-IN", "te-IN"] as const) {
  const reference = JSON.parse(
    readFileSync(
      `/tmp/persona-${locale.replace("-", "_").toLowerCase()}-reference.json`,
      "utf8",
    ),
  );
  const bytes = new Uint8Array(readFileSync(`/tmp/persona-${locale}-24k.wav`));
  const audio = validateWav(bytes);
  const result = await transcribeMeta(bytes, undefined, locale);
  const expected = words(reference.row[3]),
    actual = words(result.text);
  evidence.push({
    locale,
    provider: result.provider,
    model: result.model,
    result: "provider_returned_transcript",
    sample: {
      dataset: "google/fleurs",
      license: "CC-BY-4.0",
      split: "dev",
      filename: reference.filename,
      source: reference.source,
      inputSha256: createHash("sha256").update(bytes).digest("hex"),
      durationMs: audio.durationMs,
    },
    transcriptCharacters: result.text.length,
    scriptPresent: (locale === "hi-IN"
      ? /\p{Script=Devanagari}/u
      : /\p{Script=Telugu}/u
    ).test(result.text),
    latencyMs: result.latencyMs,
    normalizedWordEdits: distance(expected, actual),
    referenceWords: expected.length,
    wordErrorRate: distance(expected, actual) / expected.length,
    transcriptSha256: createHash("sha256").update(result.text).digest("hex"),
    humanMicrophone: "pending",
    nativeFluentReview: "pending",
    audiblePlayback: "pending",
    limitation:
      "One public read-speech sample; punctuation/symbols removed for comparison. Not broad accuracy or conversational acceptance.",
  });
}
mkdirSync("docs/verification/v5-09", { recursive: true });
writeFileSync(
  "docs/verification/v5-09/native-speech-live.json",
  JSON.stringify({ date: "2026-10-30", evidence }, null, 2) + "\n",
);
console.log(
  JSON.stringify(
    evidence.map((e) => ({
      locale: e.locale,
      result: e.result,
      scriptPresent: e.scriptPresent,
      wordErrorRate: e.wordErrorRate,
    })),
  ),
);

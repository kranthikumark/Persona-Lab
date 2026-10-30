import { loadEnvFile } from "node:process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { transcribeMeta } from "../src/lib/speech/provider";
import { validateWav } from "../src/lib/speech/wav";
loadEnvFile(".env");
// Explicit file selection and processing consent; never opens a microphone.
const [flag, path, consent] = process.argv.slice(2);
if (flag !== "--audio" || !path || consent !== "--consent-meta-processing")
  throw new Error(
    "Usage: npm run verify:speech:live -- --audio /absolute/path.wav --consent-meta-processing",
  );
const bytes = new Uint8Array(readFileSync(path));
const audio = validateWav(bytes);
try {
  const result = await transcribeMeta(bytes);
  console.log(
    JSON.stringify({
      status: "passed",
      model: result.model,
      inputDurationMs: audio.durationMs,
      providerDurationMs: result.audioDurationMs,
      latencyMs: result.latencyMs,
      characters: result.text.length,
      transcriptSha256: createHash("sha256").update(result.text).digest("hex"),
      retention: "application_memory_only",
      humanMicrophoneAcceptance: "not_established_by_this_command",
    }),
  );
} catch {
  console.error(
    "Speech verification failed. Check Meta access, audio format or network; no credentials or transcript were printed.",
  );
  process.exitCode = 1;
}

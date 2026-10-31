import { loadEnvFile } from "node:process";
import { writeFile } from "node:fs/promises";
loadEnvFile(".env");
const key = process.env.META_API_KEY?.trim();
if (!key) throw new Error("Configure META_API_KEY in the ignored .env file.");
const response = await fetch("https://api.meta.ai/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
  redirect: "error",
  signal: AbortSignal.timeout(20000),
});
if (!response.ok)
  throw new Error(
    `Meta catalog check returned HTTP ${response.status}; no generation request was sent.`,
  );
const data = await response.json();
const ids: string[] = Array.isArray(data.data)
  ? data.data
      .map((m: { id?: unknown }) => m.id)
      .filter((id: unknown): id is string => typeof id === "string")
  : [];
const evidence = {
  date: new Date().toISOString().slice(0, 10),
  endpoint: "GET https://api.meta.ai/v1/models",
  httpStatus: response.status,
  listedModelIds: ids,
  candidateAvatarOrRealtimeVoiceIds: ids.filter((id) =>
    /avatar|realtime/i.test(id),
  ),
  scope:
    "Read-only catalog with existing Meta key; no media upload or generation. Catalog absence does not establish universal/private-preview availability. A candidate name alone does not establish a supported integration contract.",
};
await writeFile(
  "docs/verification/v5-09/meta-avatar-access.json",
  JSON.stringify(evidence, null, 2) + "\n",
);
console.log(JSON.stringify(evidence));

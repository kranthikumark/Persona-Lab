import { rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
export default async function cleanup() {
  const root = process.env.PERSONA_MEDIA_TEST_STORAGE;
  if (
    root &&
    path.dirname(root) === tmpdir() &&
    /^persona-v510-browser-[a-f0-9-]{36}$/.test(path.basename(root))
  )
    await rm(root, { recursive: true, force: true });
}

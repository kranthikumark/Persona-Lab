import { afterEach, expect, it, vi } from "vitest";
import {
  mkdtemp,
  rm,
  readFile,
  writeFile,
  symlink,
  stat,
  access,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import { sourceFormat, sourceName, UploadMeta } from "@/lib/media/contracts";
import {
  mediaRoot,
  objectPath,
  storeUpload,
  commitObject,
  readObject,
  removeObject,
} from "@/lib/media/storage";
const roots: string[] = [];
afterEach(async () => {
  vi.unstubAllEnvs();
  for (const root of roots.splice(0))
    await rm(root, { recursive: true, force: true });
});
async function setup() {
  const root = await mkdtemp(path.join(tmpdir(), "persona-media-unit-"));
  roots.push(root);
  vi.stubEnv("PERSONA_MEDIA_DIR", path.join(root, "private"));
  return root;
}
it("does not interpret playlist, HTML, SVG or filenames as trusted media", () => {
  for (const text of [
    "#EXTM3U\nhttps://example.test/secret",
    "<svg onload=alert(1)>",
    "<html>RIFF</html>",
  ])
    expect(() => sourceFormat(new TextEncoder().encode(text))).toThrow();
  expect(sourceName("../../my clip.wav")).toBe("my clip.wav");
  expect(() =>
    UploadMeta.parse({
      draftRevision: 1,
      name: "clip.wav",
      bytes: 20 * 1024 * 1024 + 1,
      locale: "en-IN",
      retentionDays: 7,
      rights: true,
      retention: true,
    }),
  ).toThrow();
  expect(() =>
    UploadMeta.parse({
      draftRevision: 1,
      name: "clip.wav",
      bytes: 10,
      locale: "en-IN",
      retentionDays: 30,
      rights: true,
      retention: true,
    }),
  ).toThrow();
});
it("stores streamed bytes privately with exact-size admission and bounded range reads", async () => {
  await setup();
  const id = randomUUID(),
    bytes = new TextEncoder().encode("RIFF1234WAVE0123456789");
  await storeUpload(
    id,
    new Request("http://localhost/", {
      method: "POST",
      body: new Blob([bytes]),
    }),
    bytes.length,
  );
  await commitObject(id);
  expect((await stat(await mediaRoot())).mode & 0o077).toBe(0);
  expect((await stat(await objectPath(id))).mode & 0o077).toBe(0);
  expect((await readObject(id, "bytes=-4")).data).toEqual(bytes.slice(-4));
  await expect(readObject(id, "bytes=7-2")).rejects.toMatchObject({
    status: 416,
  });
  await expect(
    storeUpload(
      randomUUID(),
      new Request("http://localhost/", {
        method: "POST",
        body: new Blob([bytes]),
      }),
      3,
    ),
  ).rejects.toMatchObject({ status: 413 });
  await removeObject(id);
  await expect(access(await objectPath(id))).rejects.toThrow();
});
it("rejects path traversal and refuses to follow a media-object symlink", async () => {
  const root = await setup();
  await expect(objectPath("../../secret")).rejects.toThrow();
  const secret = path.join(root, "outside.txt");
  await writeFile(secret, "not media");
  const id = randomUUID();
  await symlink(secret, await objectPath(id));
  await expect(readObject(id, null)).rejects.toThrow();
  await removeObject(id);
  expect(await readFile(secret, "utf8")).toBe("not media");
});

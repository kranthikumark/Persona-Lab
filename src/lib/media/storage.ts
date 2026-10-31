import "server-only";
import { constants } from "node:fs";
import {
  mkdir,
  lstat,
  realpath,
  open,
  rm,
  rename,
  readdir,
} from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/lib/api";
import { MAX_SOURCE_BYTES } from "./contracts";

export async function mediaRoot() {
  // Runtime-owned objects must never become deployment build assets.
  const root = path.resolve(
    /* turbopackIgnore: true */ process.env.PERSONA_MEDIA_DIR ||
      ".private-media",
  );
  const publicRoot = await realpath(path.resolve("public"));
  const project = await realpath(process.cwd()),
    allowed = path.join(project, ".private-media");
  const validLocation = (location: string) =>
    location !== project &&
    location !== path.parse(location).root &&
    (!location.startsWith(project + path.sep) ||
      location === allowed ||
      location.startsWith(allowed + path.sep));
  if (!validLocation(root))
    throw new ApiError(
      503,
      "Use a dedicated private storage directory outside application files.",
    );
  await mkdir(root, { recursive: true, mode: 0o700 });
  if ((await lstat(root)).isSymbolicLink())
    throw new ApiError(
      503,
      "Private media storage cannot use a symlink directory.",
    );
  const actual = await realpath(/* turbopackIgnore: true */ root);
  if (
    !validLocation(actual) ||
    actual === publicRoot ||
    actual.startsWith(publicRoot + path.sep)
  )
    throw new ApiError(
      503,
      "Media storage must be outside public application files.",
    );
  // Existing directories must also be private, not merely newly created ones.
  const permissions = (await lstat(root)).mode & 0o077;
  if (permissions)
    throw new ApiError(
      503,
      "Private media storage permissions must be restricted to the server owner (0700).",
    );
  return actual;
}
export async function objectPath(id: string, pending = false) {
  z.uuid().parse(id);
  return path.join(
    /* turbopackIgnore: true */ await mediaRoot(),
    `${id}.${pending ? "upload" : "media"}`,
  );
}
export async function storeUpload(
  id: string,
  request: Request,
  expected: number,
) {
  if (expected > MAX_SOURCE_BYTES)
    throw new ApiError(413, "Clips must be at most 20 MB.");
  const target = await objectPath(id, true);
  const file = await open(/* turbopackIgnore: true */ target, "wx", 0o600);
  const reader = request.body?.getReader();
  const digest = createHash("sha256");
  let size = 0,
    prefix = Buffer.alloc(0);
  const controller = new AbortController();
  const deadline = setTimeout(() => controller.abort(), 120000);
  const abort = () => {
    void reader?.cancel().catch(() => {});
  };
  request.signal.addEventListener("abort", abort, { once: true });
  controller.signal.addEventListener("abort", abort, { once: true });
  try {
    if (!reader) throw new ApiError(400, "Choose a media file.");
    while (true) {
      if (request.signal.aborted || controller.signal.aborted)
        throw new ApiError(408, "Upload cancelled or timed out.");
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > expected || size > MAX_SOURCE_BYTES) {
        await reader.cancel();
        throw new ApiError(
          413,
          "Upload exceeds its declared size or 20 MB limit.",
        );
      }
      if (prefix.length < 32)
        prefix = Buffer.concat([
          prefix,
          Buffer.from(value.slice(0, 32 - prefix.length)),
        ]);
      digest.update(value);
      await file.writeFile(value);
    }
    if (
      size !== expected ||
      !size ||
      request.signal.aborted ||
      controller.signal.aborted
    )
      throw new ApiError(400, "Upload was interrupted. Choose the file again.");
    return { sha256: digest.digest("hex"), prefix, path: target };
  } finally {
    clearTimeout(deadline);
    request.signal.removeEventListener("abort", abort);
    controller.signal.removeEventListener("abort", abort);
    reader?.releaseLock();
    await file.close();
  }
}
export async function commitObject(id: string) {
  await rename(await objectPath(id, true), await objectPath(id));
}
export async function removeObject(id: string) {
  await Promise.all([
    rm(await objectPath(id), { force: true }),
    rm(await objectPath(id, true), { force: true }),
  ]);
}
export async function readObject(id: string, range: string | null) {
  const file = await open(
    /* turbopackIgnore: true */ await objectPath(id),
    constants.O_RDONLY | constants.O_NOFOLLOW,
  );
  try {
    const size = (await file.stat()).size;
    if (size > MAX_SOURCE_BYTES || !size)
      throw new ApiError(404, "Source unavailable.");
    let start = 0,
      end = size - 1;
    if (range) {
      const match = /^bytes=(\d*)-(\d*)$/.exec(range);
      if (!match || (!match[1] && !match[2]))
        throw new ApiError(416, "Unsupported byte range.");
      if (!match[1]) start = Math.max(0, size - Number(match[2]));
      else {
        start = Number(match[1]);
        if (match[2]) end = Math.min(size - 1, Number(match[2]));
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        start > end ||
        start >= size
      )
        throw new ApiError(416, "Unsupported byte range.");
    }
    const data = Buffer.alloc(end - start + 1);
    let read = 0;
    while (read < data.length) {
      const result = await file.read(
        data,
        read,
        data.length - read,
        start + read,
      );
      if (!result.bytesRead) throw new Error("Short media read");
      read += result.bytesRead;
    }
    return { data: new Uint8Array(data), size, start, end, partial: !!range };
  } finally {
    await file.close();
  }
}
export async function cleanTemporaryFiles() {
  const root = await mediaRoot();
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || !/^work-[0-9a-f-]{36}$/.test(entry.name))
      continue;
    const target = path.join(root, entry.name);
    if ((await lstat(target)).mtimeMs < Date.now() - 10 * 60000)
      await rm(target, { recursive: true, force: true });
  }
}

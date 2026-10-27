import { expect, it } from "vitest";
import { ApiError, handle, jsonBody } from "@/lib/api";

it("rejects a chunked multibyte body by bytes even without content length", async () => {
  let cancelled = false;
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("€".repeat(4100)));
    },
    cancel() {
      cancelled = true;
    },
  });
  const request = new Request("http://localhost/api", {
    method: "POST",
    body: stream,
    duplex: "half",
  } as RequestInit);
  await expect(jsonBody(request)).rejects.toMatchObject({ status: 413 });
  expect(cancelled).toBe(true);
});

it("parses bounded JSON and rejects malformed input", async () => {
  await expect(
    jsonBody(
      new Request("http://localhost", {
        method: "POST",
        body: '{"text":"hello"}',
      }),
    ),
  ).resolves.toEqual({ text: "hello" });
  await expect(
    jsonBody(new Request("http://localhost", { method: "POST", body: "no" })),
  ).rejects.toMatchObject({ status: 400 });
});

it("access and usage errors are never cacheable", async () => {
  for (const status of [403, 404, 429]) {
    const response = await handle(async () => {
      throw new ApiError(status, "Unavailable");
    });
    expect(response.status).toBe(status);
    expect(response.headers.get("cache-control")).toBe("no-store");
  }
});

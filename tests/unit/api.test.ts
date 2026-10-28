import { afterEach, expect, it, vi } from "vitest";
import { ApiError, assertOrigin, handle, jsonBody } from "@/lib/api";

afterEach(() => vi.unstubAllEnvs());

function originRequest(origin?: string) {
  return new Request("http://127.0.0.1:3100/api/sessions", {
    headers: origin ? { origin } : {},
  });
}

it("accepts configured origins and same-port loopback aliases in development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  for (const origin of [
    "http://127.0.0.1:3100",
    "http://localhost:3100",
    "http://[::1]:3100",
  ]) {
    expect(() => assertOrigin(originRequest(origin))).not.toThrow();
  }
});

it("rejects foreign, malformed, missing and wrong-port origins in development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  for (const origin of [
    undefined,
    "null",
    "https://foreign.example",
    "http://localhost:3101",
    "https://localhost:3100",
    "http://localhost.evil.test:3100",
    "http://localhost:3100/path",
    "http://user@localhost:3100",
  ]) {
    expect(() => assertOrigin(originRequest(origin))).toThrow(ApiError);
  }
});

it("keeps production and non-loopback development origins exact", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_ORIGIN", "http://127.0.0.1:3100");
  expect(() => assertOrigin(originRequest("http://localhost:3100"))).toThrow(
    ApiError,
  );
  expect(() =>
    assertOrigin(originRequest("http://127.0.0.1:3100")),
  ).not.toThrow();
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_ORIGIN", "http://192.168.1.7:3104");
  expect(() => assertOrigin(originRequest("http://localhost:3104"))).toThrow(
    ApiError,
  );
  expect(() =>
    assertOrigin(originRequest("http://192.168.1.7:3104")),
  ).not.toThrow();
});

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

import { afterEach, expect, it, vi } from "vitest";
import { api, requestKey } from "@/lib/client";
it("creates a valid v4 retry key when the browser lacks randomUUID", () => {
  vi.stubGlobal("crypto", {
    getRandomValues: (bytes: Uint8Array) => bytes.fill(0x12),
  });
  expect(requestKey()).toBe("12121212-1212-4212-9212-121212121212");
});
afterEach(() => vi.unstubAllGlobals());
it("explains a lost connection without claiming a potentially committed turn was not saved", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("raw network internals")),
  );
  await expect(
    api("/api/branches/example/turns", { text: "Hello" }),
  ).rejects.toThrow("Reload your saved history before retrying");
});
it("handles an HTML or truncated response without exposing parser internals", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        new Response("<html>proxy error</html>", { status: 502 }),
      ),
  );
  await expect(api("/api/sessions")).rejects.toThrow("unreadable response");
});
it("preserves a structured recoverable application error", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValue(
        Response.json({ error: "No turn was saved; retry." }, { status: 502 }),
      ),
  );
  await expect(api("/api/sessions")).rejects.toThrow(
    "No turn was saved; retry.",
  );
});
it("returns successful data and keeps request caching disabled", async () => {
  const fetcher = vi.fn().mockResolvedValue(Response.json({ sessions: [] }));
  vi.stubGlobal("fetch", fetcher);
  expect(await api("/api/sessions")).toEqual({ sessions: [] });
  expect(fetcher.mock.calls[0][1]).toMatchObject({
    cache: "no-store",
    method: "GET",
  });
});

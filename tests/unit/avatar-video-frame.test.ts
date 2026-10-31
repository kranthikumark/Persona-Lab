import { afterEach, expect, it, vi } from "vitest";
import { waitForVideoFrame } from "@/lib/avatar/video-frame";
afterEach(() => vi.useRealTimers());
function videoStub() {
  let present: (() => void) | undefined;
  const cancel = vi.fn();
  const video = {
    currentTime: 20,
    readyState: 4,
    requestVideoFrameCallback: vi.fn((callback: () => void) => {
      present = callback;
      return 1;
    }),
    cancelVideoFrameCallback: cancel,
  } as unknown as HTMLVideoElement;
  return { video, cancel, present: () => present?.() };
}
it("waits for a newly presented frame even when the stream reports ready", async () => {
  const v = videoStub(),
    done = vi.fn();
  const pending = waitForVideoFrame(v.video, new AbortController().signal).then(
    done,
  );
  await Promise.resolve();
  expect(done).not.toHaveBeenCalled();
  v.present();
  await pending;
  expect(done).toHaveBeenCalledOnce();
});
it("aborts a delayed frame so a stopped reply cannot release audio later", async () => {
  const v = videoStub(),
    controller = new AbortController();
  const pending = waitForVideoFrame(v.video, controller.signal);
  controller.abort();
  await expect(pending).rejects.toThrow("Video frame unavailable");
  expect(v.cancel).toHaveBeenCalledWith(1);
  v.present();
});
it("fails a missing stream within the deadline", async () => {
  vi.useFakeTimers();
  const v = videoStub();
  const pending = expect(
    waitForVideoFrame(v.video, new AbortController().signal),
  ).rejects.toThrow("Video frame unavailable");
  await vi.advanceTimersByTimeAsync(15000);
  await pending;
  expect(v.cancel).toHaveBeenCalledWith(1);
});

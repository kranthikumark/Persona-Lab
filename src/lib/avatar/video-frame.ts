// A signaling "speaking" event does not prove that a video frame has arrived.
// Keep audio muted until the browser actually presents a fresh frame.
export function waitForVideoFrame(
  video: HTMLVideoElement,
  signal: AbortSignal,
) {
  return new Promise<void>((resolve, reject) => {
    let frame: number | undefined, raf: number | undefined;
    const baseline = video.currentTime;
    const cleanup = () => {
      clearTimeout(deadline);
      signal.removeEventListener("abort", abort);
      if (frame !== undefined) video.cancelVideoFrameCallback?.(frame);
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
    const fail = () => {
      cleanup();
      reject(new Error("Video frame unavailable"));
    };
    const abort = () => fail();
    const ready = () => {
      if (signal.aborted) return fail();
      cleanup();
      resolve();
    };
    const deadline = setTimeout(fail, 15000);
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) return fail();
    if (video.requestVideoFrameCallback)
      frame = video.requestVideoFrameCallback(ready);
    else {
      const poll = () => {
        if (video.readyState >= 3 && video.currentTime > baseline) ready();
        else raf = requestAnimationFrame(poll);
      };
      raf = requestAnimationFrame(poll);
    }
  });
}

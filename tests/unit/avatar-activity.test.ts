import { afterEach, expect, it, vi } from "vitest";
import { AvatarActivity } from "@/lib/avatar/activity";
afterEach(() => vi.useRealTimers());
const reply = () => ({ start: vi.fn(), end: vi.fn(), error: vi.fn() });
it("keeps a reply active across the observed batched silent/speaking chunk signals", () => {
  vi.useFakeTimers();
  const activity = new AvatarActivity(),
    callbacks = reply();
  activity.set(callbacks);
  activity.silent(); // Startup silence cannot end a reply that has not started.
  activity.speaking();
  activity.silent();
  activity.silent();
  activity.speaking();
  activity.silent();
  activity.speaking();
  vi.advanceTimersByTime(1000);
  expect(callbacks.start).toHaveBeenCalledTimes(1);
  expect(callbacks.end).not.toHaveBeenCalled();
  activity.silent();
  vi.advanceTimersByTime(500);
  expect(callbacks.end).toHaveBeenCalledTimes(1);
});
it("does not cut off a known reply when speech-finished signaling outruns delayed media", () => {
  vi.useFakeTimers();
  const activity = new AvatarActivity(),
    callbacks = reply();
  activity.set(callbacks, 5000);
  activity.speaking();
  activity.silent();
  vi.advanceTimersByTime(500);
  expect(callbacks.end).not.toHaveBeenCalled();
  vi.advanceTimersByTime(4500);
  expect(callbacks.end).toHaveBeenCalledOnce();
});
it("cancels pending completion on interruption and does not finish a replacement reply", () => {
  vi.useFakeTimers();
  const activity = new AvatarActivity(),
    old = reply(),
    next = reply();
  activity.set(old);
  activity.speaking();
  activity.silent();
  expect(activity.cancel()).toBe(true);
  expect(activity.cancel()).toBe(false);
  activity.set(next);
  vi.advanceTimersByTime(1000);
  expect(old.end).not.toHaveBeenCalled();
  expect(next.end).not.toHaveBeenCalled();
  activity.speaking();
  expect(next.start).toHaveBeenCalledTimes(1);
});

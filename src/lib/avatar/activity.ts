export type AvatarCallbacks = {
  start: () => void;
  end: () => void;
  error: () => void;
  wait?: () => void;
};

// Simli may batch SILENT/SPEAK signals at PCM chunk boundaries. Keep the
// current reply alive until silence persists, and never finish a newer reply.
export class AvatarActivity {
  active: AvatarCallbacks | null = null;
  private started = false;
  private startedAt = 0;
  private minimumMs = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private clearSilence() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  cancel() {
    const hadAudio = this.active !== null;
    this.clearSilence();
    this.active = null;
    this.started = false;
    return hadAudio;
  }
  set(callbacks: AvatarCallbacks, minimumMs = 0) {
    this.cancel();
    this.active = callbacks;
    this.minimumMs = Math.min(90000, Math.max(0, minimumMs));
  }
  speaking() {
    this.clearSilence();
    if (!this.active || this.started) return;
    this.started = true;
    this.startedAt = Date.now();
    this.active.start();
  }
  silent() {
    if (!this.active || !this.started) return;
    const reply = this.active;
    this.clearSilence();
    this.timer = setTimeout(
      () => {
        this.timer = null;
        if (this.active !== reply) return;
        this.active = null;
        this.started = false;
        reply.end();
      },
      Math.max(500, this.minimumMs - (Date.now() - this.startedAt)),
    );
  }
}

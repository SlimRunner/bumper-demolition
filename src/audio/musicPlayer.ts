export class MusicPlayer {
  private audio: HTMLAudioElement;
  private fadeFrame?: number;

  constructor(src: string) {
    this.audio = new Audio(src);
    this.audio.preload = "auto";
    this.audio.load();
    this.audio.loop = true;
  }

  play(restart = false) {
    if (restart) {
      this.audio.currentTime = 0;
    }
    this.audio.play().catch(()=>{});
  }

  pause() {
    this.cancelFade();
    this.audio.pause();
  }

  stop() {
    this.pause();
    this.audio.currentTime = 0;
  }

  fadeTo(targetVolume: number, durationSeconds: number) {
    const from = this.audio.volume;
    const to = this.clamp01(targetVolume);
    const durationMs = Math.max(0, durationSeconds * 1000);

    this.cancelFade();
    if (durationMs === 0) {
      this.audio.volume = to;
      return;
    }

    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      this.audio.volume = from + (to - from) * t;
      if (t < 1) {
        this.fadeFrame = requestAnimationFrame(tick);
      } else {
        this.fadeFrame = undefined;
      }
    };
    this.fadeFrame = requestAnimationFrame(tick);
  }

  setSource(src: string) {
    const time = this.audio.currentTime;
    const volume = this.audio.volume;
    const wasPlaying = !this.audio.paused;

    this.cancelFade();
    this.audio.pause();
    this.audio.src = src;
    this.audio.preload = "auto";
    this.audio.load();
    this.audio.currentTime = time;
    this.audio.volume = volume;
    this.audio.loop = true;

    if (wasPlaying) {
      this.audio.play().catch(()=>{});
    }
  }

  getCurrentTime() {
    return this.audio.currentTime;
  }

  setCurrentTime(seconds: number) {
    this.audio.currentTime = Math.max(0, seconds);
  }

  setVolume(v: number) {
    this.cancelFade();
    this.audio.volume = this.clamp01(v);
  }

  private cancelFade() {
    if (this.fadeFrame !== undefined) {
      cancelAnimationFrame(this.fadeFrame);
      this.fadeFrame = undefined;
    }
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value));
  }
}

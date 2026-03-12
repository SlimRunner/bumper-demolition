export class CollisionSound {
  private readonly audioSlow: HTMLAudioElement;
  private readonly audioFast: HTMLAudioElement;
  private readonly thresholdImpulse: number;
  private readonly minImpulse: number;
  private readonly maxImpulse: number;
  private readonly maxVolume: number;
  private lastPlayTime = 0;
  private readonly cooldownMs: number;

  constructor(
    slowSrc: string,
    fastSrc: string,
    thresholdImpulse = 8,
    minImpulse = 2,
    maxImpulse = 15,
    maxVolume = 0.8,
    cooldownMs = 80,
  ) {
    this.audioSlow = new Audio(slowSrc);
    this.audioFast = new Audio(fastSrc);
    this.audioSlow.volume = 0;
    this.audioFast.volume = 0;
    this.thresholdImpulse = thresholdImpulse;
    this.minImpulse = minImpulse;
    this.maxImpulse = maxImpulse;
    this.maxVolume = maxVolume;
    this.cooldownMs = cooldownMs;
  }

  play(impulse: number): void {
    if (impulse < this.minImpulse) return;
    const now = performance.now();
    if (now - this.lastPlayTime < this.cooldownMs) return;
    this.lastPlayTime = now;

    const t = Math.min(
      1,
      (impulse - this.minImpulse) /
        (this.maxImpulse - this.minImpulse),
    );
    const volume = t * this.maxVolume;
    const audio =
      impulse >= this.thresholdImpulse ? this.audioFast : this.audioSlow;

    audio.volume = volume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }
}
